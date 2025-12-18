//! 任务栏管理器

use napi::bindgen_prelude::*;
use windows::Win32::{
    Foundation::HWND,
    System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED},
    UI::{
        Shell::{ITaskbarList3, TaskbarList, THB_BITMAP, THB_FLAGS, THB_TOOLTIP, THBF_DISABLED, THBF_ENABLED, THUMBBUTTON},
        WindowsAndMessaging::{DestroyIcon, HICON},
    },
};

use super::button::{create_thumb_button, BTN_NEXT, BTN_PLAY, BTN_PREV};
use super::icon::create_icon_from_ico;

/// 任务栏缩略图按钮管理器
pub struct TaskbarManager {
    pub(crate) hwnd: HWND,
    taskbar: ITaskbarList3,
    buttons_added: bool,
    is_playing: bool,
    icon_prev: Option<HICON>,
    icon_play: Option<HICON>,
    icon_pause: Option<HICON>,
    icon_next: Option<HICON>,
}

// Safety: ITaskbarList3 is thread-safe when used with COM apartment threading
unsafe impl Send for TaskbarManager {}
unsafe impl Sync for TaskbarManager {}

impl TaskbarManager {
    /// 创建新的任务栏管理器
    pub fn new(hwnd: HWND) -> Result<Self> {
        unsafe {
            // 初始化 COM
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            // 创建 ITaskbarList3 实例
            let taskbar: ITaskbarList3 = CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER)
                .map_err(|e| {
                    Error::new(
                        Status::GenericFailure,
                        format!("Failed to create ITaskbarList3: {}", e),
                    )
                })?;

            // 初始化 taskbar
            taskbar.HrInit().map_err(|e| {
                Error::new(
                    Status::GenericFailure,
                    format!("Failed to init taskbar: {}", e),
                )
            })?;

            Ok(Self {
                hwnd,
                taskbar,
                buttons_added: false,
                is_playing: false,
                icon_prev: None,
                icon_play: None,
                icon_pause: None,
                icon_next: None,
            })
        }
    }

    /// 设置按钮图标
    pub fn set_icons(
        &mut self,
        prev: &[u8],
        play: &[u8],
        pause: &[u8],
        next: &[u8],
    ) -> Result<()> {
        // 清理旧图标
        self.cleanup_icons();

        // 创建新图标
        self.icon_prev = Some(create_icon_from_ico(prev)?);
        self.icon_play = Some(create_icon_from_ico(play)?);
        self.icon_pause = Some(create_icon_from_ico(pause)?);
        self.icon_next = Some(create_icon_from_ico(next)?);

        Ok(())
    }

    /// 清理图标资源
    fn cleanup_icons(&mut self) {
        unsafe {
            if let Some(icon) = self.icon_prev.take() {
                let _ = DestroyIcon(icon);
            }
            if let Some(icon) = self.icon_play.take() {
                let _ = DestroyIcon(icon);
            }
            if let Some(icon) = self.icon_pause.take() {
                let _ = DestroyIcon(icon);
            }
            if let Some(icon) = self.icon_next.take() {
                let _ = DestroyIcon(icon);
            }
        }
    }

    /// 添加缩略图按钮到任务栏
    pub fn add_buttons(&mut self) -> Result<()> {
        if self.buttons_added {
            return Ok(());
        }

        let icon_prev = self
            .icon_prev
            .ok_or_else(|| Error::new(Status::GenericFailure, "Icon prev not set"))?;
        let icon_play = self
            .icon_play
            .ok_or_else(|| Error::new(Status::GenericFailure, "Icon play not set"))?;
        let icon_next = self
            .icon_next
            .ok_or_else(|| Error::new(Status::GenericFailure, "Icon next not set"))?;

        let buttons = [
            create_thumb_button(BTN_PREV, icon_prev, "上一首"),
            create_thumb_button(BTN_PLAY, icon_play, "播放"),
            create_thumb_button(BTN_NEXT, icon_next, "下一首"),
        ];

        unsafe {
            self.taskbar
                .ThumbBarAddButtons(self.hwnd, &buttons)
                .map_err(|e| {
                    Error::new(
                        Status::GenericFailure,
                        format!("Failed to add thumb buttons: {}", e),
                    )
                })?;
        }

        self.buttons_added = true;
        Ok(())
    }

    /// 更新播放状态（切换播放/暂停图标）
    pub fn update_play_state(&mut self, is_playing: bool) -> Result<()> {
        if !self.buttons_added {
            return Ok(());
        }

        self.is_playing = is_playing;

        let icon = if is_playing {
            self.icon_pause
        } else {
            self.icon_play
        }
        .ok_or_else(|| Error::new(Status::GenericFailure, "Play/pause icon not set"))?;

        let tooltip = if is_playing { "暂停" } else { "播放" };
        let button = create_thumb_button(BTN_PLAY, icon, tooltip);

        unsafe {
            self.taskbar
                .ThumbBarUpdateButtons(self.hwnd, &[button])
                .map_err(|e| {
                    Error::new(
                        Status::GenericFailure,
                        format!("Failed to update thumb button: {}", e),
                    )
                })?;
        }

        Ok(())
    }

    /// 设置按钮启用/禁用状态
    pub fn set_button_enabled(&mut self, button_id: u32, enabled: bool) -> Result<()> {
        if !self.buttons_added {
            return Ok(());
        }

        let (icon, tooltip) = match button_id {
            BTN_PREV => (self.icon_prev, "上一首"),
            BTN_PLAY => {
                if self.is_playing {
                    (self.icon_pause, "暂停")
                } else {
                    (self.icon_play, "播放")
                }
            }
            BTN_NEXT => (self.icon_next, "下一首"),
            _ => return Err(Error::new(Status::InvalidArg, "Invalid button id")),
        };

        let icon = icon.ok_or_else(|| Error::new(Status::GenericFailure, "Icon not set"))?;

        let mut button = THUMBBUTTON {
            dwMask: THB_FLAGS | THB_BITMAP | THB_TOOLTIP,
            iId: button_id,
            hIcon: icon,
            dwFlags: if enabled { THBF_ENABLED } else { THBF_DISABLED },
            ..Default::default()
        };

        // Set tooltip
        let tooltip_wide: Vec<u16> = tooltip.encode_utf16().chain(std::iter::once(0)).collect();
        let len = tooltip_wide.len().min(button.szTip.len());
        button.szTip[..len].copy_from_slice(&tooltip_wide[..len]);

        unsafe {
            self.taskbar
                .ThumbBarUpdateButtons(self.hwnd, &[button])
                .map_err(|e| {
                    Error::new(
                        Status::GenericFailure,
                        format!("Failed to update button: {}", e),
                    )
                })?;
        }

        Ok(())
    }
}

impl Drop for TaskbarManager {
    fn drop(&mut self) {
        self.cleanup_icons();
    }
}
