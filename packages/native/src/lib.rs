/// native 项目
/// 使用 codex、claude code、deepseek 生成
#[cfg(target_os = "macos")]
mod darwin;
#[cfg(any(windows, test))]
mod win;

use napi::bindgen_prelude::{Buffer, Result, Uint8Array};
use napi::threadsafe_function::ThreadsafeFunction;
use napi_derive::napi;

/// 菜单栏歌词交互事件（AppKit 屏幕坐标，左下原点）
#[napi(object)]
#[derive(Clone)]
pub struct MenuLyricEvent {
    /// "click" | "right-click" | "double-click"
    pub kind: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    /// CGDirectDisplayID，与 Electron `display.id` 同源；取不到时为 0
    pub display_id: u32,
}

/// 菜单栏胶囊中的逐字歌词单元，时间相对行首
#[napi(object)]
#[derive(Clone, PartialEq)]
pub struct MenuBarLyricWord {
    /// 相对行首的起始时间（ms）
    pub start_ms: f64,
    /// 相对行首的结束时间（ms）
    pub end_ms: f64,
    /// 词文本（已剔除注音）
    pub text: String,
}

/// 默认 CalleeHandled=true → JS 签名 (err, event) => void
pub type MenuLyricEventTsfn = ThreadsafeFunction<MenuLyricEvent, ()>;

/// 设置任务栏封面；`image` 为 null 表示交还给 DWM 的实时预览
#[napi(js_name = "setCover")]
pub fn set_cover(handle: Buffer, image: Option<Uint8Array>) -> Result<()> {
    #[cfg(not(windows))]
    return {
        let _ = (handle, image);
        Ok(())
    };
    #[cfg(windows)]
    return {
        win::windows_taskbar::set_cover(handle.as_ref(), image.as_ref().map(|bytes| bytes.as_ref()))
    };
}

/// 初始化 macOS 菜单栏胶囊（托盘图标 + 歌词合并项），重复调用只更新图标与提示
#[napi(js_name = "initMenuBar")]
pub fn init_menu_bar(icon_path: String, tooltip: String) -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    return {
        let _ = (icon_path, tooltip);
        Ok(())
    };
    #[cfg(target_os = "macos")]
    return darwin::darwin_menu::init_menu_bar(icon_path, tooltip);
}

/// 更新菜单栏胶囊的悬浮提示
#[napi(js_name = "setMenuBarToolTip")]
pub fn set_menu_bar_tool_tip(tooltip: String) -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    return {
        let _ = tooltip;
        Ok(())
    };
    #[cfg(target_os = "macos")]
    return darwin::darwin_menu::set_menu_bar_tool_tip(tooltip);
}

/// 更新菜单栏歌词行；`words` 为空表示静态文本（无逐字高亮）
#[napi(js_name = "setMenuLyric")]
pub fn set_menu_lyric(
    text: String,
    words: Vec<MenuBarLyricWord>,
    on_event: Option<MenuLyricEventTsfn>,
) -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    return {
        let _ = (text, words, on_event);
        Ok(())
    };
    #[cfg(target_os = "macos")]
    return darwin::darwin_menu::set_menu_lyric(text, words, on_event);
}

/// 设置歌词视口固定宽度（pt），胶囊总宽随之变化
#[napi(js_name = "setMenuBarWidth")]
pub fn set_menu_bar_width(width: f64) -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    return {
        let _ = width;
        Ok(())
    };
    #[cfg(target_os = "macos")]
    return darwin::darwin_menu::set_menu_bar_width(width);
}

/// 显示/隐藏整个菜单栏胶囊
#[napi(js_name = "setMenuBarVisible")]
pub fn set_menu_bar_visible(visible: bool) -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    return {
        let _ = visible;
        Ok(())
    };
    #[cfg(target_os = "macos")]
    return darwin::darwin_menu::set_menu_bar_visible(visible);
}

/// 同步播放进度（相对行首，ms）；原生以该基准自行推进逐字动画
#[napi(js_name = "setMenuLyricProgress")]
pub fn set_menu_lyric_progress(elapsed: f64, playing: bool) -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    return {
        let _ = (elapsed, playing);
        Ok(())
    };
    #[cfg(target_os = "macos")]
    return darwin::darwin_menu::set_menu_lyric_progress(elapsed, playing);
}
