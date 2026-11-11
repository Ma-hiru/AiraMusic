//! 应用生命周期：退出编排、关闭语义、重开与重启。
//!
//! 对应 Electron `entry/app.ts` 的 `MainApp`：
//! - 退出顺序：关闭非主窗口 → 通知主渲染层（`message_dispatch_should_close`，最多等 5s）
//!   → 停 agent → 停 store → `app.exit(code)`；10s 兜底强退。
//! - 主窗口关闭：macOS 只隐藏；win/linux 隐藏并请渲染层自行退出。
//! - `before-quit`（这里对应 `RunEvent::ExitRequested`）：焦点不在主窗口时先收起那个窗口。
//! - 托盘 / 渲染层都可以触发退出，走同一条路径。

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use serde_json::json;
use tauri::{AppHandle, Manager};

/// 与 `MainExitCodeConstants` 对齐
pub const EXIT_NORMAL: i32 = 0;
pub const EXIT_SIGTERM: i32 = 6;
pub const EXIT_SIGINT: i32 = 7;

static QUITTING: AtomicBool = AtomicBool::new(false);
static EXITING: AtomicBool = AtomicBool::new(false);
static RENDERER_EXITED: AtomicBool = AtomicBool::new(false);
static FINISHED: AtomicBool = AtomicBool::new(false);
/// 退出线程已经走到 `app.exit()`：只有这次 ExitRequested 允许真正退出。
/// （窗口全部销毁也会触发一次 ExitRequested，那次必须拦住，否则会跳过落盘与子进程收尾）
static FINAL_EXIT: AtomicBool = AtomicBool::new(false);

pub fn is_quitting() -> bool {
    QUITTING.load(Ordering::SeqCst)
}

/// 是否已经进入「最后一次 app.exit()」——`ExitRequested` 据此决定放行还是拦截
pub fn is_final_exit() -> bool {
    FINAL_EXIT.load(Ordering::SeqCst)
}

pub fn renderer_exited() -> bool {
    RENDERER_EXITED.load(Ordering::SeqCst)
}

pub fn mark_renderer_exited() {
    RENDERER_EXITED.store(true, Ordering::SeqCst);
}

/// 主窗口 close-request。返回 `true` 表示拦截（窗口不销毁）。
pub fn handle_close_requested(app: &AppHandle, label: &str) -> bool {
    // 退出流程中 / 渲染层已经退出：放行，让窗口真正关闭
    if QUITTING.load(Ordering::SeqCst) || renderer_exited() {
        return false;
    }
    // 只有主窗口是「关掉 = 隐藏」；其余窗口销毁（与 Electron 一致）
    if label != "main" {
        return false;
    }

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    // win/linux：主窗口关闭时请渲染层自己走退出流程（它退出后会关闭窗口）
    if !cfg!(target_os = "macos") {
        crate::bus::commit(
            app,
            "process",
            "main",
            "message_dispatch_should_close",
            json!(true),
        );
    }
    true
}

/// `MainApp.exit(code)`：可重复调用，只有第一次生效。
pub fn request_exit(app: &AppHandle, code: i32) {
    if EXITING.swap(true, Ordering::SeqCst) {
        return;
    }
    QUITTING.store(true, Ordering::SeqCst);

    let app = app.clone();
    std::thread::spawn(move || {
        // 兜底：任何一步卡住都要在 10s 后强退（Electron 同款 deadline）
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(10));
            if !FINISHED.load(Ordering::SeqCst) {
                crate::host_err!("[exit] 清理超时，强制退出");
                std::process::exit(code);
            }
        });

        // 1. 先让界面立刻消失：隐藏主窗口、关闭其余窗口。
        //    播放快照异步写入原生存储，其余浏览器状态仍需要 WebKit 收尾。
        hide_main_window(&app);
        close_secondary_windows(&app);

        // 2. 保存完成前保留缓存服务，避免渲染层收尾时的请求被中断。
        wait_renderer_exit(&app);

        // 3. 停子进程（各自内部已有超时）。
        crate::services::agent::stop();
        crate::services::store::stop();
        crate::host_log!("[exit] 子进程已停止");

        crate::host_log!("[exit] 退出码 {code}");
        FINISHED.store(true, Ordering::SeqCst);
        FINAL_EXIT.store(true, Ordering::SeqCst);
        app.exit(code);
    });
}

/// `MainApp.restart()`：先走同一条清理流程，再让 Tauri 重新拉起进程。
pub fn request_restart(app: &AppHandle) {
    if EXITING.swap(true, Ordering::SeqCst) {
        return;
    }
    QUITTING.store(true, Ordering::SeqCst);

    let app = app.clone();
    std::thread::spawn(move || {
        close_secondary_windows(&app);
        wait_renderer_exit(&app);
        crate::services::agent::stop();
        crate::services::store::stop();
        FINISHED.store(true, Ordering::SeqCst);
        FINAL_EXIT.store(true, Ordering::SeqCst);
        app.restart();
    });
}

/// 退出第一步：立刻隐藏主窗口（不等渲染层，避免界面卡住几百毫秒到两秒）
fn hide_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        crate::host_log!("[exit] 先隐藏主窗口");
        let _ = window.hide();
    }
}

fn close_secondary_windows(app: &AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        for (label, window) in handle.webview_windows() {
            if label != "main" {
                let _ = window.close();
            }
        }
    });
}

fn wait_renderer_exit(app: &AppHandle) {
    if RENDERER_EXITED.load(Ordering::SeqCst) {
        return;
    }
    crate::host_log!("[exit] 通知渲染层保存（message_dispatch_should_close），最多等 5s");
    crate::bus::commit(
        app,
        "process",
        "main",
        "message_dispatch_should_close",
        json!(true),
    );
    let deadline = Instant::now() + Duration::from_secs(5);
    let acknowledged = loop {
        if RENDERER_EXITED.load(Ordering::SeqCst) {
            break true;
        }
        if Instant::now() >= deadline {
            break false;
        }
        std::thread::sleep(Duration::from_millis(50));
    };

    if !acknowledged {
        crate::host_err!("[exit] 等渲染层保存超时（5s），继续退出");
        return;
    }
    // 播放快照已由原生存储确认落盘；设置等状态仍使用 localStorage。
    // 渲染层的 `localStorage.setItem` 是同步调用，但 **WebKit 把 localStorage
    // 落盘是异步的**：进程结束太快，最近一次写入会丢（表现就是「偶尔才保存」）。
    // 这里主动销毁主窗口，让 WKWebView 走正常 teardown 把存储刷到磁盘，
    // 然后留一小段余量再退出（原版是固定等 2s）。
    if let Some(window) = app.get_webview_window("main") {
        crate::host_log!("[exit] 关闭主窗口，让 WebKit 把 localStorage 刷盘");
        let _ = window.close();
    }
    let deadline = Instant::now() + Duration::from_millis(1500);
    while Instant::now() < deadline {
        // 窗口销毁后 `get_webview_window` 就取不到了
        if app.get_webview_window("main").is_none() {
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    // 窗口已销毁但界面早就隐藏了，这段用户看不到：多给 WebKit 一点时间把
    // localStorage 的 SQLite 刷完，避免「偶尔才保存」
    std::thread::sleep(Duration::from_millis(800));
}

/// Cmd+Q 的窗口语义（对应原版 `before-quit`）。
///
/// 原版规则：焦点窗口不是 main → 取消退出并处理那个窗口
/// （tray 只 blur、miniplayer 只 hide、其它 close）。这里按「窗口即退出单位」调整：
///
/// - 焦点在 **main / miniplayer / radio**（播放器窗口，mini 与 radio 等同 main）
///   → 走完整退出流程（渲染层收到 `message_dispatch_should_close` 才有机会保存）
/// - 焦点在 **tray**（临时弹窗，不参与判定）或没有任何窗口有焦点 → 同样走完整退出
/// - 焦点在其它窗口（lyric / display / comments / agent / image / about / login / external）
///   → 只关掉这一个窗口，应用继续运行
///
/// 返回 `true` 表示本次退出已被拦下（即只关了单个窗口）。
pub fn handle_before_quit(app: &AppHandle) -> bool {
    let focused = app
        .webview_windows()
        .into_iter()
        .find(|(_, window)| window.is_focused().unwrap_or(false));
    let Some((label, window)) = focused else {
        return false;
    };

    match quit_decision(Some(&label)) {
        QuitDecision::Quit => false,
        QuitDecision::CloseFocused => {
            crate::host_log!("[exit] Cmd+Q 只关闭焦点窗口: {label}");
            let _ = window.close();
            true
        }
    }
}

/// Cmd+Q 时对「焦点窗口」的处置
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum QuitDecision {
    /// 整体退出（走保存 + 清理流程）
    Quit,
    /// 只关掉这个窗口，应用继续运行
    CloseFocused,
}

/// 判定规则（纯函数，便于测试）：
/// - 没有焦点 / main / miniplayer / radio（播放器窗口等同 main）/ tray（临时弹窗不参与判定）→ 整体退出
/// - 其余窗口 → 只关它
pub fn quit_decision(focused: Option<&str>) -> QuitDecision {
    match focused {
        None | Some("main") | Some("miniplayer") | Some("radio") | Some("tray") => {
            QuitDecision::Quit
        }
        Some(_) => QuitDecision::CloseFocused,
    }
}

/// macOS 点击 Dock 图标（`RunEvent::Reopen`）：把主窗口拉出来。
pub fn handle_reopen(app: &AppHandle) {
    if let Err(error) = crate::windows::create(app, "main") {
        crate::host_err!("[exit] 重开主窗口失败: {error}");
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// 渲染层发来的 `message_dispatch_should_close`。返回 `true` 表示已消费。
pub fn handle_should_close(app: &AppHandle, data: &serde_json::Value) -> bool {
    if !crate::ncm::util::to_boolean(data) {
        return true;
    }
    crate::host_err!("[exit] 渲染层请求退出");
    request_exit(app, EXIT_NORMAL);
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exit_codes_match_electron() {
        assert_eq!(EXIT_NORMAL, 0);
        assert_eq!(EXIT_SIGTERM, 6);
        assert_eq!(EXIT_SIGINT, 7);
    }

    #[test]
    fn quit_decision_matches_window_rules() {
        // 播放器窗口等同 main；tray 不参与判定
        for label in ["main", "miniplayer", "radio", "tray"] {
            assert_eq!(
                quit_decision(Some(label)),
                QuitDecision::Quit,
                "{label} 应触发整体退出"
            );
        }
        assert_eq!(quit_decision(None), QuitDecision::Quit, "没有焦点也应退出");

        // 其余窗口只关自己
        for label in [
            "lyric", "display", "comments", "agent", "image", "about", "login", "external",
        ] {
            assert_eq!(
                quit_decision(Some(label)),
                QuitDecision::CloseFocused,
                "{label} 应只关闭窗口"
            );
        }
    }

    #[test]
    fn renderer_exited_flag_is_sticky() {
        mark_renderer_exited();
        assert!(renderer_exited());
    }
}
