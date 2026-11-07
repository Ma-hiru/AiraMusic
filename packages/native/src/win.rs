//! Windows 任务栏封面：把当前曲目的封面交给 DWM 的图标化表示。
//!
//! `WM_DWMSENDICONICTHUMBNAIL` / `WM_DWMSENDICONICLIVEPREVIEWBITMAP` 是 DWM 在
//! 窗口过程里同步索取位图的消息，必须在同一个消息栈内用 `DwmSetIconicThumbnail`
//! / `DwmSetIconicLivePreviewBitmap` 应答；错过这次时机，任务栏缩略图会停在加载
//! 态直到窗口重新激活。所以解码、缩放、DIB 组装全部留在原生侧，JS 只负责告知
//! “当前该显示哪张图”；没有封面时关闭图标化属性，把实时预览交还给 DWM。

fn thumbnail_size(lparam: usize) -> (u32, u32) {
    // WM_DWMSENDICONICTHUMBNAIL 的 HIWORD 是宽，LOWORD 是高。
    (
        (((lparam >> 16) & 0xffff) as u32).max(1),
        ((lparam & 0xffff) as u32).max(1),
    )
}

#[cfg(test)]
mod tests {
    use super::thumbnail_size;

    #[test]
    fn thumbnail_uses_width_from_high_word_and_height_from_low_word() {
        assert_eq!(thumbnail_size(0x0140_00b4), (320, 180));
        assert_eq!(thumbnail_size(0x00b4_0140), (180, 320));
    }

    #[test]
    fn thumbnail_dimensions_are_at_least_one_pixel() {
        assert_eq!(thumbnail_size(0), (1, 1));
        assert_eq!(thumbnail_size(0x0140_0000), (320, 1));
    }
}

#[cfg(windows)]
pub mod windows_taskbar {
    use std::{
        collections::HashMap,
        ffi::c_void,
        mem::{size_of, transmute, zeroed},
        ptr::null_mut,
        sync::{Arc, Mutex, MutexGuard},
    };

    use image::{Rgba, RgbaImage, imageops};
    use napi::{Error, Result, Status};
    use once_cell::sync::Lazy;
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, LRESULT, RECT, SetLastError, WPARAM},
        Graphics::{
            Dwm::{
                DWMWA_FORCE_ICONIC_REPRESENTATION, DWMWA_HAS_ICONIC_BITMAP,
                DwmInvalidateIconicBitmaps, DwmSetIconicLivePreviewBitmap, DwmSetIconicThumbnail,
                DwmSetWindowAttribute,
            },
            Gdi::{
                BI_RGB, BITMAPINFO, BITMAPINFOHEADER, CreateDIBSection, DIB_RGB_COLORS,
                DeleteObject, HBITMAP,
            },
        },
        UI::WindowsAndMessaging::{
            CallWindowProcW, DefWindowProcW, GWLP_WNDPROC, GetClientRect, GetWindowLongPtrW,
            SetWindowLongPtrW, WM_NCDESTROY, WNDPROC,
        },
    };

    const WM_DWMSENDICONICTHUMBNAIL: u32 = 0x0323;
    const WM_DWMSENDICONICLIVEPREVIEWBITMAP: u32 = 0x0326;
    /// 单窗口缓存的渲染帧数上限，DWM 只会请求少数几种尺寸
    const MAX_FRAMES: usize = 6;
    /// 预览位图最长边上限，避免 4K 窗口下分配几十 MB 的 DIB
    const MAX_PREVIEW_EDGE: u32 = 1280;

    static WINDOWS: Lazy<Mutex<HashMap<isize, WindowState>>> =
        Lazy::new(|| Mutex::new(HashMap::new()));

    struct WindowState {
        original_proc: isize,
        cover: Option<Arc<CoverImage>>,
        /// 按 DWM 请求尺寸缓存渲染结果，避免每次悬停、每次 Alt+Tab 重跑重采样
        frames: HashMap<(u32, u32), Arc<RgbaImage>>,
    }

    struct CoverImage {
        rgba: RgbaImage,
    }

    impl CoverImage {
        fn from_bytes(bytes: &[u8]) -> Result<Self> {
            let rgba = image::load_from_memory(bytes)
                .map_err(|err| {
                    Error::new(Status::InvalidArg, format!("decode cover failed: {err}"))
                })?
                .to_rgba8();

            if rgba.width() == 0 || rgba.height() == 0 {
                return Err(Error::new(Status::InvalidArg, "cover image is empty"));
            }

            Ok(Self { rgba })
        }

        /// 等比缩放到目标框内并居中，空余部分保持透明，由 DWM 的卡片底衬透出。
        /// DWM 会把位图铺满请求矩形，直接按正方形出图会把封面拉扁。
        fn fit(&self, width: u32, height: u32) -> RgbaImage {
            let (src_width, src_height) = self.rgba.dimensions();
            let scale = f64::from(width) / f64::from(src_width);
            let scale = scale.min(f64::from(height) / f64::from(src_height));

            let frame_width = ((f64::from(src_width) * scale).round() as u32).clamp(1, width);
            let frame_height = ((f64::from(src_height) * scale).round() as u32).clamp(1, height);
            let resized = imageops::resize(
                &self.rgba,
                frame_width,
                frame_height,
                imageops::FilterType::Lanczos3,
            );

            let mut canvas = RgbaImage::from_pixel(width, height, Rgba([0, 0, 0, 0]));
            imageops::overlay(
                &mut canvas,
                &resized,
                i64::from((width - frame_width) / 2),
                i64::from((height - frame_height) / 2),
            );

            canvas
        }
    }

    /// 设置任务栏封面；`None` 表示当前曲目没有封面，交还给 DWM 的实时预览
    pub fn set_cover(handle: &[u8], image: Option<&[u8]>) -> Result<()> {
        let hwnd = hwnd_from_buffer(handle)?;

        let Some(bytes) = image else {
            clear(hwnd);
            return Ok(());
        };

        let cover = CoverImage::from_bytes(bytes)?;
        ensure_subclassed(hwnd)?;
        apply_cover(hwnd, cover)
    }

    fn apply_cover(hwnd: HWND, cover: CoverImage) -> Result<()> {
        {
            let mut windows = registry();
            let state = windows
                .get_mut(&hwnd_key(hwnd))
                .ok_or_else(|| Error::new(Status::GenericFailure, "taskbar window unregistered"))?;
            state.cover = Some(Arc::new(cover));
            state.frames.clear();
        }

        set_iconic_representation(hwnd, true)?;
        invalidate(hwnd);
        Ok(())
    }

    fn clear(hwnd: HWND) {
        let _ = set_iconic_representation(hwnd, false);
        invalidate(hwnd);
        remove_subclass(hwnd);
    }

    fn hwnd_from_buffer(handle: &[u8]) -> Result<HWND> {
        let pointer_size = size_of::<isize>();
        if handle.len() < pointer_size {
            return Err(Error::new(
                Status::InvalidArg,
                format!("native window handle is too short: {}", handle.len()),
            ));
        }

        let value = if pointer_size == 8 {
            let mut bytes = [0_u8; 8];
            bytes.copy_from_slice(&handle[..8]);
            i64::from_le_bytes(bytes) as isize
        } else {
            let mut bytes = [0_u8; 4];
            bytes.copy_from_slice(&handle[..4]);
            i32::from_le_bytes(bytes) as isize
        };

        if value == 0 {
            return Err(Error::new(
                Status::InvalidArg,
                "native window handle is null",
            ));
        }

        Ok(value as HWND)
    }

    fn ensure_subclassed(hwnd: HWND) -> Result<()> {
        let key = hwnd_key(hwnd);

        if registry().contains_key(&key) {
            // 外部组件（Chromium 切全屏、换 DPI）可能重设过 WNDPROC，记录还在但
            // 调用链已断，这时必须重装，否则 DWM 的求助消息永远到不了这里
            let current = unsafe { GetWindowLongPtrW(hwnd, GWLP_WNDPROC) };
            if current == subclass_proc() {
                return Ok(());
            }
            registry().remove(&key);
        }

        unsafe {
            SetLastError(0);
            let original_proc = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, subclass_proc());
            if original_proc == 0 {
                return Err(last_error("SetWindowLongPtrW"));
            }

            registry().insert(
                key,
                WindowState {
                    original_proc,
                    cover: None,
                    frames: HashMap::new(),
                },
            );
        }

        Ok(())
    }

    fn remove_subclass(hwnd: HWND) {
        let state = registry().remove(&hwnd_key(hwnd));

        if let Some(state) = state {
            unsafe {
                SetWindowLongPtrW(hwnd, GWLP_WNDPROC, state.original_proc);
            }
        }
    }

    fn set_iconic_representation(hwnd: HWND, enabled: bool) -> Result<()> {
        let value = i32::from(enabled);
        set_window_attribute(hwnd, DWMWA_FORCE_ICONIC_REPRESENTATION, value)?;
        set_window_attribute(hwnd, DWMWA_HAS_ICONIC_BITMAP, value)
    }

    fn set_window_attribute(hwnd: HWND, attribute: i32, value: i32) -> Result<()> {
        let hr = unsafe {
            DwmSetWindowAttribute(
                hwnd,
                attribute as u32,
                (&raw const value).cast::<c_void>(),
                size_of::<i32>() as u32,
            )
        };

        hresult(hr, "DwmSetWindowAttribute")
    }

    fn invalidate(hwnd: HWND) {
        unsafe {
            let _ = DwmInvalidateIconicBitmaps(hwnd);
        }
    }

    unsafe extern "system" fn wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match msg {
            WM_DWMSENDICONICTHUMBNAIL => {
                if send_thumbnail(hwnd, lparam) {
                    return 0;
                }
            }
            WM_DWMSENDICONICLIVEPREVIEWBITMAP => {
                if send_live_preview(hwnd) {
                    return 0;
                }
            }
            WM_NCDESTROY => {
                let original_proc = registry()
                    .remove(&hwnd_key(hwnd))
                    .map(|state| state.original_proc);
                return call_proc(original_proc, hwnd, msg, wparam, lparam);
            }
            _ => {}
        }

        call_original(hwnd, msg, wparam, lparam)
    }

    fn send_thumbnail(hwnd: HWND, lparam: LPARAM) -> bool {
        let (width, height) = super::thumbnail_size(lparam as usize);

        let Some(frame) = frame(hwnd, width, height) else {
            return false;
        };
        let Some(bitmap) = create_hbitmap(&frame) else {
            return false;
        };

        let hr = unsafe { DwmSetIconicThumbnail(hwnd, bitmap, 0) };
        unsafe {
            DeleteObject(bitmap);
        }

        hr >= 0
    }

    fn send_live_preview(hwnd: HWND) -> bool {
        let Some((width, height)) = client_size(hwnd) else {
            return false;
        };
        let (width, height) = clamp_edge(width, height);

        let Some(frame) = frame(hwnd, width, height) else {
            return false;
        };
        let Some(bitmap) = create_hbitmap(&frame) else {
            return false;
        };

        let hr = unsafe { DwmSetIconicLivePreviewBitmap(hwnd, bitmap, null_mut(), 0) };
        unsafe {
            DeleteObject(bitmap);
        }

        hr >= 0
    }

    fn client_size(hwnd: HWND) -> Option<(u32, u32)> {
        let mut rect: RECT = unsafe { zeroed() };
        let ok = unsafe { GetClientRect(hwnd, &mut rect) };
        if ok == 0 {
            return None;
        }

        // 最小化时客户区为 0，此时 DWM 用缩略图而非预览位图，不响应即可
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width <= 0 || height <= 0 {
            return None;
        }

        Some((width as u32, height as u32))
    }

    fn clamp_edge(width: u32, height: u32) -> (u32, u32) {
        let edge = width.max(height);
        if edge <= MAX_PREVIEW_EDGE {
            return (width, height);
        }

        let scale = f64::from(MAX_PREVIEW_EDGE) / f64::from(edge);
        (
            ((f64::from(width) * scale).round() as u32).max(1),
            ((f64::from(height) * scale).round() as u32).max(1),
        )
    }

    fn frame(hwnd: HWND, width: u32, height: u32) -> Option<Arc<RgbaImage>> {
        let mut windows = registry();
        let state = windows.get_mut(&hwnd_key(hwnd))?;

        if let Some(frame) = state.frames.get(&(width, height)) {
            return Some(frame.clone());
        }

        let cover = state.cover.clone()?;

        if state.frames.len() >= MAX_FRAMES {
            state.frames.clear();
        }

        let frame = Arc::new(cover.fit(width, height));
        state.frames.insert((width, height), frame.clone());

        Some(frame)
    }

    fn create_hbitmap(image: &RgbaImage) -> Option<HBITMAP> {
        let width = image.width();
        let height = image.height();
        let byte_len = width.checked_mul(height)?.checked_mul(4)? as usize;

        let mut bitmap_info: BITMAPINFO = unsafe { zeroed() };
        bitmap_info.bmiHeader = BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width as i32,
            biHeight: -(height as i32),
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB,
            biSizeImage: byte_len as u32,
            biXPelsPerMeter: 0,
            biYPelsPerMeter: 0,
            biClrUsed: 0,
            biClrImportant: 0,
        };

        let mut bits: *mut c_void = null_mut();
        let bitmap = unsafe {
            CreateDIBSection(
                null_mut(),
                &bitmap_info,
                DIB_RGB_COLORS,
                &mut bits,
                null_mut(),
                0,
            )
        };

        if bitmap.is_null() || bits.is_null() {
            return None;
        }

        let dst = unsafe { std::slice::from_raw_parts_mut(bits as *mut u8, byte_len) };
        let (dst, _) = dst.as_chunks_mut::<4>();
        for (pixel, out) in image.pixels().zip(dst) {
            let [red, green, blue, alpha] = pixel.0;
            let alpha_u16 = u16::from(alpha);
            out[0] = premultiply(blue, alpha_u16);
            out[1] = premultiply(green, alpha_u16);
            out[2] = premultiply(red, alpha_u16);
            out[3] = alpha;
        }

        Some(bitmap)
    }

    /// DWM 要求 32 位预乘 alpha
    fn premultiply(color: u8, alpha: u16) -> u8 {
        ((u16::from(color) * alpha + 127) / 255) as u8
    }

    fn call_original(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        let original_proc = registry()
            .get(&hwnd_key(hwnd))
            .map(|state| state.original_proc);
        call_proc(original_proc, hwnd, msg, wparam, lparam)
    }

    fn call_proc(
        original_proc: Option<isize>,
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        unsafe {
            match original_proc {
                Some(original_proc) => {
                    let original_proc: WNDPROC = transmute(original_proc);
                    CallWindowProcW(original_proc, hwnd, msg, wparam, lparam)
                }
                None => DefWindowProcW(hwnd, msg, wparam, lparam),
            }
        }
    }

    fn registry() -> MutexGuard<'static, HashMap<isize, WindowState>> {
        // 所有入口都在 UI 线程，中毒只可能来自此前某次 panic，直接复用内部数据
        WINDOWS.lock().unwrap_or_else(|err| err.into_inner())
    }

    fn subclass_proc() -> isize {
        wnd_proc as *const () as usize as isize
    }

    fn hwnd_key(hwnd: HWND) -> isize {
        hwnd as isize
    }

    fn hresult(hr: i32, operation: &str) -> Result<()> {
        if hr < 0 {
            Err(Error::new(
                Status::GenericFailure,
                format!("{operation} failed: 0x{:08x}", hr as u32),
            ))
        } else {
            Ok(())
        }
    }

    fn last_error(operation: &str) -> Error {
        Error::new(
            Status::GenericFailure,
            format!("{operation} failed: {}", std::io::Error::last_os_error()),
        )
    }
}
