//! 工具函数

use napi::bindgen_prelude::*;
use std::ffi::c_void;
use windows::Win32::Foundation::HWND;

/// 将 Node.js Buffer 转换为 HWND
pub fn buffer_to_hwnd(buffer: &Buffer) -> Result<HWND> {
    if buffer.len() < size_of::<isize>() {
        return Err(Error::new(Status::InvalidArg, "Invalid HWND buffer size"));
    }

    let hwnd_value = if buffer.len() == 8 {
        // 64-bit
        i64::from_ne_bytes(buffer[..8].try_into().unwrap()) as isize
    } else if buffer.len() == 4 {
        // 32-bit
        i32::from_ne_bytes(buffer[..4].try_into().unwrap()) as isize
    } else {
        return Err(Error::new(Status::InvalidArg, "Invalid HWND buffer size"));
    };

    Ok(HWND(hwnd_value as *mut c_void))
}
