//! macOS 平台补丁。
//!
//! 1. 隐藏窗口红绿灯：Electron 版靠 `frame: false` + `setWindowButtonVisibility(false)`，
//!    Tauri 的 `decorations(false)` 在部分 macOS 版本上仍会保留标准按钮。
//! 2. 取 NSWindow 的 windowNumber，供 `screencapture -l` 截图调试。
//! 3. 菜单栏歌词胶囊（见 [`menubar`]）：原 `@mahiru/native` 的 darwin 实现。

#![cfg(target_os = "macos")]

pub mod menubar;

use std::sync::mpsc;
use std::time::Duration;

use objc2::MainThreadMarker;
use objc2_app_kit::{NSWindow, NSWindowButton};
use tauri::WebviewWindow;

/// 主线程直接访问 NSWindow；后台调用才投递并等待，避免主线程等待自己的回调。
fn with_ns_window<T, F>(window: &WebviewWindow, f: F) -> Option<T>
where
    T: Send + 'static,
    F: FnOnce(*mut NSWindow) -> T + Send + 'static,
{
    if MainThreadMarker::new().is_some() {
        return window.ns_window().ok().map(|pointer| f(pointer.cast()));
    }

    let (tx, rx) = mpsc::channel();
    if let Err(error) = window.with_webview(move |webview| {
        let pointer = webview.ns_window() as *mut NSWindow;
        let _ = tx.send(f(pointer));
    }) {
        crate::host_err!("[macos] with_webview 失败: {error}");
        return None;
    }

    rx.recv_timeout(Duration::from_secs(2)).ok()
}

/// 隐藏 close / miniaturize / zoom 三个标准按钮。
pub fn hide_traffic_lights(window: &WebviewWindow) {
    let _ = with_ns_window(window, |ns_window| unsafe {
        if ns_window.is_null() {
            return;
        }
        let window = &*ns_window;
        for button in [
            NSWindowButton::CloseButton,
            NSWindowButton::MiniaturizeButton,
            NSWindowButton::ZoomButton,
        ] {
            if let Some(button) = window.standardWindowButton(button) {
                button.setHidden(true);
            }
        }
    });
}

/// 把窗口提到菜单栏弹层级别，并允许它出现在所有 Space（含全屏应用之上）。
///
/// 对应 Electron 托盘面板 preset 的
/// `setAlwaysOnTop(true, "pop-up-menu")` + `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`。
pub fn raise_panel(window: &WebviewWindow, popup_level: bool) {
    const POP_UP_MENU_LEVEL: isize = 101;
    const CAN_JOIN_ALL_SPACES: usize = 1 << 0;
    const FULL_SCREEN_AUXILIARY: usize = 1 << 8;

    let _ = with_ns_window(window, move |ns_window| unsafe {
        if ns_window.is_null() {
            return;
        }
        let window = &*ns_window;
        if popup_level {
            window.setLevel(POP_UP_MENU_LEVEL);
        }
        // tao 的 setVisibleOnAllWorkspaces 只加 CanJoinAllSpaces，
        // 这里补上 FullScreenAuxiliary，面板才能浮在全屏应用之上
        let behavior = window.collectionBehavior().0 | CAN_JOIN_ALL_SPACES | FULL_SCREEN_AUXILIARY;
        window.setCollectionBehavior(objc2_app_kit::NSWindowCollectionBehavior(behavior));
    });
}

/// 给无边框窗口补上系统圆角。
///
/// Electron 的 `roundedCorners`（默认 true）会给 macOS 无边框窗口的内容视图加圆角，
/// Tauri 没这个开关：`decorations(false)` 建出来是纯粹的直角 borderless 窗口。
/// 这里直接对 `contentView.layer` 处理，观感与 Electron 版一致。
pub fn round_corners(window: &WebviewWindow, radius: f64) {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    let _ = with_ns_window(window, move |ns_window| unsafe {
        if ns_window.is_null() {
            return;
        }
        let Some(view) = (*ns_window).contentView() else {
            return;
        };
        view.setWantsLayer(true);
        let layer: *mut AnyObject = msg_send![&*view, layer];
        if layer.is_null() {
            return;
        }
        let _: () = msg_send![layer, setCornerRadius: radius];
        let _: () = msg_send![layer, setMasksToBounds: true];
        // 圆角之外要能露出桌面：窗口本身设成非不透明 + 透明背景，
        // 否则遮罩挖掉的四个角会露出窗口底色（白/黑方块）。
        // 非不透明窗口的阴影由内容 alpha 推导，圆角阴影也就跟着对了。
        (*ns_window).setOpaque(false);
        (*ns_window).setBackgroundColor(Some(&objc2_app_kit::NSColor::clearColor()));
    });
}

/// 当前内容视图的圆角半径（`/__diag` 用：验证无边框窗口确实补上了圆角）
pub fn corner_radius(window: &WebviewWindow) -> Option<f64> {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    with_ns_window(window, |ns_window| unsafe {
        if ns_window.is_null() {
            return None;
        }
        let view = (*ns_window).contentView()?;
        let layer: *mut AnyObject = msg_send![&*view, layer];
        if layer.is_null() {
            return None;
        }
        let radius: f64 = msg_send![layer, cornerRadius];
        Some(radius)
    })
    .flatten()
}

/// 窗口层级（`/__diag` 用：托盘面板应为 101 = pop-up-menu）
pub fn window_level(window: &WebviewWindow) -> Option<isize> {
    with_ns_window(window, |ns_window| unsafe {
        if ns_window.is_null() {
            return None;
        }
        Some((*ns_window).level())
    })
    .flatten()
}

/// 样式位：用于确认窗口是否带标题栏（0x1000 = fullSizeContentView）。
pub fn style_mask(window: &WebviewWindow) -> Option<usize> {
    with_ns_window(window, |ns_window| unsafe {
        if ns_window.is_null() {
            return None;
        }
        Some((*ns_window).styleMask().bits())
    })
    .flatten()
}

/// 三个标准按钮是否都已隐藏（供 `/__diag` 客观校验）。
pub fn traffic_lights_hidden(window: &WebviewWindow) -> Option<bool> {
    with_ns_window(window, |ns_window| unsafe {
        if ns_window.is_null() {
            return None;
        }
        let window = &*ns_window;
        let mut all_hidden = true;
        for button in [
            NSWindowButton::CloseButton,
            NSWindowButton::MiniaturizeButton,
            NSWindowButton::ZoomButton,
        ] {
            match window.standardWindowButton(button) {
                // 按钮不存在（无边框窗口）也算隐藏
                None => {}
                Some(button) => all_hidden &= button.isHidden(),
            }
        }
        Some(all_hidden)
    })
    .flatten()
}

/// 取窗口在窗口服务器里的编号（`screencapture -l` 需要）。
pub fn window_number(window: &WebviewWindow) -> Option<i64> {
    with_ns_window(window, |ns_window| unsafe {
        if ns_window.is_null() {
            return None;
        }
        Some((*ns_window).windowNumber() as i64)
    })
    .flatten()
}

/// 用 WKWebView 自带的 `takeSnapshot` 截图，返回 PNG 字节。
///
/// 相比 `screencapture`，它**不需要「屏幕录制」权限**（后者在受限终端里会直接
/// 报 `could not create image from window`），而且只包含网页内容，没有窗口阴影。
pub fn snapshot_png(window: &WebviewWindow) -> Option<Vec<u8>> {
    use block2::RcBlock;
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    use objc2_app_kit::NSImage;
    use objc2_foundation::{NSDictionary, NSError};
    use objc2_web_kit::WKWebView;

    let (tx, rx) = mpsc::channel();
    let handle = window.clone();

    std::thread::spawn(move || {
        let result = handle.with_webview(move |webview| unsafe {
            let pointer = webview.inner() as *mut WKWebView;
            if pointer.is_null() {
                let _ = tx.send(None);
                return;
            }

            let handler = RcBlock::new(move |image: *mut NSImage, error: *mut NSError| {
                if image.is_null() || !error.is_null() {
                    let _ = tx.send(None);
                    return;
                }

                let tiff = (*image).TIFFRepresentation();
                let Some(tiff) = tiff else {
                    let _ = tx.send(None);
                    return;
                };

                // 直接走 msg_send，避免 NSBitmapImageRep 绑定在不同小版本间的差异：
                // +imageRepWithData: / -representationUsingType:properties:
                // NSBitmapImageFileTypePNG = 4
                let rep: *mut AnyObject =
                    msg_send![objc2::class!(NSBitmapImageRep), imageRepWithData: &*tiff];
                if rep.is_null() {
                    let _ = tx.send(None);
                    return;
                }
                let properties = NSDictionary::<AnyObject, AnyObject>::new();
                let data: *mut AnyObject = msg_send![
                    rep,
                    representationUsingType: 4usize,
                    properties: &*properties
                ];
                if data.is_null() {
                    let _ = tx.send(None);
                    return;
                }

                let length: usize = msg_send![data, length];
                let bytes: *const u8 = msg_send![data, bytes];
                if bytes.is_null() || length == 0 {
                    let _ = tx.send(None);
                    return;
                }
                let _ = tx.send(Some(std::slice::from_raw_parts(bytes, length).to_vec()));
            });

            (*pointer).takeSnapshotWithConfiguration_completionHandler(None, &handler);
        });

        if let Err(error) = result {
            crate::host_err!("[macos] 截图失败: {error}");
        }
    });

    rx.recv_timeout(Duration::from_secs(5)).ok().flatten()
}
