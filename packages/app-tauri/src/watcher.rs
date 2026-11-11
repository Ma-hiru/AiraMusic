use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde_json::json;
use tauri::{AppHandle, Manager};

use crate::bus;

/// 窗口状态快照。Tauri 的 `WindowEvent` 只覆盖 resize/move/focus/close，
/// 缺少 show / hide / maximize / minimize / fullscreen 变化，而渲染层的
/// `RendererWindow`（common/lib/window.ts）依赖这 15 种 action 维护状态机。
///
/// 这里用 120ms 轮询 + 差分补上。注意：窗口 API 必须在主线程调用
/// （macOS 上从普通线程调用会返回 FailedToSendMessage），所以每 tick
/// 都通过 `run_on_main_thread` 投递。
pub fn spawn(app: AppHandle) {
    let previous: Arc<Mutex<HashMap<String, Snapshot>>> = Arc::new(Mutex::new(HashMap::new()));

    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(120));

        let handle = app.clone();
        let state = Arc::clone(&previous);
        let _ = app.run_on_main_thread(move || {
            let windows = handle.webview_windows();
            let mut alive: Vec<String> = Vec::with_capacity(windows.len());
            let mut guard = match state.lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };

            for (label, window) in windows {
                let Some(current) = Snapshot::read(&window) else {
                    continue;
                };
                alive.push(label.clone());

                match guard.get(&label) {
                    Some(prev) => {
                        for action in prev.diff(&current) {
                            deliver(&handle, &label, action);
                        }
                    }
                    None => {
                        if current.visible {
                            deliver(&handle, &label, "show");
                        }
                        if current.maximized {
                            deliver(&handle, &label, "maximize");
                        }
                        if current.fullscreen {
                            deliver(&handle, &label, "enter-fullscreen");
                        }
                    }
                }

                if let Some(window) = handle.get_webview_window(&label) {
                    crate::windows::remember_bounds(&handle, &label, &window);
                }
                guard.insert(label, current);
            }

            let closed: Vec<String> = guard
                .keys()
                .filter(|label| !alive.contains(label))
                .cloned()
                .collect();
            for label in closed {
                guard.remove(&label);
                deliver(&handle, &label, "close");
            }
        });
    });
}

fn deliver(app: &AppHandle, label: &str, action: &str) {
    // 与 Electron 的 MainWindowManager.deliverIPCEvent 一致：commitAll + sender=process
    bus::commit_all(
        app,
        "process",
        "bus_deliver_window_event",
        json!({ "type": label, "action": action }),
    );
}

#[derive(Clone, Copy, Default, PartialEq, Eq)]
struct Snapshot {
    visible: bool,
    maximized: bool,
    minimized: bool,
    fullscreen: bool,
    focused: bool,
}

impl Snapshot {
    fn read(window: &tauri::WebviewWindow) -> Option<Self> {
        Some(Self {
            visible: window.is_visible().ok()?,
            maximized: window.is_maximized().ok()?,
            minimized: window.is_minimized().ok()?,
            fullscreen: window.is_fullscreen().ok()?,
            focused: window.is_focused().ok()?,
        })
    }

    fn diff(&self, next: &Self) -> Vec<&'static str> {
        let mut actions = Vec::new();

        if self.visible != next.visible {
            actions.push(if next.visible { "show" } else { "hide" });
        }
        if self.maximized != next.maximized {
            actions.push(if next.maximized {
                "maximize"
            } else {
                "unmaximize"
            });
        }
        if self.minimized != next.minimized {
            actions.push(if next.minimized {
                "minimize"
            } else {
                "unminimize"
            });
        }
        if self.fullscreen != next.fullscreen {
            actions.push(if next.fullscreen {
                "enter-fullscreen"
            } else {
                "leave-fullscreen"
            });
        }
        if self.focused != next.focused {
            actions.push(if next.focused { "focus" } else { "blur" });
        }

        actions
    }
}
