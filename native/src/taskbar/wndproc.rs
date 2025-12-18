//! 窗口消息处理相关

use napi::threadsafe_function::ThreadsafeFunction;
use once_cell::sync::OnceCell;
use std::sync::Mutex;
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{CallWindowProcW, WM_COMMAND},
};

use super::button::{BTN_NEXT, BTN_PLAY, BTN_PREV};

/// 全局回调函数
pub static CALLBACK: OnceCell<Mutex<Option<ThreadsafeFunction<String>>>> = OnceCell::new();
/// 原始窗口过程
pub static ORIGINAL_WNDPROC: OnceCell<isize> = OnceCell::new();

/// 窗口消息处理回调（子类化窗口过程）
pub unsafe extern "system" fn subclass_wndproc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if msg == WM_COMMAND {
        let btn_id = (wparam.0 & 0xFFFF) as u32;

        // 检查是否是我们的按钮
        if btn_id <= BTN_NEXT {
            let action = match btn_id {
                BTN_PREV => "previous",
                BTN_PLAY => "play-pause",
                BTN_NEXT => "next",
                _ => return LRESULT(0),
            };

            // 调用 JS 回调
            if let Some(callback_mutex) = CALLBACK.get()
                && let Ok(callback_guard) = callback_mutex.lock()
                && let Some(callback) = callback_guard.as_ref()
            {
                callback.call(
                    Ok(action.to_string()),
                    napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking,
                );
            }

            return LRESULT(0);
        }
    }

    // 调用原始窗口过程
    if let Some(&original) = ORIGINAL_WNDPROC.get() {
        unsafe {
            CallWindowProcW(
                Some(std::mem::transmute::<
                    isize,
                    unsafe extern "system" fn(HWND, u32, WPARAM, LPARAM) -> LRESULT,
                >(original)),
                hwnd,
                msg,
                wparam,
                lparam,
            )
        }
    } else {
        LRESULT(0)
    }
}
