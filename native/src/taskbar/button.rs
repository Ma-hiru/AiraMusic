use windows::Win32::UI::{
    Shell::{THB_BITMAP, THB_FLAGS, THB_TOOLTIP, THBF_ENABLED, THUMBBUTTON},
    WindowsAndMessaging::HICON,
};

/// 按钮 ID: 上一首
pub const BTN_PREV: u32 = 0;
/// 按钮 ID: 播放/暂停
pub const BTN_PLAY: u32 = 1;
/// 按钮 ID: 下一首
pub const BTN_NEXT: u32 = 2;

/// 创建缩略图按钮
pub fn create_thumb_button(id: u32, icon: HICON, tooltip: &str) -> THUMBBUTTON {
    let mut button = THUMBBUTTON {
        dwMask: THB_BITMAP | THB_FLAGS | THB_TOOLTIP,
        iId: id,
        hIcon: icon,
        dwFlags: THBF_ENABLED,
        ..Default::default()
    };

    // 设置 tooltip
    let tooltip_wide: Vec<u16> = tooltip.encode_utf16().chain(std::iter::once(0)).collect();
    let len = tooltip_wide.len().min(button.szTip.len());
    button.szTip[..len].copy_from_slice(&tooltip_wide[..len]);

    button
}
