use serde_json::json;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::{AppHandle, Manager};

use crate::bus;
use crate::windows;

/// 托盘菜单项 id（托盘图标与 macOS 胶囊右键共用同一套）
const ITEM_SHOW_MAIN: &str = "show-main";
const ITEM_UNLOCK_LYRIC: &str = "unlock-lyric";
const ITEM_QUIT: &str = "quit";
const ITEM_PLAY: &str = "player-play";
const ITEM_PAUSE: &str = "player-pause";
const ITEM_PREVIOUS: &str = "player-previous";
const ITEM_NEXT: &str = "player-next";

/// 托盘入口。
///
/// 关键职责是 D2 方案 B 的落地：歌词窗口锁定后完全穿透，唯一能触达的
/// 交互入口就是这里。菜单项「解锁歌词」向 lyric 窗口下发一条
/// `bus_deliver_lyric_lock`，渲染层收到后解锁并把窗口恢复为可交互。
///
/// macOS 上不再创建 Tauri 托盘图标：状态栏项由
/// [`crate::platform_macos::menubar`] 的原生胶囊承担（图标 + 歌词合并），
/// 与原版 `DarwinTray` 一致 —— 两个都建会出现两个图标。
pub fn init(app: &AppHandle) -> tauri::Result<()> {
    init_impl(app)
}

/// macOS：胶囊本身就是状态栏项，不再创建 Tauri 托盘图标（否则会出现两个图标）。
/// 右键由 [`popup_menu`] 弹原生菜单，「解锁歌词」等入口与托盘图标版本一致。
#[cfg(target_os = "macos")]
fn init_impl(app: &AppHandle) -> tauri::Result<()> {
    crate::tray_capsule::init(app);
    let handle = app.clone();
    crate::platform_macos::menubar::set_event_handler(move |event| {
        on_capsule_event(&handle, event);
    });
    // 胶囊右键弹原生菜单，菜单事件统一走全局处理器
    app.on_menu_event(|app, event| handle_menu_event(app, event.id().as_ref()));
    install_outside_click_dismiss(app);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn init_impl(app: &AppHandle) -> tauri::Result<()> {
    use tauri::tray::{TrayIconBuilder, TrayIconEvent};

    let menu = build_menu(app, None)?;
    let mut builder = TrayIconBuilder::with_id("aira-tray")
        .tooltip(crate::tray_capsule::app_name())
        .menu(&menu)
        // 左键弹托盘窗口（原版托盘窗的行为），右键才出原生菜单
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| handle_menu_event(app, event.id().as_ref()))
        .on_tray_icon_event(|tray, event| {
            let app = tray.app_handle();
            match event {
                // 左键：在图标下方弹出托盘窗口（再点一次收起）。
                // 300ms 去抖，双击时取消 —— 与原版 `debounce(showMenu, 300)` 一致，
                // 否则一次双击会先开面板再被双击逻辑抢走焦点。
                TrayIconEvent::Click {
                    rect,
                    button: tauri::tray::MouseButton::Left,
                    ..
                } => {
                    let scale = app
                        .get_webview_window("main")
                        .and_then(|window| window.scale_factor().ok())
                        .unwrap_or(1.0);
                    schedule_tray_toggle(app, anchor_from_rect(rect, scale));
                }
                // 双击：唤起主窗口并收起迷你播放器（原版 win32.ts）
                TrayIconEvent::DoubleClick { .. } => {
                    cancel_scheduled_toggle();
                    show_main(app);
                    hide_miniplayer(app);
                }
                _ => {}
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    let tray = builder.build(app)?;
    if let Ok(mut guard) = tray_slot().lock() {
        *guard = Some(tray);
    }
    Ok(())
}

/// 托盘点击去抖代数：每次点击 +1，双击时再 +1 让待执行的点击作废
#[cfg_attr(target_os = "macos", allow(dead_code))]
static TRAY_CLICK_GEN: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

#[cfg_attr(target_os = "macos", allow(dead_code))]
fn cancel_scheduled_toggle() {
    TRAY_CLICK_GEN.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
}

/// 延迟 300ms 再开面板：双击会在这之前 cancel
#[cfg_attr(target_os = "macos", allow(dead_code))]
fn schedule_tray_toggle(app: &AppHandle, anchor: Anchor) {
    use std::sync::atomic::Ordering;

    let generation = TRAY_CLICK_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(300));
        if TRAY_CLICK_GEN.load(Ordering::SeqCst) != generation {
            return;
        }
        let target = handle.clone();
        let _ = handle
            .run_on_main_thread(move || toggle_tray_window(&target, anchor, Placement::BelowIcon));
    });
}

/// 显示主窗口（已存在则前置）
fn show_main(app: &AppHandle) {
    if let Err(error) = windows::create(app, "main") {
        crate::host_err!("[aira] 显示主窗口失败: {error}");
    }
}

/// 菜单项动作。托盘图标与胶囊右键共用。
fn handle_menu_event(app: &AppHandle, id: &str) {
    match id {
        ITEM_SHOW_MAIN => {
            show_main(app);
            hide_miniplayer(app);
        }
        ITEM_UNLOCK_LYRIC => {
            bus::commit(
                app,
                "process",
                "lyric",
                "bus_deliver_lyric_lock",
                json!(false),
            );
        }
        ITEM_PLAY => dispatch_player(app, "play"),
        ITEM_PAUSE => dispatch_player(app, "pause"),
        ITEM_PREVIOUS => dispatch_player(app, "previous"),
        ITEM_NEXT => dispatch_player(app, "next"),
        ITEM_QUIT => crate::lifecycle::request_exit(app, crate::lifecycle::EXIT_NORMAL),
        // macOS 应用菜单的「退出」（Cmd+Q）：按焦点窗口决定关窗还是整体退出
        crate::app_menu::MENU_APP_QUIT => {
            if crate::lifecycle::handle_before_quit(app) {
                return;
            }
            crate::lifecycle::request_exit(app, crate::lifecycle::EXIT_NORMAL);
        }
        _ => {}
    }
}

/// 播放控制统一走 `bus_dispatch_player_action`（主窗口执行），与原版菜单一致
fn dispatch_player(app: &AppHandle, action: &str) {
    bus::commit(
        app,
        "process",
        "main",
        "bus_dispatch_player_action",
        json!(action),
    );
}

fn hide_miniplayer(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("miniplayer") {
        let _ = window.hide();
    }
}

/// 托盘菜单随播放状态刷新。
///
/// macOS 的胶囊右键菜单是「按需构建」，不需要缓存；其他平台是常驻 `TrayIcon`，
/// 得在收到 meta 时重建，否则「播放 / 暂停」文案永远是启动时那一份。
pub fn observe(kind: &str, data: &serde_json::Value) {
    if kind != "bus_deliver_track_meta" {
        return;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let player = player_state_from(data);
        let Ok(guard) = tray_slot().lock() else {
            return;
        };
        let Some(tray) = guard.as_ref() else { return };
        match build_menu(&app_of(tray), Some(player)) {
            Ok(menu) => {
                if let Err(error) = tray.set_menu(Some(menu)) {
                    crate::host_err!("[tray] 重建托盘菜单失败: {error}");
                }
            }
            Err(error) => crate::host_err!("[tray] 构建托盘菜单失败: {error}"),
        }
    }
    #[cfg(target_os = "macos")]
    let _ = data;
}

/// 非 macOS：托盘图标句柄（重建菜单要 `set_menu`）
#[cfg(not(target_os = "macos"))]
fn tray_slot() -> &'static std::sync::Mutex<Option<tauri::tray::TrayIcon<tauri::Wry>>> {
    static SLOT: std::sync::OnceLock<std::sync::Mutex<Option<tauri::tray::TrayIcon>>> =
        std::sync::OnceLock::new();
    SLOT.get_or_init(|| std::sync::Mutex::new(None))
}

#[cfg(not(target_os = "macos"))]
fn app_of(tray: &tauri::tray::TrayIcon<tauri::Wry>) -> AppHandle {
    use tauri::Manager;
    tray.app_handle().clone()
}

/// 从 meta 里取播放状态（不依赖胶囊模块，托盘在非 macOS 也能用）
#[cfg(not(target_os = "macos"))]
fn player_state_from(data: &serde_json::Value) -> crate::tray_capsule::PlayerState {
    crate::tray_capsule::PlayerState {
        playing: data.get("status").and_then(serde_json::Value::as_str) == Some("playing"),
        has_track: data
            .get("track")
            .and_then(|track| track.get("id"))
            .and_then(serde_json::Value::as_i64)
            .is_some(),
    }
}

/// 托盘菜单（对应原版 `showRawMenu` 的「控制 / 显示 / 退出」三组）。
///
/// 原版在 Linux 用 `tray.setContextMenu`、Windows 用自定义面板；这里统一成
/// 「原生菜单 + 左键面板」两套入口，播放项随 meta 刷新（`observe`）。
/// 评论 / 复制三项留在面板里（面板本来就提供，避免重复实现）。
fn build_menu(
    app: &AppHandle,
    player: Option<crate::tray_capsule::PlayerState>,
) -> tauri::Result<Menu<tauri::Wry>> {
    let name = crate::tray_capsule::app_name();
    let show_main = MenuItem::with_id(app, ITEM_SHOW_MAIN, "显示主窗口", true, None::<&str>)?;
    let unlock_lyric = MenuItem::with_id(app, ITEM_UNLOCK_LYRIC, "解锁歌词", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, ITEM_QUIT, format!("退出 {name}"), true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    let Some(player) = player else {
        return Menu::with_items(app, &[&show_main, &unlock_lyric, &separator, &quit]);
    };

    let toggle = if player.playing {
        MenuItem::with_id(app, ITEM_PAUSE, "暂停", true, None::<&str>)?
    } else {
        MenuItem::with_id(app, ITEM_PLAY, "播放", true, None::<&str>)?
    };
    // 没有在放的曲目时，上一首/下一首没有可执行对象
    let seekable = player.has_track;
    let previous = MenuItem::with_id(app, ITEM_PREVIOUS, "上一首", seekable, None::<&str>)?;
    let next = MenuItem::with_id(app, ITEM_NEXT, "下一首", seekable, None::<&str>)?;
    Menu::with_items(
        app,
        &[
            &toggle,
            &previous,
            &next,
            &separator,
            &show_main,
            &unlock_lyric,
            &separator,
            &quit,
        ],
    )
}

/// 菜单项的 id 序列（`/__tray_menu` 自检用：确认「解锁歌词」等入口真的建出来了）
pub fn menu_item_ids(app: &AppHandle) -> Vec<String> {
    let Ok(menu) = build_menu(app, Some(crate::tray_capsule::player_state())) else {
        return Vec::new();
    };
    menu.items()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_menuitem().map(|item| item.id().0.clone()))
                .collect()
        })
        .unwrap_or_default()
}

/// macOS 胶囊点击：单击/右键开菜单（托盘窗口 / 原生菜单），双击回到主窗口。
///
/// `pub(crate)` 是为了让 `/__capsule_click` 能注入一次合成的点击事件做自检。
#[cfg(target_os = "macos")]
pub(crate) fn on_capsule_event(
    app: &AppHandle,
    event: crate::platform_macos::menubar::MenuLyricEvent,
) {
    // 同一次物理点击偶尔会被投递两次（状态栏窗口未成为 key window 时的
    // click-through 会补发一次 mouseDown）。两次 toggle 会让窗口开了又立刻收起，
    // 所以对同一种 kind 做 80ms 去重；真正的双击是两下（间隔 >100ms 或 kind 已变）。
    {
        use std::sync::Mutex;
        use std::time::{Duration, Instant};
        static LAST: Mutex<Option<(Instant, String)>> = Mutex::new(None);
        let now = Instant::now();
        let mut guard = match LAST.lock() {
            Ok(guard) => guard,
            Err(_) => return,
        };
        let duplicate = guard
            .as_ref()
            .map(|(at, kind)| {
                kind == &event.kind && now.duration_since(*at) < Duration::from_millis(80)
            })
            .unwrap_or(false);
        if duplicate {
            crate::host_log!("[tray] 忽略重复的胶囊事件: {}", event.kind);
            return;
        }
        *guard = Some((now, event.kind.clone()));
    }

    crate::host_log!(
        "[tray] 胶囊事件 {} display={} rect={:.0},{:.0} {:.0}x{:.0}",
        event.kind,
        event.display_id,
        event.x,
        event.y,
        event.width,
        event.height
    );
    match event.kind.as_str() {
        "double-click" => {
            let handle = app.clone();
            let _ = app.run_on_main_thread(move || show_main(&handle));
        }
        "right-click" => {
            let handle = app.clone();
            let _ = app.run_on_main_thread(move || popup_menu(&handle));
        }
        // 单击：在胶囊下方弹出托盘窗口（再点一次收起）
        _ => {
            let handle = app.clone();
            let anchor = capsule_anchor(app, &event);
            let _ = app.run_on_main_thread(move || {
                toggle_tray_window(&handle, anchor, Placement::WorkAreaTop)
            });
        }
    }
}

/// 胶囊的 AppKit 矩形（左下原点，逻辑点）→ 左上原点全局坐标。
///
/// 与 Electron 的 `resolveDisplay` 同一套换算：`主屏高度 - y - height`。
#[cfg(target_os = "macos")]
fn capsule_anchor(
    app: &AppHandle,
    event: &crate::platform_macos::menubar::MenuLyricEvent,
) -> Anchor {
    let primary_height = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|monitor| monitor.size().height as f64 / monitor.scale_factor())
        .unwrap_or(0.0);
    Anchor {
        x: event.x,
        y: primary_height - event.y - event.height,
        width: event.width,
        height: event.height,
    }
}

/// 弹出胶囊右键的原生菜单（在光标处）
#[cfg(target_os = "macos")]
fn popup_menu(app: &AppHandle) {
    use tauri::menu::ContextMenu;

    // muda 需要一块 NSView 作为挂载点，用任意存活窗口即可（菜单在光标处弹出）
    let Some(webview_window) = app
        .get_webview_window("main")
        .or_else(|| app.get_webview_window("lyric"))
        .or_else(|| app.get_webview_window("tray"))
    else {
        crate::host_err!("[tray] 没有可用的窗口挂载右键菜单");
        return;
    };
    // WebviewWindow → Window：muda 的 popup 只接受 Window
    let window = AsRef::<tauri::Webview>::as_ref(&webview_window).window();
    match build_menu(app, Some(crate::tray_capsule::player_state())) {
        Ok(menu) => {
            if let Err(error) = menu.popup(window) {
                crate::host_err!("[tray] 弹出菜单失败: {error}");
            }
        }
        Err(error) => crate::host_err!("[tray] 构建菜单失败: {error}"),
    }
}

/// 托盘窗口出现的相对位置策略
#[derive(Clone, Copy, PartialEq)]
enum Placement {
    /// 图标正下方（Windows/Linux 托盘，图标在工作区角落）
    #[cfg_attr(target_os = "macos", allow(dead_code))]
    BelowIcon,
    /// 目标屏工作区顶边（macOS 菜单栏正下方，胶囊所在屏）
    WorkAreaTop,
}

/// 锚点：逻辑像素、左上原点全局坐标
#[derive(Clone, Copy)]
struct Anchor {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
fn anchor_from_rect(rect: tauri::Rect, scale: f64) -> Anchor {
    let scale = if scale > 0.0 { scale } else { 1.0 };
    let (x, y) = match rect.position {
        tauri::Position::Physical(position) => {
            (position.x as f64 / scale, position.y as f64 / scale)
        }
        tauri::Position::Logical(position) => (position.x, position.y),
    };
    let (width, height) = match rect.size {
        tauri::Size::Physical(size) => (size.width as f64 / scale, size.height as f64 / scale),
        tauri::Size::Logical(size) => (size.width, size.height),
    };
    Anchor {
        x,
        y,
        width,
        height,
    }
}

/// 命中锚点所在的显示器（按逻辑坐标比对，避开物理/逻辑混用）
fn monitor_at(app: &AppHandle, x: f64, y: f64) -> Option<tauri::Monitor> {
    let monitors = app.available_monitors().ok()?;
    for monitor in monitors {
        let scale = monitor.scale_factor();
        let left = monitor.position().x as f64 / scale;
        let top = monitor.position().y as f64 / scale;
        let width = monitor.size().width as f64 / scale;
        let height = monitor.size().height as f64 / scale;
        if x >= left && x <= left + width && y >= top && y <= top + height {
            return Some(monitor);
        }
    }
    None
}

/// 失焦自动收起（原版 `trayWin.addListener("blur", hideCustomMenu)`）。
///
/// 每个新建面板注册一次，窗口销毁重建时重新注册。
fn install_blur_hide(window: &tauri::WebviewWindow) {
    use std::sync::atomic::{AtomicBool, Ordering};
    // 只有「真的获得过焦点」之后的失焦才算用户点到别处。
    // 合成点击 / 应用不在前台时，show() 可能拿不到焦点并立刻补一条失焦事件，
    // 直接按失焦收窗会让面板一出现就消失。
    let seen_focus = AtomicBool::new(false);
    let target = window.clone();
    window.on_window_event(move |event| {
        let tauri::WindowEvent::Focused(focused) = event else {
            return;
        };
        crate::host_log!("[tray] 面板焦点 → {focused}");
        if *focused {
            seen_focus.store(true, Ordering::SeqCst);
        } else if seen_focus.swap(false, Ordering::SeqCst) {
            crate::host_log!("[tray] 面板失焦，收起");
            let _ = target.hide();
        }
    });
}

/// 点面板外面就收起（不依赖焦点事件的兜底）。
///
/// 全局鼠标监听只会收到「发往别的应用」的事件：托盘面板本身、以及菜单栏胶囊那种
/// 属于本进程的状态栏窗口，`window` 都非空，因此不会误判成「点外面」。
/// 鼠标事件的全局监听不需要任何权限（只有键盘事件才要）。
#[cfg(target_os = "macos")]
fn install_outside_click_dismiss(app: &AppHandle) {
    use block2::RcBlock;
    use objc2_app_kit::{NSEvent, NSEventMask};
    use std::ptr::NonNull;
    use std::sync::atomic::{AtomicBool, Ordering};

    static INSTALLED: AtomicBool = AtomicBool::new(false);
    if INSTALLED.swap(true, Ordering::SeqCst) {
        return;
    }

    let owner = app.clone();
    let block = RcBlock::new(move |event: NonNull<NSEvent>| {
        // windowNumber 非 0 = 事件挂在某个窗口上（本进程的面板 / 菜单栏胶囊），
        // 交给焦点逻辑处理，避免「点胶囊收起又立刻被 toggle 打开」。
        // 这里不用 `window()`：它要求主线程标记，而全局监听的线程不保证。
        let window_number = unsafe { event.as_ref().windowNumber() };
        if window_number != 0 {
            return;
        }
        let app = owner.clone();
        let _ = app.clone().run_on_main_thread(move || {
            if let Some(window) = app.get_webview_window("tray") {
                if window.is_visible().unwrap_or(false) {
                    crate::host_log!("[tray] 面板外点击，收起");
                    let _ = window.hide();
                }
            }
        });
    });

    let monitor = NSEvent::addGlobalMonitorForEventsMatchingMask_handler(
        NSEventMask::LeftMouseDown | NSEventMask::RightMouseDown,
        &block,
    );
    // 监听句柄与 block 都要活到进程结束：泄漏是这里的正确做法
    std::mem::forget(block);
    if let Some(monitor) = monitor {
        std::mem::forget(monitor);
    }
}

/// 托盘弹窗：定宽 180、高 540，按 `placement` 贴到锚点边上，并夹在屏幕工作区内。
fn toggle_tray_window(app: &AppHandle, anchor: Anchor, placement: Placement) {
    let window = match app.get_webview_window("tray") {
        Some(window) => {
            if window.is_visible().unwrap_or(false) {
                let _ = window.hide();
                return;
            }
            window
        }
        None => match windows::create(app, "tray") {
            Ok(window) => {
                install_blur_hide(&window);
                window
            }
            Err(error) => {
                crate::host_err!("[aira] 创建托盘窗口失败: {error}");
                return;
            }
        },
    };

    let scale = window.scale_factor().unwrap_or(1.0);
    let size = window
        .inner_size()
        .map(|size| (size.width as f64 / scale, size.height as f64 / scale))
        .unwrap_or((180.0, 540.0));

    let center_x = anchor.x + anchor.width / 2.0;
    let mut x = center_x - size.0 / 2.0;
    let mut y = anchor.y + anchor.height;

    if let Some(monitor) = monitor_at(app, center_x, anchor.y + anchor.height / 2.0)
        .or_else(|| app.primary_monitor().ok().flatten())
    {
        let area = monitor.work_area();
        let monitor_scale = monitor.scale_factor();
        let width = area.size.width as f64 / monitor_scale;
        let height = area.size.height as f64 / monitor_scale;
        let left = area.position.x as f64 / monitor_scale;
        let top = area.position.y as f64 / monitor_scale;

        x = x.clamp(left, (left + width - size.0).max(left));
        if placement == Placement::WorkAreaTop {
            y = top;
        } else {
            if y + size.1 > top + height {
                // 图标在下方时改为向上弹出
                y = anchor.y - size.1;
            }
            y = y.clamp(top, (top + height - size.1).max(top));
        }
    }

    let _ = window.set_position(tauri::LogicalPosition::new(x, y));
    let _ = window.show();
    let _ = window.set_focus();

    // 面板隐藏期间渲染层被节流，会错过 bus 推送。显示后分两步补数据：
    // 1. 宿主把缓存的最新状态直接重放进面板（不依赖渲染层是否醒着）
    // 2. 再请主窗口重推一次（渲染层自己也会在 visible 时发同样的请求，互为兜底）
    // 首次打开时窗口刚建好、页面还在加载，这时重放会丢（监听还没注册），
    // 所以错开几个时间点再补一次
    let handle = app.clone();
    std::thread::spawn(move || {
        for delay in [0u64, 120, 400, 900] {
            if delay > 0 {
                std::thread::sleep(std::time::Duration::from_millis(delay));
            }
            crate::bus::replay(&handle, "tray");
        }
    });
    crate::bus::commit(
        app,
        "process",
        "main",
        "bus_dispatch_update",
        json!(["track-meta", "track-progress"]),
    );
}
