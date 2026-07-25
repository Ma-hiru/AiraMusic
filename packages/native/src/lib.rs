/// native 项目
/// 使用 codex 和 claude code 生成
#[cfg(target_os = "macos")]
mod darwin;
#[cfg(windows)]
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
}

/// 默认 CalleeHandled=true → JS 签名 (err, event) => void
pub type MenuLyricEventTsfn = ThreadsafeFunction<MenuLyricEvent, ()>;

#[napi(js_name = "setCover")]
pub fn set_cover(
    handle: Buffer,
    image: Option<Uint8Array>,
    preview: Option<Uint8Array>,
) -> Result<()> {
    #[cfg(not(windows))]
    return {
        let _ = (handle, image, preview);
        Ok(())
    };
    #[cfg(windows)]
    return {
        win::windows_taskbar::set_cover(
            handle.as_ref(),
            image.as_ref().map(|bytes| bytes.as_ref()),
            preview.as_ref().map(|bytes| bytes.as_ref()),
        )
    };
}

#[napi(js_name = "setLivePreview")]
pub fn set_live_preview(handle: Buffer, preview: Uint8Array) -> Result<()> {
    #[cfg(not(windows))]
    return {
        let _ = (handle, preview);
        Ok(())
    };
    #[cfg(windows)]
    return { win::windows_taskbar::set_live_preview(handle.as_ref(), preview.as_ref()) };
}

#[napi(js_name = "setMenuLyric")]
pub fn set_menu_lyric(
    handle: Buffer,
    lyric: String,
    ping_pong: bool,
    duration: i64,
    gap: i64,
    width: f64,
    on_event: Option<MenuLyricEventTsfn>,
) -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    return {
        let _ = (handle, lyric, ping_pong, duration, gap, width, on_event);
        Ok(())
    };
    #[cfg(target_os = "macos")]
    return {
        darwin::darwin_menu::set_menu_lyric(
            handle.as_ref(),
            lyric,
            ping_pong,
            duration,
            gap,
            width,
            on_event,
        )
    };
}
