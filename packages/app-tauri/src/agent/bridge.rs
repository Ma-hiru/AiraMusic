//! renderer 工具的 IPC 往返。
//!
//! 与 Electron `lib/agent/tool.ts` 的 `requestRendererTool` 等价：
//! 1. 生成 request id，注册一次性回调；
//! 2. 把 `message_dispatch_agent_tool_request` 发给主窗口；
//! 3. 等 `message_deliver_agent_tool_response`（超时则发 cancel 并按 risk 区分
//!    `timeout` / `commit_unknown`）。
//!
//! 主窗口的处理逻辑在渲染层，本模块不重复实现业务。

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use serde_json::{json, Value};
use tokio::sync::oneshot;

use crate::agent::{Risk, ToolDef};

/// 一次工具调用的失败原因。`code` 与 `MainAgentTool.formatError` 的取值一致。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ToolError {
    pub code: &'static str,
    pub message: String,
}

impl ToolError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    /// 这些错误值得让 Agent 重试（与 Electron `retryable` 列表一致）
    pub fn retryable(&self) -> bool {
        matches!(
            self.code,
            "network" | "service" | "timeout" | "busy" | "renderer_unavailable"
        )
    }
}

/// 发送侧的抽象：生产环境是 Tauri 窗口，测试里是内存通道
pub trait Link: Send + Sync {
    /// 主窗口是否可接收工具请求
    fn available(&self) -> bool;

    /// 投递一条消息，返回是否成功送达
    fn send(&self, kind: &str, data: Value) -> bool;
}

type PendingSender = oneshot::Sender<Result<Value, ToolError>>;
type PendingMap = Mutex<HashMap<String, PendingSender>>;

static LINK: OnceLock<Mutex<Option<Arc<dyn Link>>>> = OnceLock::new();
static PENDING: OnceLock<PendingMap> = OnceLock::new();

fn link_slot() -> &'static Mutex<Option<Arc<dyn Link>>> {
    LINK.get_or_init(|| Mutex::new(None))
}

fn pending() -> &'static PendingMap {
    PENDING.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn install(link: Arc<dyn Link>) {
    if let Ok(mut slot) = link_slot().lock() {
        *slot = Some(link);
    }
}

fn current_link() -> Option<Arc<dyn Link>> {
    link_slot().lock().ok().and_then(|slot| slot.clone())
}

pub fn renderer_available() -> bool {
    current_link().map(|link| link.available()).unwrap_or(false)
}

/// `MainAgentTool.requestRendererTool`
pub async fn call(def: &'static ToolDef, input: Value) -> Result<Value, ToolError> {
    let Some(link) = current_link() else {
        return Err(ToolError::new(
            "renderer_unavailable",
            "AiraMusic 主界面尚未就绪，无法提供此查询；请打开主界面后重试。",
        ));
    };
    call_with(link.as_ref(), def, input).await
}

/// 与 `call` 相同，但显式指定发送端（测试用，避免依赖全局单例）
pub async fn call_with(
    link: &dyn Link,
    def: &'static ToolDef,
    input: Value,
) -> Result<Value, ToolError> {
    if !link.available() {
        return Err(ToolError::new(
            "renderer_unavailable",
            "AiraMusic 主界面尚未就绪，无法提供此查询；请打开主界面后重试。",
        ));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let (sender, receiver) = oneshot::channel();
    if let Ok(mut guard) = pending().lock() {
        guard.insert(id.clone(), sender);
    }

    let dispatched = link.send(
        "message_dispatch_agent_tool_request",
        json!({
            "id": id,
            "tool": def.name,
            "input": input,
            // MCP 调用方没有 UI 上下文，细节等级固定 standard
            "detail": "standard",
            "conversationID": "mcp",
        }),
    );
    if !dispatched {
        if let Ok(mut guard) = pending().lock() {
            guard.remove(&id);
        }
        return Err(ToolError::new(
            "renderer_unavailable",
            "无法把工具请求发送到主界面",
        ));
    }

    let timeout = Duration::from_millis(def.timeout_ms);
    match tokio::time::timeout(timeout, receiver).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err(ToolError::new("service", "主界面连接已断开")),
        Err(_) => {
            if let Ok(mut guard) = pending().lock() {
                guard.remove(&id);
            }
            let _ = link.send(
                "message_cancel_agent_tool_request",
                json!({ "id": id, "reason": "timeout" }),
            );
            if def.risk == Risk::Read {
                Err(ToolError::new(
                    "timeout",
                    format!("工具请求超时：{}", def.name),
                ))
            } else {
                Err(ToolError::new(
                    "commit_unknown",
                    format!(
                        "工具响应超时，无法确认操作是否已经提交；禁止自动重试：{}",
                        def.name
                    ),
                ))
            }
        }
    }
}

/// 主窗口回传的响应。返回 `true` 表示这条消息被工具通道消费。
///
/// 形状与 `use-agent-tool-handle.ts` 的 `sendOK` / `sendErr` 一致：
/// `{ id, ok: true, data }` 或 `{ id, ok: false, reason }`。
pub fn deliver(kind: &str, data: &Value) -> bool {
    if kind != "message_deliver_agent_tool_response" {
        return false;
    }
    let Some(id) = data.get("id").and_then(Value::as_str) else {
        return true;
    };
    let Some(sender) = pending().lock().ok().and_then(|mut guard| guard.remove(id)) else {
        // 已经超时/取消：渲染层的迟到响应直接丢弃（与 Electron 的 settled 判断等价）
        return true;
    };

    let ok = data.get("ok").and_then(Value::as_bool).unwrap_or(false);
    let payload = if ok {
        Ok(data.get("data").cloned().unwrap_or(Value::Null))
    } else {
        Err(ToolError::new(
            "invalid_tool_call",
            data.get("reason")
                .and_then(Value::as_str)
                .unwrap_or("工具执行失败")
                .to_string(),
        ))
    };
    let _ = sender.send(payload);
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::find;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

    struct TestLink {
        available: AtomicBool,
        sent: Mutex<Vec<(String, Value)>>,
        delivered: AtomicUsize,
    }

    impl TestLink {
        fn new(available: bool) -> Arc<Self> {
            Arc::new(Self {
                available: AtomicBool::new(available),
                sent: Mutex::new(Vec::new()),
                delivered: AtomicUsize::new(0),
            })
        }

        fn last_id(&self) -> String {
            let guard = self.sent.lock().unwrap();
            guard
                .iter()
                .rev()
                .find(|(kind, _)| kind == "message_dispatch_agent_tool_request")
                .and_then(|(_, data)| data.get("id").and_then(Value::as_str).map(str::to_string))
                .expect("没有发出过工具请求")
        }

        fn kinds(&self) -> Vec<String> {
            self.sent
                .lock()
                .unwrap()
                .iter()
                .map(|(kind, _)| kind.clone())
                .collect()
        }
    }

    impl Link for TestLink {
        fn available(&self) -> bool {
            self.available.load(Ordering::SeqCst)
        }

        fn send(&self, kind: &str, data: Value) -> bool {
            self.delivered.fetch_add(1, Ordering::SeqCst);
            self.sent.lock().unwrap().push((kind.to_string(), data));
            true
        }
    }

    fn tool(name: &str) -> &'static ToolDef {
        find(name).expect("工具存在")
    }

    #[tokio::test]
    async fn call_roundtrip_resolves_with_renderer_payload() {
        let link = TestLink::new(true);
        let sender = link.clone();
        let task = tokio::spawn(async move {
            call_with(
                sender.as_ref(),
                tool("agent-tool-track-detail"),
                json!({"ids": [1]}),
            )
            .await
        });
        // 等请求发出
        for _ in 0..100 {
            if link.delivered.load(Ordering::SeqCst) > 0 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
        let id = link.last_id();
        assert!(deliver(
            "message_deliver_agent_tool_response",
            &json!({ "id": id, "ok": true, "data": {"name": "x"} })
        ));

        let result = task.await.unwrap().expect("应成功");
        assert_eq!(result, json!({"name": "x"}));
    }

    #[tokio::test]
    async fn error_response_becomes_invalid_tool_call() {
        let link = TestLink::new(true);
        let sender = link.clone();
        let task = tokio::spawn(async move {
            call_with(sender.as_ref(), tool("agent-tool-track-detail"), json!({})).await
        });
        for _ in 0..100 {
            if link.delivered.load(Ordering::SeqCst) > 0 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
        let id = link.last_id();
        deliver(
            "message_deliver_agent_tool_response",
            &json!({ "id": id, "ok": false, "reason": "boom" }),
        );
        let error = task.await.unwrap().expect_err("应失败");
        assert_eq!(error.code, "invalid_tool_call");
        assert_eq!(error.message, "boom");
    }

    #[tokio::test]
    async fn renderer_unavailable_is_reported_before_dispatch() {
        let link = TestLink::new(false);
        let error = call_with(link.as_ref(), tool("agent-tool-track-detail"), json!({}))
            .await
            .unwrap_err();
        assert_eq!(error.code, "renderer_unavailable");
        assert!(link.sent.lock().unwrap().is_empty());
    }

    #[tokio::test(start_paused = true)]
    async fn read_tool_timeout_reports_timeout_and_cancels() {
        let link = TestLink::new(true);
        let sender = link.clone();
        let task = tokio::spawn(async move {
            call_with(sender.as_ref(), tool("agent-tool-track-detail"), json!({})).await
        });
        // 让 spawn 先跑起来（注册 pending + 发出请求）
        tokio::task::yield_now().await;
        tokio::time::advance(Duration::from_secs(60)).await;

        let error = task.await.unwrap().unwrap_err();
        assert_eq!(error.code, "timeout");
        assert!(error.retryable());
        assert!(
            link.kinds()
                .contains(&"message_cancel_agent_tool_request".to_string()),
            "超时必须通知渲染层取消"
        );
    }

    #[tokio::test(start_paused = true)]
    async fn write_tool_timeout_is_commit_unknown() {
        let link = TestLink::new(true);
        let sender = link.clone();
        let task = tokio::spawn(async move {
            call_with(sender.as_ref(), tool("agent-tool-player-action"), json!({})).await
        });
        tokio::task::yield_now().await;
        tokio::time::advance(Duration::from_secs(60)).await;

        let error = task.await.unwrap().unwrap_err();
        assert_eq!(error.code, "commit_unknown", "写操作的超时不能被当成可重试");
        assert!(!error.retryable());
    }

    #[test]
    fn deliver_ignores_unknown_and_stale_ids() {
        assert!(!deliver("message_dispatch_agent_tool_request", &json!({})));
        assert!(!deliver("message_other", &json!({})));
        assert!(deliver(
            "message_deliver_agent_tool_response",
            &json!({"id": "nope", "ok": true})
        ));
        assert!(deliver(
            "message_deliver_agent_tool_response",
            &json!({"ok": true})
        ));
    }
}
