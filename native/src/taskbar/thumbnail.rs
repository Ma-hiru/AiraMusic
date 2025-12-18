//! 任务栏缩略图预览（封面图）

use napi::bindgen_prelude::*;
use windows::Win32::{
    Foundation::HWND,
    Graphics::{
        Dwm::{DwmInvalidateIconicBitmaps, DwmSetIconicThumbnail, DwmSetWindowAttribute, DWMWA_FORCE_ICONIC_REPRESENTATION, DWMWA_HAS_ICONIC_BITMAP},
        Gdi::{
            CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject,
            BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP,
        },
    },
};

/// 从 RGBA 数据创建 HBITMAP
/// 
/// # Arguments
/// * `rgba_data` - RGBA 格式的图片数据（每像素 4 字节）
/// * `width` - 图片宽度
/// * `height` - 图片高度
pub fn create_bitmap_from_rgba(rgba_data: &[u8], width: u32, height: u32) -> Result<HBITMAP> {
    let expected_size = (width * height * 4) as usize;
    if rgba_data.len() != expected_size {
        return Err(Error::new(
            Status::InvalidArg,
            format!(
                "Invalid RGBA data size: expected {}, got {}",
                expected_size,
                rgba_data.len()
            ),
        ));
    }

    unsafe {
        // 创建兼容 DC
        let hdc = CreateCompatibleDC(None);
        if hdc.is_invalid() {
            return Err(Error::new(
                Status::GenericFailure,
                "Failed to create compatible DC",
            ));
        }

        // 设置 BITMAPINFO
        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width as i32,
                biHeight: -(height as i32), // 负数表示自上而下
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [Default::default()],
        };

        // 创建 DIB Section
        let mut bits_ptr: *mut std::ffi::c_void = std::ptr::null_mut();
        let hbitmap = CreateDIBSection(Some(hdc), &bmi, DIB_RGB_COLORS, &mut bits_ptr, None, 0)
            .map_err(|e| {
                let _ = DeleteDC(hdc);
                Error::new(
                    Status::GenericFailure,
                    format!("Failed to create DIB section: {}", e),
                )
            })?;

        if bits_ptr.is_null() {
            let _ = DeleteDC(hdc);
            let _ = DeleteObject(hbitmap.into());
            return Err(Error::new(
                Status::GenericFailure,
                "DIB section bits pointer is null",
            ));
        }

        // 将 RGBA 数据转换为 BGRA 并复制到位图
        let pixel_count = (width * height) as usize;
        let bits = std::slice::from_raw_parts_mut(bits_ptr as *mut u8, pixel_count * 4);

        for i in 0..pixel_count {
            let src_offset = i * 4;
            let dst_offset = i * 4;
            
            let r = rgba_data[src_offset];
            let g = rgba_data[src_offset + 1];
            let b = rgba_data[src_offset + 2];
            let a = rgba_data[src_offset + 3];

            // Windows 使用预乘 alpha 的 BGRA 格式
            let alpha = a as f32 / 255.0;
            bits[dst_offset] = (b as f32 * alpha) as u8;     // B
            bits[dst_offset + 1] = (g as f32 * alpha) as u8; // G
            bits[dst_offset + 2] = (r as f32 * alpha) as u8; // R
            bits[dst_offset + 3] = a;                         // A
        }

        let _ = DeleteDC(hdc);
        Ok(hbitmap)
    }
}

/// 设置窗口的缩略图预览图片
/// 
/// # Arguments
/// * `hwnd` - 窗口句柄
/// * `hbitmap` - 位图句柄
pub fn set_thumbnail(hwnd: HWND, hbitmap: HBITMAP) -> Result<()> {
    unsafe {
        // 启用自定义缩略图
        let value: i32 = 1;
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_FORCE_ICONIC_REPRESENTATION,
            &value as *const _ as *const std::ffi::c_void,
            size_of::<i32>() as u32,
        )
        .map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to set DWMWA_FORCE_ICONIC_REPRESENTATION: {}", e),
            )
        })?;

        DwmSetWindowAttribute(
            hwnd,
            DWMWA_HAS_ICONIC_BITMAP,
            &value as *const _ as *const std::ffi::c_void,
            size_of::<i32>() as u32,
        )
        .map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to set DWMWA_HAS_ICONIC_BITMAP: {}", e),
            )
        })?;

        // 设置缩略图
        DwmSetIconicThumbnail(hwnd, hbitmap, 0).map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to set iconic thumbnail: {}", e),
            )
        })?;

        Ok(())
    }
}

/// 使缩略图失效，触发重绘
#[allow(dead_code)]
pub fn invalidate_thumbnail(hwnd: HWND) -> Result<()> {
    unsafe {
        DwmInvalidateIconicBitmaps(hwnd).map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to invalidate iconic bitmaps: {}", e),
            )
        })?;
        Ok(())
    }
}
