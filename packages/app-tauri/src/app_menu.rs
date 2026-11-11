//! macOS 应用菜单。
//!
//! Tauri 的默认菜单里「退出」用的是 `PredefinedMenuItem::quit`，也就是 AppKit 的
//! `terminate:` —— **进程会被直接结束**：`RunEvent::ExitRequested` 不会触发，
//! 我们既拦不住，也没机会让渲染层保存（这正是 Cmd+Q 丢数据的真因）。
//!
//! 所以这里自己建一份菜单：结构照搬 Tauri 的默认布局，只把「退出」换成普通菜单项，
//! 由 `on_menu_event` 收到后走 [`crate::lifecycle`] 的窗口语义（按焦点窗口决定关窗还是整体退出）。

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::AppHandle;

/// 自建「退出」菜单项的 id
pub const MENU_APP_QUIT: &str = "app-quit";

/// 构建应用菜单（仅 macOS；其它平台继续用 Tauri 默认菜单）。
///
/// 通过 `Builder::menu()` 在 build 之前安装：只有这样 Tauri 才不会再塞一份默认菜单
/// （默认菜单的「退出」= `terminate:`，会绕过所有退出逻辑）。
#[cfg(target_os = "macos")]
pub fn build(app: &AppHandle, app_name: &str) -> tauri::Result<Menu<tauri::Wry>> {
    let about = PredefinedMenuItem::about(app, Some(&format!("关于 {app_name}")), None)?;
    let services = PredefinedMenuItem::services(app, Some("服务"))?;
    let hide = PredefinedMenuItem::hide(app, Some(&format!("隐藏 {app_name}")))?;
    let hide_others = PredefinedMenuItem::hide_others(app, Some("隐藏其他"))?;
    let show_all = PredefinedMenuItem::show_all(app, Some("显示全部"))?;
    // 关键：普通菜单项（不是 PredefinedMenuItem::quit），不会走 terminate:
    let quit = MenuItem::with_id(
        app,
        MENU_APP_QUIT,
        format!("退出 {app_name}"),
        true,
        Some("CmdOrCtrl+Q"),
    )?;

    let app_menu = Submenu::with_items(
        app,
        app_name,
        true,
        &[
            &about,
            &PredefinedMenuItem::separator(app)?,
            &services,
            &PredefinedMenuItem::separator(app)?,
            &hide,
            &hide_others,
            &show_all,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let file_menu = Submenu::with_items(
        app,
        "文件",
        true,
        &[&PredefinedMenuItem::close_window(app, Some("关闭窗口"))?],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "编辑",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("撤销"))?,
            &PredefinedMenuItem::redo(app, Some("重做"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some("剪切"))?,
            &PredefinedMenuItem::copy(app, Some("复制"))?,
            &PredefinedMenuItem::paste(app, Some("粘贴"))?,
            &PredefinedMenuItem::select_all(app, Some("全选"))?,
        ],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "窗口",
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some("最小化"))?,
            &PredefinedMenuItem::maximize(app, Some("缩放"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, Some("关闭"))?,
        ],
    )?;

    let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &window_menu])?;
    crate::host_log!("[menu] 应用菜单已安装：退出项 id={MENU_APP_QUIT}（Cmd+Q 走退出编排）");
    Ok(menu)
}
