//! 本地 MCP 服务（Streamable HTTP，`127.0.0.1:32123/mcp`）。
//!
//! 对应 Electron 的 `lib/agent/server.ts` + `inner/agent/mcp.ts`：
//! - 宿主侧工具：`read_page` / `web_search`（Rust 直接抓取）
//! - renderer 工具：53 个，经 `message_dispatch_agent_tool_request` 交给主窗口执行
//!
//! 工具列表是动态的（`agent` 目录里的静态声明 + 宿主工具），所以不用
//! `#[tool_router]` 宏，而是手写 `list_tools` / `call_tool`。

use std::sync::Arc;

use rmcp::handler::server::ServerHandler;
use rmcp::model::{
    CallToolRequestParams, CallToolResponse, Implementation, ListToolsResult,
    PaginatedRequestParams, ServerCapabilities, ServerConfig, Tool, ToolAnnotations,
};
use rmcp::service::RequestContext;
use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::{StreamableHttpServerConfig, StreamableHttpService};
use rmcp::{ErrorData as McpError, RoleServer};
use serde_json::{Map, Value};

use crate::agent::{self, bridge, format, Risk, ToolDef};

#[derive(Clone)]
pub struct AiraMcp;

impl AiraMcp {
    pub fn new() -> Self {
        Self
    }

    /// 完整的工具清单：renderer 53 + inner 4
    pub fn tool_definitions(&self) -> Vec<Tool> {
        agent::all_tools().into_iter().map(renderer_tool).collect()
    }

    /// 工具调用的唯一入口（`call_tool` 只是它的协议外壳，便于测试直接调用）
    pub async fn invoke(
        &self,
        name: &str,
        args: Map<String, Value>,
    ) -> Result<CallToolResponse, McpError> {
        let Some(def) = agent::find(name) else {
            return Err(McpError::invalid_params(
                format!("工具不存在：{name}"),
                None,
            ));
        };

        let mut input = args;
        def.apply_defaults(&mut input);

        // 宿主工具（app-context / bangumi / web-*）直接在 Rust 里执行
        if def.host {
            return match agent::call_host(def, &input).await {
                Ok(value) => Ok(format::success(def, value).into()),
                Err(error) => Ok(format::failure(def, &error).into()),
            };
        }

        // 与 Electron 的 beforeCall 一致：主窗口不在就直接给出可重试错误
        if !bridge::renderer_available() {
            let error = bridge::ToolError::new(
                "renderer_unavailable",
                "AiraMusic 主界面尚未就绪，无法提供此查询；请打开主界面后重试。",
            );
            return Ok(format::failure(def, &error).into());
        }

        match bridge::call(def, Value::Object(input)).await {
            Ok(value) => Ok(format::success(def, value).into()),
            Err(error) => Ok(format::failure(def, &error).into()),
        }
    }
}

fn renderer_tool(def: &'static ToolDef) -> Tool {
    let mut tool = Tool::new(def.name, def.description, Arc::new(def.input_schema()));
    tool.title = Some(def.title());
    tool.annotations = Some(ToolAnnotations::from_raw(
        None,
        Some(def.risk == Risk::Read),
        Some(def.risk == Risk::Destructive),
        Some(def.risk == Risk::Read),
        Some(def.open_world),
    ));
    tool
}

impl ServerHandler for AiraMcp {
    fn get_info(&self) -> ServerConfig {
        let mut info = ServerConfig::default();
        info.capabilities = ServerCapabilities::builder().enable_tools().build();
        info.server_info = Implementation::new("aira-music", env!("CARGO_PKG_VERSION"));
        info.instructions = Some(
            "AiraMusic 本机工具：53 个播放器/媒体库工具（经主界面执行）+ 网页正文抽取与检索。"
                .to_string(),
        );
        info
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, McpError> {
        Ok(ListToolsResult {
            tools: self.tool_definitions(),
            ..Default::default()
        })
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, McpError> {
        self.invoke(request.name.as_ref(), request.arguments.unwrap_or_default())
            .await
    }
}

/// 启动 MCP 服务。必须在拉起 agent 之前调用。
pub async fn serve(port: u16) -> anyhow::Result<()> {
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port)).await?;
    let bound = listener
        .local_addr()
        .map(|address| address.port())
        .unwrap_or(port);
    crate::host_log!("[mcp] listening on http://127.0.0.1:{bound}/mcp");
    serve_on(listener).await
}

/// 在已绑定的 listener 上跑服务。
///
/// 拆出来是为了让测试复用自己绑好的端口：先 bind 再 drop 再 serve 会留下
/// 「端口被别的进程抢走 / serve 还没起」的窗口，测试偶发 ConnectionRefused。
async fn serve_on(listener: tokio::net::TcpListener) -> anyhow::Result<()> {
    let service = StreamableHttpService::new(
        || Ok(AiraMcp::new()),
        Arc::new(LocalSessionManager::default()),
        StreamableHttpServerConfig::default(),
    );

    let app = axum::Router::new().nest_service("/mcp", service);
    axum::serve(listener, app).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn tool_list_includes_renderer_and_host_tools() {
        let tools = AiraMcp::new().tool_definitions();
        assert_eq!(tools.len(), agent::all_tools().len());
        assert_eq!(tools.len(), 57, "53 renderer + 4 inner");
        let names: Vec<&str> = tools.iter().map(|tool| tool.name.as_ref()).collect();
        assert!(names.contains(&"agent-tool-track-detail"));
        assert!(names.contains(&"agent-tool-app-context"));
        assert!(names.contains(&"agent-tool-bangumi"));
        assert!(names.contains(&"agent-tool-web-snapshot"));
        let mut sorted = names.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), names.len(), "工具名不能重复");
    }

    #[test]
    fn renderer_tool_annotations_follow_risk() {
        let tools = AiraMcp::new().tool_definitions();
        let read = tools
            .iter()
            .find(|tool| tool.name == "agent-tool-track-detail")
            .unwrap();
        let annotations = read.annotations.as_ref().unwrap();
        assert_eq!(annotations.read_only_hint, Some(true));
        assert_eq!(annotations.idempotent_hint, Some(true));
        assert_eq!(annotations.destructive_hint, Some(false));

        let write = tools
            .iter()
            .find(|tool| tool.name == "agent-tool-playlist-delete")
            .unwrap();
        let annotations = write.annotations.as_ref().unwrap();
        assert_eq!(annotations.read_only_hint, Some(false));
        assert_eq!(annotations.destructive_hint, Some(true));
        assert_eq!(annotations.idempotent_hint, Some(false));
    }

    #[test]
    fn every_tool_has_valid_schema() {
        for tool in AiraMcp::new().tool_definitions() {
            let schema = Value::Object((*tool.input_schema).clone());
            assert_eq!(schema["type"], json!("object"), "{}", tool.name);
            assert!(schema["properties"].is_object(), "{}", tool.name);
            assert!(tool.description.is_some(), "{}", tool.name);
            assert!(tool.title.is_some(), "{}", tool.name);
        }
    }

    /// 全局桥接是进程级单例，涉及安装的用例必须串行
    static LINK_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    struct EchoLink {
        available: std::sync::atomic::AtomicBool,
        queue: std::sync::Mutex<std::collections::VecDeque<(String, Value)>>,
    }

    impl EchoLink {
        fn new(available: bool) -> Arc<Self> {
            Arc::new(Self {
                available: std::sync::atomic::AtomicBool::new(available),
                queue: std::sync::Mutex::new(std::collections::VecDeque::new()),
            })
        }
    }

    impl bridge::Link for EchoLink {
        fn available(&self) -> bool {
            self.available.load(std::sync::atomic::Ordering::SeqCst)
        }

        fn send(&self, kind: &str, data: Value) -> bool {
            self.queue
                .lock()
                .unwrap()
                .push_back((kind.to_string(), data));
            true
        }
    }

    /// 端到端：MCP → 桥接 → （模拟的）主窗口 → 回传 → 结果整形
    #[tokio::test]
    async fn invoke_roundtrips_through_renderer_link() {
        let _guard = LINK_LOCK.lock().await;
        let link = EchoLink::new(true);
        bridge::install(link.clone());

        let pump_link = link.clone();
        let pump = tokio::spawn(async move {
            loop {
                let next = pump_link.queue.lock().unwrap().pop_front();
                if let Some((kind, data)) = next {
                    if kind == "message_dispatch_agent_tool_request" {
                        let id = data["id"].as_str().unwrap_or_default().to_string();
                        let input = data["input"].clone();
                        bridge::deliver(
                            "message_deliver_agent_tool_response",
                            &json!({ "id": id, "ok": true, "data": { "echo": input } }),
                        );
                    }
                }
                tokio::time::sleep(std::time::Duration::from_millis(2)).await;
            }
        });

        let handler = AiraMcp::new();
        let call = handler
            .invoke(
                "agent-tool-track-detail",
                json!({ "ids": [7] }).as_object().cloned().unwrap(),
            )
            .await
            .expect("调用成功");
        let result = match call {
            CallToolResponse::Complete(result) => result,
            other => panic!("期望 Complete，得到 {other:?}"),
        };
        assert_eq!(result.is_error, Some(false));
        let structured = result.structured_content.expect("structured");
        assert_eq!(structured["ok"], json!(true));
        assert_eq!(structured["result"]["echo"]["ids"], json!([7]));
        // zod 的默认值在宿主侧补上后再转发
        assert_eq!(structured["result"]["echo"]["mode"], json!("simple"));

        pump.abort();
    }

    #[tokio::test]
    async fn invoke_reports_renderer_unavailable() {
        let _guard = LINK_LOCK.lock().await;
        bridge::install(EchoLink::new(false));
        let call = AiraMcp::new()
            .invoke(
                "agent-tool-track-detail",
                json!({ "ids": [1] }).as_object().cloned().unwrap(),
            )
            .await
            .expect("返回工具级错误");
        let result = match call {
            CallToolResponse::Complete(result) => result,
            other => panic!("期望 Complete，得到 {other:?}"),
        };
        assert_eq!(result.is_error, Some(true));
        let structured = result.structured_content.expect("structured");
        assert_eq!(structured["error"]["code"], json!("renderer_unavailable"));
        assert_eq!(structured["error"]["retryable"], json!(true));
    }

    #[tokio::test]
    async fn invoke_rejects_unknown_tool() {
        let error = AiraMcp::new()
            .invoke("no-such-tool", Map::new())
            .await
            .expect_err("未知工具应返回协议错误");
        assert!(error.message.contains("工具不存在"), "{:?}", error.message);
    }

    /// 真实 HTTP 握手：验证 transport + tools/list 的线上形状（随机端口，不冲突）
    #[tokio::test]
    async fn serves_tools_over_http() {
        // 自己持有 listener 再交给服务：不留「drop 到 bind」的空窗，避免偶发 ConnectionRefused
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            if let Err(error) = serve_on(listener).await {
                eprintln!("[test] mcp serve 退出: {error}");
            }
        });

        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        let endpoint = format!("http://127.0.0.1:{port}/mcp");
        let headers = [
            ("accept", "application/json, text/event-stream"),
            ("content-type", "application/json"),
        ];

        let init = client
            .post(&endpoint)
            .header(headers[0].0, headers[0].1)
            .header(headers[1].0, headers[1].1)
            .json(&json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": { "name": "test", "version": "0" }
                }
            }))
            .send()
            .await
            .expect("initialize");
        assert!(init.status().is_success());
        let session = init
            .headers()
            .get("mcp-session-id")
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .to_string();

        let _ = client
            .post(&endpoint)
            .header(headers[0].0, headers[0].1)
            .header(headers[1].0, headers[1].1)
            .header("mcp-session-id", &session)
            .json(&json!({"jsonrpc":"2.0","method":"notifications/initialized"}))
            .send()
            .await;

        let response = client
            .post(&endpoint)
            .header(headers[0].0, headers[0].1)
            .header(headers[1].0, headers[1].1)
            .header("mcp-session-id", &session)
            .json(&json!({"jsonrpc":"2.0","id":2,"method":"tools/list"}))
            .send()
            .await
            .expect("tools/list");
        let body = response.text().await.unwrap();
        let payload: Value = body
            .lines()
            .filter_map(|line| line.strip_prefix("data:"))
            .map(str::trim)
            .filter(|line| line.starts_with('{'))
            .find_map(|line| serde_json::from_str(line).ok())
            .or_else(|| serde_json::from_str(&body).ok())
            .unwrap_or_else(|| panic!("无法解析响应: {body}"));

        let tools = payload["result"]["tools"]
            .as_array()
            .unwrap_or_else(|| panic!("响应缺少 tools: {payload}"));
        assert_eq!(tools.len(), 57, "53 renderer + 4 inner");
        assert!(tools
            .iter()
            .any(|tool| tool["name"] == "agent-tool-track-detail"));
        // detail 参数必须出现在 schema 里
        let track = tools
            .iter()
            .find(|tool| tool["name"] == "agent-tool-track-detail")
            .unwrap();
        assert!(track["inputSchema"]["properties"]["detail"].is_object());
        assert_eq!(track["annotations"]["readOnlyHint"], json!(true));
    }

    #[tokio::test]
    async fn host_tool_errors_are_structured() {
        // 测试进程里没有 AppHandle：web-execute 应返回结构化错误而不是 panic
        let call = AiraMcp::new()
            .invoke(
                "agent-tool-web-execute",
                json!({ "js": "1+1" }).as_object().cloned().unwrap(),
            )
            .await
            .expect("工具级错误");
        let result = match call {
            CallToolResponse::Complete(result) => result,
            other => panic!("期望 Complete，得到 {other:?}"),
        };
        assert_eq!(result.is_error, Some(true));
        assert_eq!(
            result.structured_content.unwrap()["error"]["code"],
            json!("service")
        );
    }

    #[test]
    fn unknown_tool_is_not_in_catalog() {
        assert!(agent::find("missing-tool").is_none());
    }
}
