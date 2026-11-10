//! 原生能力入口
//!
//! - `win.rs`：Windows 任务栏缩略图与预览工具栏，**只在 Windows 目标编译**；
//! - `darwin.rs`：macOS 菜单栏歌词胶囊，**只在 macOS 目标编译**；
//! - `utils.rs`：跨平台纯计算，所有目标都编译，便于在任意机器上跑单测。
//!
//! 每个平台的产物因此只导出本平台的 `napi` 函数，另一端不会编译更不会链接它们。

#[cfg(target_os = "macos")]
pub mod darwin;
#[cfg_attr(not(windows), allow(dead_code))]
mod utils;
#[cfg(target_os = "windows")]
pub mod win;
