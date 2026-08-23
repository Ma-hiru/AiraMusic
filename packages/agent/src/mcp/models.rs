use crate::ctx::models::{Disposer, DisposerLike};
use crate::mcp::client::MCPClient;
use crate::tools::models::{Tool, ToolRunContext};
use crate::utils::sanitize_tool_name;
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// MCP 传输方式
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum MCPTransport {
    /// 本地 stdio: agent 负责 spawn 子进程, 走 stdin/stdout
    Stdio {
        command: String,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default)]
        env: HashMap<String, String>,
    },
    /// 远程 streamable HTTP
    Http {
        url: String,
        #[serde(default)]
        headers: HashMap<String, String>,
    },
}

/// 一个 MCP server 的注册配置(等价 Claude/Cursor 的 mcpServers 条目)
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MCPServerConfig {
    /// server 名: 工具注册前缀(server/tool) + 日志标识
    pub name: String,
    pub transport: MCPTransport,
    /// 断线后是否自动重连
    #[serde(default = "default_true")]
    pub auto_reconnect: bool,
    /// 重连退避基数(秒)
    #[serde(default = "default_interval_secs")]
    pub reconnect_interval_secs: u64,
}
impl MCPServerConfig {
    pub fn reconnect_interval(&self) -> Duration {
        Duration::from_secs(self.reconnect_interval_secs)
    }
}
fn default_true() -> bool {
    true
}
fn default_interval_secs() -> u64 {
    1
}

#[derive(serde::Deserialize)]
pub struct MCPCServerConfigJSON {
    #[serde(rename = "mcpServers")]
    pub mcp_servers: HashMap<String, MCPTransport>,
}

pub struct MCPServer {
    pub name: String,
    pub client: Arc<MCPClient>,
    /// 该 server 已注册到 tool-registry 的disposers
    pub tool_disposers: Mutex<Vec<Disposer>>,
    pub tools_refreshed: AtomicBool,
}
impl MCPServer {
    pub fn clear_tools(&self) {
        self.tools_refreshed.store(false, Ordering::Release);
        std::mem::take(&mut *self.tool_disposers.lock().unwrap()).to_disposer()();
    }

    pub fn is_ready(&self) -> bool {
        self.client.is_connected() && self.tools_refreshed.load(Ordering::Acquire)
    }
}

pub struct MCPTool {
    client: Arc<MCPClient>,
    /// 注册到 tool-registry 的名字(server__工具名), 避免跨 server 撞名
    registry_name: String,
    /// MCP 协议里的真实工具名(请求时用, 保持原样)
    remote_name: String,
    description: String,
    parameters: Value,
}
impl MCPTool {
    pub fn new(client: Arc<MCPClient>, server_name: String, tool: rmcp::model::Tool) -> Self {
        let remote_name = tool.name.to_string();
        // OpenAI 工具名只允许 ^[a-zA-Z0-9_-]+$(不允许 /)
        // 注册名用 __ 连接 server 与工具名, 两边都清洗到白名单字符
        // remote_name 保持原样, 真正调 MCP 时用它
        let registry_name = format!(
            "{}__{}",
            sanitize_tool_name(&server_name),
            sanitize_tool_name(&remote_name)
        );
        let parameters = Value::Object((*tool.input_schema).clone());
        Self {
            client,
            registry_name,
            remote_name,
            description: tool.description.map(|d| d.to_string()).unwrap_or_default(),
            parameters,
        }
    }
}

#[async_trait]
impl Tool for MCPTool {
    fn name(&self) -> &str {
        &self.registry_name
    }

    fn description(&self) -> &str {
        &self.description
    }

    fn parameters(&self) -> Value {
        self.parameters.clone()
    }

    async fn run(&self, args: Value, ctx: &ToolRunContext) -> anyhow::Result<Value> {
        ctx.cancel.check()?;
        // 请求挂在取消信号上: stop 时不再干等远端
        tokio::select! {
            biased;
            _ = ctx.cancel.cancelled() => anyhow::bail!("已取消"),
            result = self.client.call_tool(&self.remote_name, args) => result,
        }
    }
}
