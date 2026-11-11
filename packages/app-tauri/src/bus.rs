use serde_json::{json, Value};
use tauri::{AppHandle, Manager, WebviewWindow};

/// 宿主 → 渲染层 的消息投递。
///
/// 与 `ipc/src/main/message.ts` 的 `commit` / `commitAll` 语义一致：
/// - `from` 是发送方标识；宿主自己发时用 `"process"`
/// - `"all"` 表示广播
/// - 发送方自身跳过（渲染层自己的 commit 由渲染层处理）
pub fn commit_all(app: &AppHandle, from: &str, kind: &str, data: Value) {
    for (label, window) in app.webview_windows() {
        if label == from {
            continue;
        }
        deliver(&window, from, kind, data.clone());
    }
}

/// 最近一次「状态类」消息的缓存：托盘面板隐藏时渲染层会被节流，
/// 可能错过推送；面板显示时用 [`replay`] 补一次最新状态。
static LAST_STATE: std::sync::Mutex<Option<std::collections::HashMap<String, Value>>> =
    std::sync::Mutex::new(None);

/// 只缓存这类「当前状态」消息，其它消息量太大没有重放价值
const REPLAYABLE: &[&str] = &[
    "bus_deliver_track_meta",
    "bus_deliver_track_progress",
    "bus_deliver_theme",
    "bus_deliver_play_list",
    "bus_deliver_device_output_views",
];

/// 记录一条状态消息（由 `aira_message_send` 调用）
pub fn record(kind: &str, data: &Value) {
    if !REPLAYABLE.contains(&kind) {
        return;
    }
    let Ok(mut guard) = LAST_STATE.lock() else {
        return;
    };
    guard
        .get_or_insert_with(std::collections::HashMap::new)
        .insert(kind.to_string(), data.clone());
}

/// 把最近一次状态消息重放给某个窗口（托盘面板显示时用）
pub fn replay(app: &AppHandle, to: &str) {
    let Some(window) = app.get_webview_window(to) else {
        return;
    };
    let Ok(guard) = LAST_STATE.lock() else {
        return;
    };
    let Some(map) = guard.as_ref() else {
        return;
    };
    // 顺序有意义：先 meta 再 progress
    for kind in REPLAYABLE {
        if let Some(data) = map.get(*kind) {
            deliver(&window, "process", kind, data.clone());
        }
    }
}

pub fn commit(app: &AppHandle, from: &str, to: &str, kind: &str, data: Value) {
    if let Some(window) = app.get_webview_window(to) {
        deliver(&window, from, kind, data);
    }
}

fn deliver(window: &WebviewWindow, from: &str, kind: &str, data: Value) {
    let message = json!({
        "from": from,
        "type": kind,
        "data": data,
    });
    let Ok(text) = serde_json::to_string(&message) else {
        return;
    };
    // 双重编码：先得到 JSON 文本，再作为 JS 字符串字面量传入，
    // 避免引号 / 换行 / U+2028 造成的注入问题。
    let Ok(literal) = serde_json::to_string(&text) else {
        return;
    };
    let script =
        format!("globalThis.__aira_deliver && globalThis.__aira_deliver(JSON.parse({literal}))");
    if let Err(error) = window.eval(&script) {
        crate::host_err!("[aira] 投递消息失败 ({kind}): {error}");
    }
}
