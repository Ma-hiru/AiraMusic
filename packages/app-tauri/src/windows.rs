use anyhow::{anyhow, Result};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::state::AppState;

/// 所有窗口共享的 IPC 垫片，必须在页面脚本之前注入。
const IPC_SHIM: &str = include_str!("../assets/ipc-shim.js");

/// 托盘弹窗的补充脚本：Esc 收起。
///
/// 原版在主进程用 `before-input-event` 拦截（`utils.ts` / `win32.ts`），
/// 这里改成页面内监听，避免为一次按键专门开一条 IPC 通道。
const TRAY_ESCAPE_SCRIPT: &str = r#"
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  // 传 null：宿主按发送方窗口名（tray）解析
  globalThis.electron?.event("event_window_hidden", null);
}, true);
"#;

/// 垫片前缀：是否开启控制台桥（把渲染层的 console / 错误转发到宿主终端）。
/// 默认 debug 构建开启；`AIRA_CONSOLE=0` 可关闭，`=1` 可强制开启。
fn shim_script() -> String {
    let debug = std::env::var("AIRA_CONSOLE")
        .map(|value| value != "0")
        .unwrap_or(cfg!(debug_assertions));
    format!("globalThis.__AIRA_DEBUG={debug};\n{IPC_SHIM}")
}

/// 窗口规格：逐项对应 `packages/app/src/lib/window-preset.ts`。
///
/// 关键差异在 `traffic_lights`：
/// Electron 的 `frame: false` + `titleBarStyle: "hidden"` 在 macOS 上会得到
/// **无标题栏但保留红绿灯**（浮在内容左上角）的窗口；而 lyric / miniplayer /
/// radio / tray 刻意不设 `titleBarStyle`，并调用 `setWindowButtonVisibility(false)`，
/// 所以它们没有红绿灯。
pub struct WindowSpec {
    pub label: &'static str,
    pub page: &'static str,
    pub title: &'static str,
    pub width: f64,
    pub height: f64,
    pub min_width: Option<f64>,
    pub min_height: Option<f64>,
    /// macOS：是否保留红绿灯（其余平台一律无边框）
    pub traffic_lights: bool,
    pub resizable: bool,
    pub minimizable: bool,
    pub maximizable: bool,
    pub visible: bool,
    pub always_on_top: bool,
    pub skip_taskbar: bool,
    pub center: bool,
    /// 是否记忆位置/尺寸（对应 Electron preset 的 `memoPos`）
    pub memo_pos: bool,
}

pub const WINDOWS: &[WindowSpec] = &[
    WindowSpec {
        label: "main",
        memo_pos: true,
        // 主窗口必须加载 `/`：MainRouter 没有 basename，基址就是 `/`，
        // 加载 `/index.html` 会被 React Router 判成 No route matches。
        page: "",
        title: "AiraMusic",
        width: 1080.0,
        height: 650.0,
        min_width: Some(896.0),
        min_height: Some(539.0),
        traffic_lights: true,
        resizable: true,
        minimizable: true,
        maximizable: true,
        visible: true,
        always_on_top: false,
        skip_taskbar: false,
        center: true,
    },
    WindowSpec {
        label: "login",
        memo_pos: false,
        page: "login.html",
        title: "AiraMusic - 登录",
        width: 560.0,
        height: 330.0,
        min_width: None,
        min_height: None,
        traffic_lights: true,
        resizable: false,
        minimizable: true,
        maximizable: false,
        visible: true,
        always_on_top: true,
        skip_taskbar: true,
        center: true,
    },
    WindowSpec {
        label: "image",
        memo_pos: false,
        page: "image.html",
        title: "AiraMusic",
        width: 1024.0,
        height: 600.0,
        min_width: Some(800.0),
        min_height: Some(469.0),
        traffic_lights: true,
        resizable: true,
        minimizable: true,
        maximizable: true,
        visible: true,
        always_on_top: false,
        skip_taskbar: false,
        center: true,
    },
    WindowSpec {
        label: "lyric",
        memo_pos: true,
        page: "lyric.html",
        title: "AiraMusic",
        width: 720.0,
        height: 120.0,
        min_width: Some(480.0),
        min_height: Some(80.0),
        // 原版在 darwin 上不设 titleBarStyle，并隐藏标准按钮
        traffic_lights: false,
        resizable: true,
        minimizable: false,
        maximizable: false,
        visible: true,
        always_on_top: true,
        skip_taskbar: true,
        center: false,
    },
    WindowSpec {
        label: "miniplayer",
        memo_pos: true,
        page: "mini.html",
        title: "AiraMusic",
        width: 260.0,
        height: 68.0,
        min_width: Some(240.0),
        min_height: Some(68.0),
        traffic_lights: false,
        resizable: true,
        minimizable: false,
        maximizable: false,
        visible: true,
        always_on_top: true,
        skip_taskbar: true,
        center: false,
    },
    WindowSpec {
        label: "radio",
        memo_pos: true,
        page: "radio.html",
        title: "AiraMusic",
        width: 640.0,
        height: 320.0,
        min_width: None,
        min_height: None,
        traffic_lights: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        visible: true,
        always_on_top: true,
        skip_taskbar: true,
        center: false,
    },
    WindowSpec {
        label: "about",
        memo_pos: false,
        page: "about.html",
        title: "AiraMusic",
        width: 300.0,
        height: 270.0,
        min_width: None,
        min_height: None,
        traffic_lights: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        visible: true,
        always_on_top: true,
        skip_taskbar: true,
        center: true,
    },
    WindowSpec {
        label: "display",
        memo_pos: true,
        page: "display.html",
        title: "display",
        width: 1024.0,
        height: 600.0,
        min_width: Some(720.0),
        min_height: Some(422.0),
        traffic_lights: true,
        resizable: true,
        minimizable: true,
        maximizable: true,
        visible: true,
        always_on_top: false,
        skip_taskbar: false,
        center: false,
    },
    WindowSpec {
        label: "agent",
        memo_pos: true,
        page: "agent.html",
        title: "agent",
        width: 1024.0,
        height: 600.0,
        min_width: Some(720.0),
        min_height: Some(422.0),
        traffic_lights: true,
        resizable: true,
        minimizable: true,
        maximizable: true,
        visible: true,
        always_on_top: false,
        skip_taskbar: false,
        center: false,
    },
    WindowSpec {
        label: "comments",
        memo_pos: true,
        page: "comments.html",
        title: "comments",
        width: 300.0,
        height: 800.0,
        min_width: Some(112.0),
        min_height: Some(300.0),
        traffic_lights: true,
        resizable: true,
        minimizable: true,
        // 原版 maximizable: false
        maximizable: false,
        visible: true,
        always_on_top: false,
        skip_taskbar: false,
        center: false,
    },
    WindowSpec {
        label: "tray",
        memo_pos: true,
        page: "tray.html",
        title: "AiraMusic",
        width: 180.0,
        height: 540.0,
        min_width: None,
        min_height: None,
        traffic_lights: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        // 托盘弹窗由 NativeTray 主动 show，启动时不显示
        visible: false,
        always_on_top: true,
        skip_taskbar: true,
        center: false,
    },
];

pub fn spec(label: &str) -> Option<&'static WindowSpec> {
    WINDOWS.iter().find(|item| item.label == label)
}

/// 窗口层级（对应 Electron preset 的 `alwaysOnTop` 级别）
///
/// `always_on_top(true)` 已经给出 floating 级；只有托盘面板需要更高的
/// `pop-up-menu`（101），要单独设置。
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Level {
    Normal,
    /// `setAlwaysOnTop(true, "pop-up-menu")`：托盘面板要盖在全屏应用之上
    PopUpMenu,
}

/// 是否透明窗口（`transparent: true` + 全透明背景色）
pub fn transparent(label: &str) -> bool {
    matches!(label, "lyric" | "tray")
}

/// 是否有系统阴影（preset 里 lyric / tray / about 明确 `hasShadow: false`）
pub fn has_shadow(label: &str) -> bool {
    !matches!(label, "lyric" | "tray" | "about")
}

/// 层级：只有托盘面板要 `pop-up-menu`（盖全屏应用），其余交给 `always_on_top`
pub fn level(label: &str) -> Level {
    if label == "tray" {
        Level::PopUpMenu
    } else {
        Level::Normal
    }
}

/// 是否出现在所有 Space（macOS 托盘面板要能盖在全屏应用上）
pub fn all_spaces(label: &str) -> bool {
    label == "tray"
}

/// 主屏工作区（逻辑像素）。对应 Electron 的 `screen.getPrimaryDisplay().workAreaSize`
fn primary_work_area(app: &AppHandle) -> Option<(f64, f64)> {
    let monitor = app.primary_monitor().ok().flatten()?;
    let area = monitor.work_area();
    let scale = monitor.scale_factor();
    Some((
        area.size.width as f64 / scale,
        area.size.height as f64 / scale,
    ))
}

/// `idealFit`：把 base 当理想尺寸，大屏不放大、小屏等比收缩到工作区的 95%
/// （与 `screen-resolver.ts` 完全一致）
fn ideal_fit(size: (f64, f64), area: Option<(f64, f64)>) -> (f64, f64) {
    const MAX_WINDOW_COVER_RATIO: f64 = 0.95;
    let Some((work_width, work_height)) = area else {
        return size;
    };
    if size.0 <= 0.0 || size.1 <= 0.0 {
        return size;
    }
    let scale = 1.0_f64
        .min(work_width * MAX_WINDOW_COVER_RATIO / size.0)
        .min(work_height * MAX_WINDOW_COVER_RATIO / size.1);
    ((size.0 * scale).round(), (size.1 * scale).round())
}

/// 一个窗口在当前屏幕下解析出来的尺寸
struct Resolved {
    base: (f64, f64),
    min: (f64, f64),
    /// 仅 lyric / miniplayer / comments 有 resize 上界
    max: Option<(f64, f64)>,
}

fn resolved(app: &AppHandle, spec: &WindowSpec) -> Resolved {
    let area = primary_work_area(app);
    let raw_base = (spec.width, spec.height);
    let base = ideal_fit(raw_base, area);
    let min = ideal_fit(
        (
            spec.min_width.unwrap_or(spec.width),
            spec.min_height.unwrap_or(spec.height),
        ),
        area,
    );
    let max = max_size(spec.label).map(|size| ideal_fit(size, area));
    Resolved { base, min, max }
}

/// 命中某个逻辑坐标所在的显示器
pub fn monitor_at(app: &AppHandle, x: f64, y: f64) -> Option<tauri::Monitor> {
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

/// 工作区（逻辑像素、左上原点）
pub fn work_area_of(monitor: &tauri::Monitor) -> (f64, f64, f64, f64) {
    let area = monitor.work_area();
    let scale = monitor.scale_factor();
    (
        area.position.x as f64 / scale,
        area.position.y as f64 / scale,
        area.size.width as f64 / scale,
        area.size.height as f64 / scale,
    )
}

/// 可拖拽缩放的边界（对应 Electron preset 的 `max`）
fn max_size(label: &str) -> Option<(f64, f64)> {
    match label {
        "lyric" => Some((1100.0, 183.0)),
        "miniplayer" => Some((300.0, 68.0)),
        "comments" => Some((450.0, 1200.0)),
        _ => None,
    }
}

fn bounds_key(label: &str) -> String {
    format!("window.bounds.{label}")
}

/// 读取上次关闭时的窗口位置/尺寸（逻辑像素）。
///
/// 与 `window-creator.ts` 的 memoPos 分支一致：
/// - 存档点已经不在任何显示器上（拔了外接屏）→ 丢弃位置，按预设居中/默认摆
/// - 否则按目标屏工作区夹一遍尺寸与坐标，恢复值不会把窗口塞到屏幕外
fn restored_bounds(app: &AppHandle, spec: &WindowSpec) -> Option<(f64, f64, f64, f64)> {
    if !spec.memo_pos {
        return None;
    }
    let fit = resolved(app, spec);
    restored_bounds_for(app, spec.label, Some(fit.min), fit.max)
}

/// 通用版本：外链窗口不在 `WINDOWS` 表里，也要记忆位置（原版 `external` 有 memoPos）
fn restored_bounds_for(
    app: &AppHandle,
    label: &str,
    min: Option<(f64, f64)>,
    max: Option<(f64, f64)>,
) -> Option<(f64, f64, f64, f64)> {
    let raw = app.state::<AppState>().kv.get(&bounds_key(label))?;
    let x = raw.get("x")?.as_f64()?;
    let y = raw.get("y")?.as_f64()?;
    let width = raw.get("width")?.as_f64()?;
    let height = raw.get("height")?.as_f64()?;
    if width < 1.0 || height < 1.0 {
        return None;
    }

    // 存档点必须落在某个显示器里，否则当作没有存档
    let monitor = monitor_at(app, x + width / 2.0, y + height / 2.0)?;
    let (area_x, area_y, area_width, area_height) = work_area_of(&monitor);

    let lower_width = min
        .map(|size| size.0)
        .unwrap_or(1.0)
        .min(area_width)
        .max(1.0);
    let upper_width = max
        .map(|size| size.0)
        .unwrap_or(f64::INFINITY)
        .min(area_width)
        .max(lower_width);
    let lower_height = min
        .map(|size| size.1)
        .unwrap_or(1.0)
        .min(area_height)
        .max(1.0);
    let upper_height = max
        .map(|size| size.1)
        .unwrap_or(f64::INFINITY)
        .min(area_height)
        .max(lower_height);

    let width = width.clamp(lower_width, upper_width);
    let height = height.clamp(lower_height, upper_height);
    let x = x.clamp(area_x, (area_x + area_width - width).max(area_x));
    let y = y.clamp(area_y, (area_y + area_height - height).max(area_y));

    Some((x, y, width, height))
}

/// 记录窗口位置/尺寸（由 watcher 的轮询在变化时调用）。
pub fn remember_bounds(app: &AppHandle, label: &str, window: &WebviewWindow) {
    // 外链窗口不在 WINDOWS 表里，但原版 `external` 也记位置
    let memo = match spec(label) {
        Some(spec) => spec.memo_pos,
        None => label == "external",
    };
    if !memo {
        return;
    }
    let scale = window.scale_factor().unwrap_or(1.0);
    let (Ok(position), Ok(size)) = (window.outer_position(), window.inner_size()) else {
        return;
    };

    let bounds = (
        position.x as f64 / scale,
        position.y as f64 / scale,
        size.width as f64 / scale,
        size.height as f64 / scale,
    );

    // 抖动抑制：变化后 600ms 才落盘，避免拖动窗口时频繁写文件
    use std::collections::HashMap;
    use std::sync::Mutex;
    use std::time::{Duration, Instant};
    type BoundsMap = HashMap<String, (f64, f64, f64, f64, Instant)>;
    static LAST: Mutex<Option<BoundsMap>> = Mutex::new(None);

    let now = Instant::now();
    let Ok(mut guard) = LAST.lock() else { return };
    let map = guard.get_or_insert_with(HashMap::new);
    if let Some((x, y, w, h, at)) = map.get(label).copied() {
        let changed = (x - bounds.0).abs() > 0.5
            || (y - bounds.1).abs() > 0.5
            || (w - bounds.2).abs() > 0.5
            || (h - bounds.3).abs() > 0.5;
        if !changed || at.elapsed() < Duration::from_millis(600) {
            return;
        }
    }
    map.insert(
        label.to_string(),
        (bounds.0, bounds.1, bounds.2, bounds.3, now),
    );
    drop(guard);

    let _ = app.state::<AppState>().kv.set(
        bounds_key(label),
        serde_json::json!({
            "x": bounds.0.round(),
            "y": bounds.1.round(),
            "width": bounds.2.round(),
            "height": bounds.3.round(),
        }),
    );
}

/// macOS 无边框窗口的圆角半径（Big Sur 之后系统窗口是 10pt）
const MACOS_CORNER_RADIUS: f64 = 10.0;

/// 外链窗口（`event_window_external`）：单个实例，远程页面，**不注入 IPC 垫片**。
///
/// 与 Electron 的 `MainWindowPreset.external` 对齐：1024×600、可缩放、原生标题栏、
/// `handleExits: DESTROY`（重复打开时销毁旧窗口）。
pub fn create_external(app: &AppHandle, title: &str, url: &str) -> Result<WebviewWindow> {
    let parsed = tauri::Url::parse(url)?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(anyhow!("只允许 http/https 外链"));
    }
    if let Some(existing) = app.get_webview_window("external") {
        let _ = existing.destroy();
    }
    let mut builder = WebviewWindowBuilder::new(app, "external", WebviewUrl::External(parsed))
        .title(if title.is_empty() { "AiraMusic" } else { title })
        .inner_size(1024.0, 600.0)
        .min_inner_size(800.0, 469.0)
        .resizable(true)
        .minimizable(true)
        .maximizable(true)
        .decorations(true);

    // 原版 `external` 的 memoPos: true —— 记住外链窗口的位置与尺寸
    match restored_bounds_for(app, "external", Some((800.0, 469.0)), None) {
        Some((x, y, width, height)) => {
            builder = builder.position(x, y).inner_size(width, height);
        }
        None => {
            builder = builder.center();
        }
    }

    let window = builder.build()?;
    Ok(window)
}

/// 创建窗口；已存在则显示并聚焦。对应 `MainWindowCreator.create`。
pub fn create(app: &AppHandle, label: &str) -> Result<WebviewWindow> {
    if let Some(existing) = app.get_webview_window(label) {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(existing);
    }

    let spec = spec(label).ok_or_else(|| anyhow!("未知窗口类型: {label}"))?;

    // 页面由内置 HTTP listener 提供（与 `/api` 同源），而不是 Tauri 的资源协议。
    // 开发期 base_url 指向 Vite（HMR），其余情况指向内置 listener。
    let base = app.state::<AppState>().base_url.clone();
    // WKWebView 的 HTTP 缓存跨进程复用：重建 UI 后首次加载仍可能拿到旧 index.html，
    // 而旧 HTML 引用的 chunk 名已不存在 → 一堆 404。
    // 给入口 URL 加一次性 cache-buster，保证每次启动都取最新文档；
    // 带哈希的资源名不受影响，仍然走缓存。
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let url = tauri::Url::parse(&format!(
        "{}/{}?__boot={stamp}",
        base.trim_end_matches('/'),
        spec.page
    ))?;
    crate::host_log!("[window] {label} → {url}");

    // 尺寸按主屏工作区等比收缩（idealFit），max 只有 lyric / miniplayer / comments 有
    let fit = resolved(app, spec);

    let mut builder = WebviewWindowBuilder::new(app, spec.label, WebviewUrl::External(url))
        .title(spec.title)
        .inner_size(fit.base.0, fit.base.1)
        .resizable(spec.resizable)
        .minimizable(spec.minimizable)
        .maximizable(spec.maximizable)
        .visible(spec.visible)
        .always_on_top(spec.always_on_top)
        .skip_taskbar(spec.skip_taskbar)
        // 歌词条 / 托盘面板要能露出桌面：透明 + 无系统阴影
        .transparent(transparent(spec.label))
        .shadow(has_shadow(spec.label))
        .initialization_script(shim_script());

    // 托盘弹窗：Esc 收起（原版 `before-input-event` 拦 Escape）
    if spec.label == "tray" {
        builder = builder.initialization_script(TRAY_ESCAPE_SCRIPT);
    }

    #[cfg(target_os = "macos")]
    {
        if spec.traffic_lights {
            // 等价于 Electron 的 frame:false + titleBarStyle:"hidden"：
            // 内容铺满整个窗口，红绿灯浮在左上角
            builder = builder
                .decorations(true)
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true);
        } else {
            builder = builder.decorations(false);
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.decorations(false);
    }

    builder = builder.min_inner_size(fit.min.0, fit.min.1);
    if let Some((width, height)) = fit.max {
        builder = builder.max_inner_size(width, height);
    }

    // 位置记忆（对应 Electron 的 `memoPos`）：有存档就恢复，否则按 preset 居中
    match restored_bounds(app, spec) {
        Some((x, y, width, height)) => {
            builder = builder.position(x, y).inner_size(width, height);
        }
        None if spec.center => {
            builder = builder.center();
        }
        None => {}
    }

    let window = builder.build()?;

    // 主窗口「关闭 = 隐藏」，退出流程中才真正销毁；其余窗口按默认销毁
    let label_owned = spec.label.to_string();
    let handle = app.clone();
    window.on_window_event(move |event| match event {
        tauri::WindowEvent::CloseRequested { api, .. } => {
            if crate::lifecycle::handle_close_requested(&handle, &label_owned) {
                api.prevent_close();
            }
        }
        // agent 窗口关闭 → 收掉网页工具池
        // （对应原版 `win.once("closed", () => WebBrowser.close())`）
        tauri::WindowEvent::Destroyed if label_owned == "agent" => {
            crate::agent::webpage::close_all();
        }
        _ => {}
    });

    // 无红绿灯的窗口要显式隐藏标准按钮：Tauri 的 decorations(false)
    // 在部分 macOS 版本上仍会保留它们。
    // 同时补系统圆角：borderless 窗口在 macOS 上是直角，Electron 靠
    // `roundedCorners`（默认 true）才有圆角，Tauri 没有这个开关。
    #[cfg(target_os = "macos")]
    if !spec.traffic_lights {
        crate::platform_macos::hide_traffic_lights(&window);
        crate::platform_macos::round_corners(&window, MACOS_CORNER_RADIUS);
    }

    // 托盘面板：pop-up-menu 级别 + 在所有 Space（含全屏应用）上可见，
    // 对应 Electron preset 的 `setAlwaysOnTop(true, "pop-up-menu")` 与
    // `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`
    #[cfg(target_os = "macos")]
    if level(spec.label) == Level::PopUpMenu || all_spaces(spec.label) {
        crate::platform_macos::raise_panel(&window, level(spec.label) == Level::PopUpMenu);
    }

    Ok(window)
}

#[cfg(test)]
mod tests {
    use crate::windows::{max_size, spec, WINDOWS};

    #[test]
    fn window_specs_are_unique_and_sized() {
        let mut labels: Vec<&str> = WINDOWS.iter().map(|spec| spec.label).collect();
        labels.sort_unstable();
        labels.dedup();
        assert_eq!(labels.len(), WINDOWS.len(), "窗口 label 不能重复");
        for spec in WINDOWS {
            assert!(spec.width > 0.0 && spec.height > 0.0, "{}", spec.label);
            if let (Some(min_w), Some(min_h)) = (spec.min_width, spec.min_height) {
                assert!(
                    min_w <= spec.width && min_h <= spec.height,
                    "{}",
                    spec.label
                );
            }
        }
    }

    #[test]
    fn max_sizes_match_electron_presets() {
        assert_eq!(max_size("lyric"), Some((1100.0, 183.0)));
        assert_eq!(max_size("miniplayer"), Some((300.0, 68.0)));
        assert_eq!(max_size("comments"), Some((450.0, 1200.0)));
        assert_eq!(max_size("main"), None);
    }

    #[test]
    fn ideal_fit_only_shrinks_on_small_screens() {
        use super::ideal_fit;

        // 大屏不放大：1512×982 的工作区放得下 1080×650
        assert_eq!(
            ideal_fit((1080.0, 650.0), Some((1512.0, 949.0))),
            (1080.0, 650.0)
        );

        // 小屏等比收缩到工作区的 95%，宽高比不变
        let (width, height) = ideal_fit((1080.0, 650.0), Some((1280.0, 720.0)));
        assert!(width <= 1280.0 * 0.95 + 1.0, "{width}");
        assert!(height <= 720.0 * 0.95 + 1.0, "{height}");
        assert!(
            (width / height - 1080.0 / 650.0).abs() < 0.01,
            "{width}x{height}"
        );

        // 拿不到屏幕信息时原样返回
        assert_eq!(ideal_fit((300.0, 270.0), None), (300.0, 270.0));
    }

    #[test]
    fn window_chrome_matches_presets() {
        use super::{has_shadow, level, transparent, Level};

        // 原版 preset 里只有 lyric / tray 是 transparent + 全透明背景
        assert!(transparent("lyric"));
        assert!(transparent("tray"));
        for label in ["main", "login", "image", "miniplayer", "radio", "about"] {
            assert!(!transparent(label), "{label}");
        }

        // hasShadow: false → lyric / tray / about
        for label in ["lyric", "tray", "about"] {
            assert!(!has_shadow(label), "{label} 不应有系统阴影");
        }
        assert!(has_shadow("main"));

        // pop-up-menu 只给托盘面板（要盖在全屏应用上）
        assert_eq!(level("tray"), Level::PopUpMenu);
        assert_eq!(level("main"), Level::Normal);
    }

    #[test]
    fn memo_pos_flags_match_electron() {
        let memo = |label: &str| spec(label).map(|spec| spec.memo_pos).unwrap_or(false);
        for label in [
            "main",
            "lyric",
            "miniplayer",
            "radio",
            "tray",
            "display",
            "comments",
            "agent",
        ] {
            assert!(memo(label), "{label} 应该记忆位置");
        }
        for label in ["login", "image", "about"] {
            assert!(!memo(label), "{label} 不应记忆位置");
        }
    }
}
