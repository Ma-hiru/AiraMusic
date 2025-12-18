//! 图标创建相关

use napi::bindgen_prelude::*;
use windows::Win32::UI::WindowsAndMessaging::{CreateIconFromResourceEx, HICON, LR_DEFAULTCOLOR};

/// 从 ICO 数据创建图标
pub fn create_icon_from_ico(ico_data: &[u8]) -> Result<HICON> {
    unsafe {
        let icon = CreateIconFromResourceEx(
            ico_data,
            true,
            0x00030000, // Icon version
            20,         // Width
            20,         // Height
            LR_DEFAULTCOLOR,
        )
        .map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to create icon: {}", e),
            )
        })?;

        Ok(icon)
    }
}
