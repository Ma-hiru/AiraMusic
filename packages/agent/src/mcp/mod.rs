pub mod client;
pub mod models;

use crate::cancel::Signal;
use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::mcp::models::{MCPCServerConfigJSON, MCPServer, MCPServerConfig, MCPTool};
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::tools::{ToolRegistry, ToolsPlugin};
use anyhow::Context;
pub use client::MCPClient;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct MCPPlugin;
impl PluginMeta<Arc<MCPService>> for MCPPlugin {
    fn name() -> &'static str {
        "mcp"
    }

    fn service_name() -> &'static str {
        "mcp-service"
    }
}
impl Plugin<(), Arc<MCPService>> for MCPPlugin {
    fn inject(&self) -> Vec<&'static str> {
        vec![ToolsPlugin::service_name()]
    }

    fn apply(
        &self,
        ctx: &Arc<Ctx>,
        _config: (),
    ) -> anyhow::Result<PluginApplyResult<Arc<MCPService>>> {
        Ok(PluginApplyResult {
            service: Some(MCPService::new(ToolsPlugin::get_service(ctx)?)),
            emit_disposers: None,
        })
    }
}

pub struct MCPService {
    tool_registry: Arc<ToolRegistry>,
    servers: Mutex<HashMap<String, Arc<MCPServer>>>,
}
impl MCPService {
    pub fn new(tool_registry: Arc<ToolRegistry>) -> Arc<Self> {
        Arc::new(Self {
            tool_registry,
            servers: Mutex::new(HashMap::new()),
        })
    }

    /// 注册一个 MCP server
    /// 返回 disposer: 卸载工具 + 取消守护任务(取消连接)+ 移出注册表
    pub fn register(self: &Arc<Self>, config: MCPServerConfig) -> anyhow::Result<Disposer> {
        let server;
        {
            let mut servers = self
                .servers
                .lock()
                .map_err(|e| anyhow::anyhow!("lock mcp servers 失败: {}", e))?;

            if servers.contains_key(&config.name) {
                anyhow::bail!("MCP server \"{}\" 重复注册", config.name);
            }

            server = Arc::new(MCPServer {
                name: config.name.clone(),
                client: MCPClient::new(config),
                tool_disposers: Mutex::new(vec![]),
            });
            servers.insert(server.name.clone(), Arc::clone(&server));
        }

        // 守护任务: 建连 → 注册工具 → 等断线 → 摘工具 → 退避重连
        let cancel_signal = Signal::new();
        let task_signal = cancel_signal.clone();
        let task_service = Arc::clone(self);
        let task_server = Arc::clone(&server);
        tokio::spawn(async move { task_service.run_server(task_server, task_signal).await });

        let service = Arc::clone(self);
        let name = server.name.clone();
        Ok(Box::new(move || {
            cancel_signal.cancel();
            server.clear_tools();
            service.servers.lock().unwrap().remove(&name);
        }))
    }

    ///
    /// ``` json
    /// {
    ///   "mcpServers": {
    ///      "name": { "command": ..., "args": ..., "env": ... }
    ///    }
    /// }
    /// ```
    /// 或
    /// ```json
    /// {
    ///   "mcpServers": {
    ///      "name": { "url": ..., "headers": ... }
    ///    }
    /// }
    /// ```
    ///
    pub fn register_json(self: &Arc<Self>, json: &str) -> anyhow::Result<Vec<Disposer>> {
        let config: MCPCServerConfigJSON =
            serde_json::from_str(json).context("解析 MCP server config JSON 失败")?;
        config
            .mcp_servers
            .into_iter()
            .map(|(name, transport)| {
                self.register(MCPServerConfig {
                    name,
                    transport,
                    auto_reconnect: true,
                    reconnect_interval_secs: 1,
                })
            })
            .collect()
    }

    /// 已注册的 server 名
    pub fn list(&self) -> Vec<String> {
        self.servers.lock().unwrap().keys().cloned().collect()
    }

    /// 刷新所有"已连接" server 的工具列表
    pub async fn refresh_all(&self) {
        let servers: Vec<Arc<MCPServer>> = self.servers.lock().unwrap().values().cloned().collect();
        for server in servers {
            if server.client.is_connected() {
                self.refresh_tools(&server, &Signal::new()).await;
            }
        }
    }

    // ----- inner -----

    /// 单个 server 的守护循环: RunningService 的唯一所有者是这里(waiting() 消费 self)
    async fn run_server(self: Arc<Self>, server: Arc<MCPServer>, signal: Signal) {
        let mut attempt = 0u32;
        loop {
            if signal.is_cancelled() {
                return;
            }
            match server.client.connect().await {
                Ok(running) => {
                    attempt = 0;
                    tracing::info!(server = %server.name, "mcp 已连接");
                    self.refresh_tools(&server, &signal).await;
                    tokio::select! {
                        biased;
                        _ = signal.cancelled() => return, // drop running = 拆除连接/杀子进程
                        quit = running.waiting() => {
                            tracing::warn!(server = %server.name, reason = ?quit, "mcp 断线");
                            server.client.mark_disconnected();
                            server.clear_tools(); // 失联即摘工具, 重连后重新注册
                        }
                    }
                    if !server.client.config().auto_reconnect {
                        return;
                    }
                }
                Err(error) => {
                    tracing::warn!(server = %server.name, error = %error, attempt, "mcp 建连失败");
                    if !server.client.config().auto_reconnect {
                        return;
                    }
                }
            }

            // 退避(可被取消打断), 指数封顶 6 位
            let delay = server
                .client
                .config()
                .reconnect_interval()
                .saturating_mul(1 << attempt.min(6));
            attempt += 1;
            tokio::select! {
                biased;
                _ = signal.cancelled() => return,
                _ = tokio::time::sleep(delay) => {}
            }
        }
    }

    /// 摘旧工具 → 拉新工具列表 → 全部注册(工具名带 server 前缀, 避免跨 server 撞名)
    async fn refresh_tools(&self, server: &MCPServer, signal: &Signal) {
        server.clear_tools();
        match server.client.list_tools().await {
            Ok(tools) => {
                if signal.is_cancelled() {
                    return; // 拉列表期间被注销: 不再注册
                }
                let mut disposers = vec![];
                for tool in tools {
                    match self.tool_registry.register(Arc::new(MCPTool::new(
                        Arc::clone(&server.client),
                        server.name.clone(),
                        tool,
                    ))) {
                        Ok(disposer) => disposers.push(disposer),
                        Err(error) => tracing::warn!(
                            server = %server.name,
                            error = %error,
                            "mcp 工具注册失败, 跳过"
                        ),
                    }
                }
                *server.tool_disposers.lock().unwrap() = disposers;
            }
            Err(error) => {
                tracing::error!(server = %server.name, error = %error, "mcp 工具列表获取失败");
            }
        }
    }
}
