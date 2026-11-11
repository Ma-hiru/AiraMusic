//! `MainAgentContext` 的 Rust 版：跟踪主窗口上报的「当前页面」与「正在播放」。
//!
//! 渲染层的消息经 `aira_message_send` 流经宿主，这里只旁路观察
//! `bus_deliver_focus_context` / `bus_deliver_track_meta`，不影响正常转发。

use std::collections::BTreeMap;
use std::sync::{Mutex, OnceLock};

use serde_json::{json, Map, Value};
use tauri::{AppHandle, Manager};

const TEXT_MAX: usize = 512;

struct Entry {
    window: &'static str,
    context: Value,
}

#[derive(Default)]
struct State {
    pages: BTreeMap<&'static str, Entry>,
    last_focused: Option<&'static str>,
    current_track: Option<Value>,
    track_from_main: bool,
}

fn state() -> &'static Mutex<State> {
    static STATE: OnceLock<Mutex<State>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(State::default()))
}

static APP: OnceLock<AppHandle> = OnceLock::new();

fn app() -> Option<&'static AppHandle> {
    APP.get()
}

pub fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
}

fn clamp(value: Option<&Value>) -> Option<String> {
    let text = value?.as_str()?.trim();
    if text.is_empty() {
        return None;
    }
    Some(text.chars().take(TEXT_MAX).collect())
}

/// 校验渲染层上报的焦点上下文（对应 `focusContextSchema`）
fn valid_context(data: &Value) -> Option<Value> {
    let object = data.as_object()?;
    let page = object.get("page")?.as_str()?;
    let positive = |key: &str| {
        object
            .get(key)
            .and_then(Value::as_u64)
            .filter(|value| *value > 0)
    };

    let mut out = Map::new();
    out.insert("page".into(), json!(page));
    match page {
        "home" | "hidden" | "settings" => {}
        "search" => {
            out.insert("keyword".into(), json!(clamp(object.get("keyword"))?));
        }
        "album" | "artist" => {
            out.insert("id".into(), json!(positive("id")?));
            out.insert("name".into(), json!(clamp(object.get("name"))?));
        }
        "playlist" => {
            let id = object.get("id").cloned().unwrap_or(Value::Null);
            if !(id.is_null() || id.as_u64().map(|value| value > 0).unwrap_or(false)) {
                return None;
            }
            out.insert("id".into(), id);
            if let Some(name) = clamp(object.get("name")) {
                out.insert("name".into(), json!(name));
            }
            let source = object.get("source")?.as_str()?;
            if source != "normal" && source != "user-liked-track" {
                return None;
            }
            out.insert("source".into(), json!(source));
        }
        "comments" => {
            out.insert("id".into(), json!(positive("id")?));
            let kind = object.get("type")?.as_str()?;
            if !["album", "track", "playlist"].contains(&kind) {
                return None;
            }
            out.insert("type".into(), json!(kind));
        }
        "history" => {
            let recent = object.get("recent")?.as_array()?;
            if recent.len() > 20 {
                return None;
            }
            let mut rows = Vec::new();
            for row in recent {
                rows.push(json!({
                    "id": row.get("id")?.as_u64().filter(|value| *value > 0)?,
                    "name": clamp(row.get("name"))?,
                    "time": clamp(row.get("time"))?,
                    "playDuration": clamp(row.get("playDuration"))?,
                }));
            }
            out.insert("recent".into(), Value::Array(rows));
        }
        _ => return None,
    }
    Some(Value::Object(out))
}

fn window_type(from: &str) -> Option<&'static str> {
    match from {
        "main" => Some("main"),
        "display" => Some("display"),
        "comments" => Some("comments"),
        _ => None,
    }
}

/// 旁路观察一条消息。返回 `true` 表示已消费（不继续转发）。
///
/// 焦点上下文只从 main/display/comments 采信；播放摘要只从 main 采信。
pub fn observe(from: &str, kind: &str, data: &Value) -> bool {
    match kind {
        "bus_deliver_track_meta" => {
            if from != "main" {
                return false;
            }
            let track = data.get("track").cloned().unwrap_or(Value::Null);
            let summary = if track.is_null() {
                Value::Null
            } else {
                let artists: Vec<Value> = track
                    .get("detail")
                    .and_then(|detail| detail.get("ar"))
                    .and_then(Value::as_array)
                    .map(|items| {
                        items
                            .iter()
                            .take(10)
                            .filter_map(|item| item.get("name").and_then(Value::as_str))
                            .map(|name| json!(name.chars().take(128).collect::<String>()))
                            .collect()
                    })
                    .unwrap_or_default();
                json!({
                    "id": track.get("id").cloned().unwrap_or(Value::Null),
                    "name": track
                        .get("name")
                        .and_then(Value::as_str)
                        .map(|name| name.chars().take(TEXT_MAX).collect::<String>())
                        .unwrap_or_default(),
                    "artists": artists,
                })
            };
            if let Ok(mut guard) = state().lock() {
                guard.current_track = Some(summary);
                guard.track_from_main = true;
            }
            // 播放摘要仍要转发给其他窗口
            false
        }
        "bus_deliver_focus_context" => {
            let Some(kind) = window_type(from) else {
                // 非 main/display/comments 的上报没有意义，但仍然消费掉（Electron 同行为）
                return true;
            };
            let Some(context) = valid_context(data) else {
                return true;
            };
            let hidden = context.get("page").and_then(Value::as_str) == Some("hidden");
            let focused = app()
                .and_then(|app| app.get_webview_window(from))
                .map(|window| window.is_focused().unwrap_or(false))
                .unwrap_or(false);
            if let Ok(mut guard) = state().lock() {
                if hidden {
                    guard.pages.remove(kind);
                } else {
                    guard.pages.insert(
                        kind,
                        Entry {
                            window: kind,
                            context,
                        },
                    );
                    if focused {
                        guard.last_focused = Some(kind);
                    }
                }
            }
            // 焦点上下文只给宿主用（与 Electron 的 checker 一致：不转发）
            true
        }
        _ => false,
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Availability {
    Visible,
    Hidden,
}

fn availability(window: &str) -> Option<Availability> {
    let window = app()?.get_webview_window(window)?;
    if !window.is_visible().unwrap_or(false) || window.is_minimized().unwrap_or(false) {
        return Some(Availability::Hidden);
    }
    Some(Availability::Visible)
}

/// `MainAgentContext.snapshot()`
pub fn snapshot() -> Value {
    let guard = match state().lock() {
        Ok(guard) => guard,
        Err(_) => return json!({ "window": null, "page": null, "currentTrack": null }),
    };

    let available: Vec<&'static str> = guard
        .pages
        .iter()
        .filter(|(_, entry)| availability(entry.window) == Some(Availability::Visible))
        .map(|(kind, _)| *kind)
        .collect();

    let focused = available.iter().copied().find(|kind| {
        app()
            .and_then(|app| app.get_webview_window(kind))
            .map(|window| window.is_focused().unwrap_or(false))
            .unwrap_or(false)
    });

    let selected = focused
        .or_else(|| guard.last_focused.filter(|kind| available.contains(kind)))
        .or_else(|| available.iter().copied().find(|kind| *kind == "main"))
        .or_else(|| available.first().copied());

    let (window, page) = match selected {
        Some(kind) => (
            json!(kind),
            guard
                .pages
                .get(kind)
                .map(|entry| entry.context.clone())
                .unwrap_or(Value::Null),
        ),
        None => (Value::Null, Value::Null),
    };

    let main_alive = app()
        .and_then(|app| app.get_webview_window("main"))
        .is_some();
    let current_track = if guard.track_from_main && main_alive {
        guard.current_track.clone().unwrap_or(Value::Null)
    } else {
        Value::Null
    };

    json!({
        "window": window,
        "page": page,
        "currentTrack": current_track,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_home_and_search_contexts() {
        assert_eq!(
            valid_context(&json!({"page": "home"})).unwrap()["page"],
            json!("home")
        );
        let search = valid_context(&json!({"page": "search", "keyword": "周杰伦"})).unwrap();
        assert_eq!(search["keyword"], json!("周杰伦"));
    }

    #[test]
    fn rejects_malformed_contexts() {
        assert!(valid_context(&json!({"page": "search"})).is_none());
        assert!(valid_context(&json!({"page": "album", "id": 0, "name": "x"})).is_none());
        assert!(valid_context(&json!({"page": "playlist", "id": 1, "source": "bad"})).is_none());
        assert!(valid_context(&json!({"page": "unknown"})).is_none());
        assert!(valid_context(&json!({})).is_none());
    }

    #[test]
    fn playlist_allows_null_id() {
        let value =
            valid_context(&json!({"page": "playlist", "id": null, "source": "normal"})).unwrap();
        assert!(value["id"].is_null());
        assert_eq!(value["source"], json!("normal"));
    }

    #[test]
    fn history_rows_are_bounded() {
        let recent: Vec<Value> = (1..=3)
            .map(|index| json!({"id": index, "name": "n", "time": "t", "playDuration": "30"}))
            .collect();
        let value = valid_context(&json!({"page": "history", "recent": recent})).unwrap();
        assert_eq!(value["recent"].as_array().unwrap().len(), 3);
    }

    #[test]
    fn text_is_truncated() {
        let long = "字".repeat(600);
        let value = valid_context(&json!({"page": "search", "keyword": long})).unwrap();
        assert_eq!(value["keyword"].as_str().unwrap().chars().count(), TEXT_MAX);
    }

    #[test]
    fn focus_context_is_consumed_but_track_meta_is_forwarded() {
        // 焦点上下文由宿主消费；来自 lyric 的消息也消费（与 Electron 的 checker 一致）
        assert!(observe(
            "lyric",
            "bus_deliver_focus_context",
            &json!({"page": "home"})
        ));
        assert!(observe(
            "main",
            "bus_deliver_focus_context",
            &json!({"page": "home"})
        ));
        // 播放摘要不消费，继续转发
        assert!(!observe(
            "main",
            "bus_deliver_track_meta",
            &json!({"track": null})
        ));
        assert!(!observe("main", "message_other", &json!({})));
    }
}
