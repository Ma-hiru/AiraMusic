mod taskbar;
mod utils;

use napi::bindgen_prelude::*;
use napi::threadsafe_function::ThreadsafeFunction;
use napi_derive::napi;
use once_cell::sync::OnceCell;
use std::sync::Mutex;
use windows::Win32::{
    Graphics::Gdi::{DeleteObject, HBITMAP},
    UI::WindowsAndMessaging::{GWLP_WNDPROC, GetWindowLongPtrW, SetWindowLongPtrW},
};

use taskbar::{
    BTN_NEXT, BTN_PLAY, BTN_PREV, CALLBACK, ORIGINAL_WNDPROC, TaskbarManager,
    create_bitmap_from_rgba, set_thumbnail, subclass_wndproc,
};
use utils::buffer_to_hwnd;

/// 全局任务栏管理器实例
static TASKBAR: OnceCell<Mutex<TaskbarManager>> = OnceCell::new();
/// 当前缩略图位图句柄（用于清理，存储为 isize）
static THUMBNAIL_BITMAP: OnceCell<Mutex<Option<isize>>> = OnceCell::new();

/// 初始化任务栏管理器
/// hwnd: Electron 窗口句柄 (可通过 win.getNativeWindowHandle() 获取)
#[napi]
pub fn init_taskbar(hwnd_buffer: Buffer) -> Result<()> {
    let hwnd = buffer_to_hwnd(&hwnd_buffer)?;

    let manager = TaskbarManager::new(hwnd)?;

    TASKBAR
        .set(Mutex::new(manager))
        .map_err(|_| Error::new(Status::GenericFailure, "Taskbar already initialized"))?;

    // 设置窗口子类化以捕获按钮点击
    unsafe {
        let original = GetWindowLongPtrW(hwnd, GWLP_WNDPROC);
        ORIGINAL_WNDPROC
            .set(original)
            .map_err(|_| Error::new(Status::GenericFailure, "WndProc already set"))?;

        SetWindowLongPtrW(hwnd, GWLP_WNDPROC, subclass_wndproc as usize as isize);
    }

    Ok(())
}

/// 设置按钮图标
/// 图标应为 ICO 格式的二进制数据
#[napi]
pub fn set_thumb_icons(
    prev_icon: Buffer,
    play_icon: Buffer,
    pause_icon: Buffer,
    next_icon: Buffer,
) -> Result<()> {
    let taskbar = TASKBAR
        .get()
        .ok_or_else(|| Error::new(Status::GenericFailure, "Taskbar not initialized"))?;

    let mut manager = taskbar
        .lock()
        .map_err(|_| Error::new(Status::GenericFailure, "Failed to lock taskbar"))?;

    manager.set_icons(&prev_icon, &play_icon, &pause_icon, &next_icon)?;
    manager.add_buttons()?;

    Ok(())
}

/// 设置按钮点击回调
#[napi]
pub fn set_thumb_callback(callback: ThreadsafeFunction<String>) -> Result<()> {
    CALLBACK.get_or_init(|| Mutex::new(None));

    if let Some(cb_mutex) = CALLBACK.get()
        && let Ok(mut cb) = cb_mutex.lock()
    {
        *cb = Some(callback);
    }

    Ok(())
}

/// 更新播放状态（切换播放/暂停图标）
#[napi]
pub fn update_play_state(is_playing: bool) -> Result<()> {
    let taskbar = TASKBAR
        .get()
        .ok_or_else(|| Error::new(Status::GenericFailure, "Taskbar not initialized"))?;

    let mut manager = taskbar
        .lock()
        .map_err(|_| Error::new(Status::GenericFailure, "Failed to lock taskbar"))?;

    manager.update_play_state(is_playing)
}

/// 设置按钮启用/禁用状态
/// button: "prev" | "play" | "next"
#[napi]
pub fn set_button_enabled(button: String, enabled: bool) -> Result<()> {
    let taskbar = TASKBAR
        .get()
        .ok_or_else(|| Error::new(Status::GenericFailure, "Taskbar not initialized"))?;

    let mut manager = taskbar
        .lock()
        .map_err(|_| Error::new(Status::GenericFailure, "Failed to lock taskbar"))?;

    let button_id = match button.as_str() {
        "prev" => BTN_PREV,
        "play" => BTN_PLAY,
        "next" => BTN_NEXT,
        _ => return Err(Error::new(Status::InvalidArg, "Invalid button name")),
    };

    manager.set_button_enabled(button_id, enabled)
}

/// 设置任务栏缩略图预览图片（音乐封面）
///
/// # Arguments
/// * `rgba_data` - RGBA 格式的图片数据（每像素 4 字节，顺序为 R, G, B, A）
/// * `width` - 图片宽度
/// * `height` - 图片高度
#[napi]
pub fn set_thumbnail_image(rgba_data: Buffer, width: u32, height: u32) -> Result<()> {
    let taskbar = TASKBAR
        .get()
        .ok_or_else(|| Error::new(Status::GenericFailure, "Taskbar not initialized"))?;

    let manager = taskbar
        .lock()
        .map_err(|_| Error::new(Status::GenericFailure, "Failed to lock taskbar"))?;

    // 创建新位图
    let new_bitmap = create_bitmap_from_rgba(&rgba_data, width, height)?;

    // 设置缩略图
    set_thumbnail(manager.hwnd, new_bitmap)?;

    // 清理旧位图并保存新位图句柄
    THUMBNAIL_BITMAP.get_or_init(|| Mutex::new(None));
    if let Some(bitmap_mutex) = THUMBNAIL_BITMAP.get()
        && let Ok(mut bitmap_guard) = bitmap_mutex.lock()
    {
        // 删除旧位图
        if let Some(old_bitmap_handle) = bitmap_guard.take() {
            unsafe {
                let old_bitmap = HBITMAP(old_bitmap_handle as *mut std::ffi::c_void);
                let _ = DeleteObject(old_bitmap.into());
            }
        }
        // 保存新位图句柄（作为 isize 存储）
        *bitmap_guard = Some(new_bitmap.0 as isize);
    }

    Ok(())
}

/// 清除任务栏缩略图预览
#[napi]
pub fn clear_thumbnail() -> Result<()> {
    // 清理位图
    if let Some(bitmap_mutex) = THUMBNAIL_BITMAP.get()
        && let Ok(mut bitmap_guard) = bitmap_mutex.lock()
        && let Some(bitmap_handle) = bitmap_guard.take()
    {
        unsafe {
            let bitmap = HBITMAP(bitmap_handle as *mut std::ffi::c_void);
            let _ = DeleteObject(bitmap.into());
        }
    }

    Ok(())
}

/// 销毁任务栏管理器
#[napi]
pub fn destroy_taskbar() -> Result<()> {
    // 清理缩略图
    let _ = clear_thumbnail();

    // 恢复原始窗口过程
    if let (Some(taskbar), Some(&original)) = (TASKBAR.get(), ORIGINAL_WNDPROC.get())
        && let Ok(manager) = taskbar.lock()
    {
        unsafe {
            SetWindowLongPtrW(manager.hwnd, GWLP_WNDPROC, original);
        }
    }

    Ok(())
}
