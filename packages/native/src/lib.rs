/// native 项目
/// 使用 codex 和 claude code 生成
use napi::bindgen_prelude::{Buffer, Result, Uint8Array};
use napi_derive::napi;

#[cfg(windows)]
#[napi(js_name = "setCover")]
pub fn set_cover(
    handle: Buffer,
    image: Option<Uint8Array>,
    preview: Option<Uint8Array>,
) -> Result<()> {
    windows_taskbar::set_cover(
        handle.as_ref(),
        image.as_ref().map(|bytes| bytes.as_ref()),
        preview.as_ref().map(|bytes| bytes.as_ref()),
    )
}

#[cfg(not(windows))]
#[napi(js_name = "setCover")]
pub fn set_cover(
    handle: Buffer,
    image: Option<Uint8Array>,
    preview: Option<Uint8Array>,
) -> Result<()> {
    let _ = handle;
    let _ = image;
    let _ = preview;
    Ok(())
}

#[cfg(windows)]
mod windows_taskbar {
    use std::{
        collections::HashMap,
        ffi::c_void,
        mem::{size_of, transmute, zeroed},
        ptr::null_mut,
        sync::{Arc, Mutex},
    };

    use image::{RgbaImage, imageops};
    use napi::{Error, Result, Status};
    use once_cell::sync::Lazy;
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, LRESULT, SetLastError, WPARAM},
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
            CallWindowProcW, DefWindowProcW, GWLP_WNDPROC, SetWindowLongPtrW, WM_NCDESTROY, WNDPROC,
        },
    };

    const WM_DWMSENDICONICTHUMBNAIL: u32 = 0x0323;
    const WM_DWMSENDICONICLIVEPREVIEWBITMAP: u32 = 0x0326;

    static WINDOWS: Lazy<Mutex<HashMap<isize, WindowState>>> =
        Lazy::new(|| Mutex::new(HashMap::new()));

    struct WindowState {
        original_proc: isize,
        cover: Option<Arc<CoverImage>>,
        preview: Option<Arc<CoverImage>>,
    }

    struct CoverImage {
        rgba: RgbaImage,
    }

    impl CoverImage {
        fn from_bytes(bytes: &[u8]) -> Result<Self> {
            let image = image::load_from_memory(bytes)
                .map_err(|err| {
                    Error::new(Status::InvalidArg, format!("decode cover failed: {err}"))
                })?
                .to_rgba8();

            if image.width() == 0 || image.height() == 0 {
                return Err(Error::new(Status::InvalidArg, "cover image is empty"));
            }

            Ok(Self { rgba: image })
        }

        fn render_hbitmap(&self, width: u32, height: u32) -> Option<HBITMAP> {
            let width = width.max(1);
            let height = height.max(1);
            let resized = self.resize_cover(width, height);
            create_hbitmap_from_rgba(&resized)
        }

        fn render_original_hbitmap(&self) -> Option<HBITMAP> {
            create_hbitmap_from_rgba(&self.rgba)
        }

        fn resize_cover(&self, width: u32, height: u32) -> RgbaImage {
            let src_width = self.rgba.width();
            let src_height = self.rgba.height();
            let src_ratio = src_width as f64 / src_height as f64;
            let dst_ratio = width as f64 / height as f64;

            let (crop_x, crop_y, crop_width, crop_height) = if src_ratio > dst_ratio {
                let crop_width =
                    ((src_height as f64 * dst_ratio).round() as u32).clamp(1, src_width);
                ((src_width - crop_width) / 2, 0, crop_width, src_height)
            } else {
                let crop_height =
                    ((src_width as f64 / dst_ratio).round() as u32).clamp(1, src_height);
                (0, (src_height - crop_height) / 2, src_width, crop_height)
            };

            let cropped =
                imageops::crop_imm(&self.rgba, crop_x, crop_y, crop_width, crop_height).to_image();
            imageops::resize(&cropped, width, height, imageops::FilterType::Lanczos3)
        }
    }

    pub fn set_cover(handle: &[u8], image: Option<&[u8]>, preview: Option<&[u8]>) -> Result<()> {
        let hwnd = hwnd_from_buffer(handle)?;

        match image {
            Some(bytes) => {
                let cover = Arc::new(CoverImage::from_bytes(bytes)?);
                let preview = preview
                    .map(CoverImage::from_bytes)
                    .transpose()?
                    .map(Arc::new);
                ensure_subclassed(hwnd)?;
                update_state(hwnd, cover, preview);
                set_iconic_attributes(hwnd, true)?;
                invalidate(hwnd);
            }
            None => {
                clear_state(hwnd);
                set_iconic_attributes(hwnd, false)?;
                invalidate(hwnd);
                restore_window_proc(hwnd);
            }
        }

        Ok(())
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
        {
            let windows = WINDOWS.lock().expect("taskbar window registry poisoned");
            if windows.contains_key(&key) {
                return Ok(());
            }
        }

        unsafe {
            SetLastError(0);
            let original_proc = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, wnd_proc as usize as isize);
            if original_proc == 0 {
                return Err(last_error("SetWindowLongPtrW"));
            }

            let mut windows = WINDOWS.lock().expect("taskbar window registry poisoned");
            windows.insert(
                key,
                WindowState {
                    original_proc,
                    cover: None,
                    preview: None,
                },
            );
        }

        Ok(())
    }

    fn update_state(hwnd: HWND, cover: Arc<CoverImage>, preview: Option<Arc<CoverImage>>) {
        let mut windows = WINDOWS.lock().expect("taskbar window registry poisoned");
        if let Some(state) = windows.get_mut(&hwnd_key(hwnd)) {
            state.cover = Some(cover);
            if let Some(preview) = preview {
                state.preview = Some(preview);
            }
        }
    }

    fn clear_state(hwnd: HWND) {
        let mut windows = WINDOWS.lock().expect("taskbar window registry poisoned");
        if let Some(state) = windows.get_mut(&hwnd_key(hwnd)) {
            state.cover = None;
            state.preview = None;
        }
    }

    fn restore_window_proc(hwnd: HWND) {
        let state = {
            let mut windows = WINDOWS.lock().expect("taskbar window registry poisoned");
            windows.remove(&hwnd_key(hwnd))
        };

        if let Some(state) = state {
            unsafe {
                SetWindowLongPtrW(hwnd, GWLP_WNDPROC, state.original_proc);
            }
        }
    }

    fn set_iconic_attributes(hwnd: HWND, enabled: bool) -> Result<()> {
        let force_iconic: i32 = if enabled { 1 } else { 0 };
        let has_iconic_bitmap: i32 = if enabled { 1 } else { 0 };
        set_window_attribute(hwnd, DWMWA_FORCE_ICONIC_REPRESENTATION, &force_iconic)?;
        set_window_attribute(hwnd, DWMWA_HAS_ICONIC_BITMAP, &has_iconic_bitmap)?;
        Ok(())
    }

    fn set_window_attribute(hwnd: HWND, attribute: i32, value: &i32) -> Result<()> {
        let hr = unsafe {
            DwmSetWindowAttribute(
                hwnd,
                attribute as u32,
                value as *const i32 as *const c_void,
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
                let width = hiword(lparam as usize).max(1);
                let height = loword(lparam as usize).max(1);
                if send_thumbnail(hwnd, width, height) {
                    return 0;
                }
            }
            WM_DWMSENDICONICLIVEPREVIEWBITMAP => {
                if send_live_preview(hwnd) {
                    return 0;
                }
            }
            WM_NCDESTROY => {
                let original_proc = {
                    let mut windows = WINDOWS.lock().expect("taskbar window registry poisoned");
                    windows
                        .remove(&hwnd_key(hwnd))
                        .map(|state| state.original_proc)
                };
                return call_original_or_default(original_proc, hwnd, msg, wparam, lparam);
            }
            _ => {}
        }

        let original_proc = {
            let windows = WINDOWS.lock().expect("taskbar window registry poisoned");
            windows
                .get(&hwnd_key(hwnd))
                .map(|state| state.original_proc)
        };

        call_original_or_default(original_proc, hwnd, msg, wparam, lparam)
    }

    fn send_thumbnail(hwnd: HWND, width: u32, height: u32) -> bool {
        let cover = current_cover(hwnd);
        let Some(cover) = cover else {
            return false;
        };

        let side = width.min(height).max(1);
        let Some(bitmap) = cover.render_hbitmap(side, side) else {
            return false;
        };

        let hr = unsafe { DwmSetIconicThumbnail(hwnd, bitmap, 0) };
        unsafe {
            DeleteObject(bitmap);
        }

        hr >= 0
    }

    fn send_live_preview(hwnd: HWND) -> bool {
        let preview = current_preview(hwnd);
        let Some(preview) = preview else {
            return false;
        };

        let Some(bitmap) = preview.render_original_hbitmap() else {
            return false;
        };

        let hr = unsafe { DwmSetIconicLivePreviewBitmap(hwnd, bitmap, null_mut(), 0) };
        unsafe {
            DeleteObject(bitmap);
        }

        hr >= 0
    }

    fn current_cover(hwnd: HWND) -> Option<Arc<CoverImage>> {
        let windows = WINDOWS.lock().expect("taskbar window registry poisoned");
        windows
            .get(&hwnd_key(hwnd))
            .and_then(|state| state.cover.as_ref().cloned())
    }

    fn current_preview(hwnd: HWND) -> Option<Arc<CoverImage>> {
        let windows = WINDOWS.lock().expect("taskbar window registry poisoned");
        windows
            .get(&hwnd_key(hwnd))
            .and_then(|state| state.preview.as_ref().cloned())
    }

    fn create_hbitmap_from_rgba(image: &RgbaImage) -> Option<HBITMAP> {
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
        for (pixel, out) in image.pixels().zip(dst.chunks_exact_mut(4)) {
            let [red, green, blue, alpha] = pixel.0;
            let alpha_u16 = alpha as u16;
            out[0] = premultiply(blue, alpha_u16);
            out[1] = premultiply(green, alpha_u16);
            out[2] = premultiply(red, alpha_u16);
            out[3] = alpha;
        }

        Some(bitmap)
    }

    fn premultiply(color: u8, alpha: u16) -> u8 {
        (((color as u16) * alpha + 127) / 255) as u8
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

    fn loword(value: usize) -> u32 {
        (value & 0xffff) as u32
    }

    fn hiword(value: usize) -> u32 {
        ((value >> 16) & 0xffff) as u32
    }

    fn call_original_or_default(
        original_proc: Option<isize>,
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if let Some(original_proc) = original_proc {
            unsafe {
                let original_proc: WNDPROC = transmute(original_proc);
                CallWindowProcW(original_proc, hwnd, msg, wparam, lparam)
            }
        } else {
            unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
        }
    }
}
