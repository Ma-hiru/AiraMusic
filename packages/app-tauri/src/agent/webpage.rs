//! `agent-tool-web-execute`：在真实页面里执行 JavaScript。
//!
//! Electron 版用 `WebBrowser` 的页面池；这里用**隐藏的 Tauri webview** 承担同样角色：
//! 每个 `page_id` 对应一个隐藏窗口，脚本在该页面主世界执行，返回值按 JSON 回传。
//!
//! 与快照工具（HTTP 抓取）不同，这里的页面会真正加载并执行 JS，因此可以读取
//! 动态渲染后的 DOM、发起同页请求或提交表单——属于写操作，超时按 `commit_unknown` 处理。

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use serde_json::Value;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::agent::bridge::ToolError;

const MAX_PAGES: usize = 6;
const EVAL_TIMEOUT: Duration = Duration::from_secs(15);

struct Page {
    id: String,
}

fn pages() -> &'static Mutex<VecDeque<Page>> {
    static PAGES: OnceLock<Mutex<VecDeque<Page>>> = OnceLock::new();
    PAGES.get_or_init(|| Mutex::new(VecDeque::new()))
}

fn tick() -> u64 {
    static TICK: AtomicU64 = AtomicU64::new(1);
    TICK.fetch_add(1, Ordering::SeqCst)
}

fn window_label(id: &str) -> String {
    format!("webpage-{id}")
}

/// 把用户脚本包成「返回 JSON 字符串」的同步函数体。
///
/// 这样 `return xxx` 在顶层也合法，抛错会变成 `{ok:false,error}`，
/// 而不是让 WKWebView 只拿到一个 undefined。
pub fn wrap_script(js: &str) -> String {
    format!(
        r#"(() => {{
  try {{
    const __value = (function () {{
{js}
    }})();
    return JSON.stringify({{ ok: true, value: __value === undefined ? null : __value }});
  }} catch (error) {{
    return JSON.stringify({{ ok: false, error: String(error && error.message ? error.message : error) }});
  }}
}})()"#
    )
}

/// 解析页面回传的 JSON
pub fn parse_result(raw: &str) -> Result<Value, ToolError> {
    let value: Value = serde_json::from_str(raw)
        .map_err(|error| ToolError::new("script_error", format!("脚本返回非 JSON: {error}")))?;
    if value.get("ok").and_then(Value::as_bool) == Some(true) {
        return Ok(value.get("value").cloned().unwrap_or(Value::Null));
    }
    let message = value
        .get("error")
        .and_then(Value::as_str)
        .unwrap_or("脚本执行失败");
    Err(ToolError::new("script_error", message.to_string()))
}

fn remember(id: &str) {
    if let Ok(mut guard) = pages().lock() {
        guard.retain(|page| page.id != id);
        guard.push_back(Page { id: id.to_string() });
        while guard.len() > MAX_PAGES {
            if let Some(evicted) = guard.pop_front() {
                if let Some(window) =
                    app().and_then(|app| app.get_webview_window(&window_label(&evicted.id)))
                {
                    let _ = window.destroy();
                }
            }
        }
    }
}

/// 关掉所有隐藏页（agent 窗口关闭时调用，对应原版 `win.once("closed", () => WebBrowser.close())`）
pub fn close_all() {
    let Ok(mut guard) = pages().lock() else {
        return;
    };
    for page in guard.drain(..) {
        if let Some(window) = app().and_then(|app| app.get_webview_window(&window_label(&page.id)))
        {
            let _ = window.destroy();
        }
    }
}

static APP: OnceLock<AppHandle> = OnceLock::new();

pub fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
}

pub fn app() -> Option<&'static AppHandle> {
    APP.get()
}

fn latest_page() -> Option<String> {
    pages()
        .lock()
        .ok()
        .and_then(|guard| guard.back().map(|page| page.id.clone()))
}

fn create_page(app: &AppHandle, id: &str, url: Option<&str>) -> Result<String, ToolError> {
    let target = url.unwrap_or("about:blank");
    let parsed = tauri::Url::parse(target)
        .map_err(|_| ToolError::new("invalid_tool_call", format!("URL 不合法：{target}")))?;
    let label = window_label(id);
    let handle = app.clone();
    let window_label_for_build = label.clone();
    let (sender, receiver) = std::sync::mpsc::channel();
    let _ = app.run_on_main_thread(move || {
        // Builder 借用了 AppHandle，必须整个在闭包里构造
        let builder = WebviewWindowBuilder::new(
            &handle,
            &window_label_for_build,
            WebviewUrl::External(parsed),
        )
        .title("AiraMusic 网页执行")
        .inner_size(1024.0, 768.0)
        .visible(false);
        let _ = sender.send(
            builder
                .build()
                .map(|_| ())
                .map_err(|error| error.to_string()),
        );
    });
    match receiver.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(())) => Ok(label),
        Ok(Err(error)) => Err(ToolError::new("service", format!("创建页面失败: {error}"))),
        Err(_) => Err(ToolError::new("service", "创建页面超时")),
    }
}

async fn eval(app: &AppHandle, label: &str, script: String) -> Result<String, ToolError> {
    let Some(window) = app.get_webview_window(label) else {
        return Err(ToolError::new("service", "页面已关闭"));
    };
    // 回调是 `Fn`，用 Option 保证只发送一次
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let slot = std::sync::Arc::new(std::sync::Mutex::new(Some(sender)));
    let callback_slot = slot.clone();
    window
        .eval_with_callback(script, move |result| {
            if let Ok(mut guard) = callback_slot.lock() {
                if let Some(sender) = guard.take() {
                    let _ = sender.send(result);
                }
            }
        })
        .map_err(|error| ToolError::new("service", format!("执行失败: {error}")))?;
    match tokio::time::timeout(EVAL_TIMEOUT, receiver).await {
        Ok(Ok(result)) => Ok(result),
        Ok(Err(_)) => Err(ToolError::new("service", "页面回调中断")),
        Err(_) => Err(ToolError::new(
            "commit_unknown",
            "脚本执行超时；可能已产生副作用，请先检查页面状态",
        )),
    }
}

/// `agent-tool-web-execute` 的入口
pub async fn execute(app: &AppHandle, js: &str, page_id: Option<&str>) -> Result<Value, ToolError> {
    let trimmed = js.trim();
    if trimmed.is_empty() {
        return Err(ToolError::new("invalid_tool_call", "js 不能为空"));
    }

    let id = page_id
        .map(str::to_string)
        .or_else(latest_page)
        .unwrap_or_else(|| format!("p{}", tick()));
    let label = window_label(&id);
    if app.get_webview_window(&label).is_none() {
        create_page(app, &id, None)?;
    }
    remember(&id);
    let raw = eval(app, &label, wrap_script(trimmed)).await?;
    parse_result(&raw)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn wrapper_allows_top_level_return() {
        let script = wrap_script("return 1 + 1");
        assert!(script.contains("function ()"));
        assert!(script.contains("return 1 + 1"));
        assert!(script.contains("JSON.stringify"));
    }

    #[test]
    fn parse_result_reads_value_and_error() {
        assert_eq!(
            parse_result(r#"{"ok":true,"value":{"a":1}}"#).unwrap(),
            json!({"a": 1})
        );
        assert_eq!(parse_result(r#"{"ok":true}"#).unwrap(), Value::Null);
        let error = parse_result(r#"{"ok":false,"error":"boom"}"#).unwrap_err();
        assert_eq!(error.code, "script_error");
        assert_eq!(error.message, "boom");
        assert_eq!(parse_result("not json").unwrap_err().code, "script_error");
    }

    #[test]
    fn window_labels_are_prefixed() {
        assert_eq!(window_label("p1"), "webpage-p1");
    }
}
