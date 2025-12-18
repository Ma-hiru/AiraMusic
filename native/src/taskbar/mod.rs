//! 任务栏缩略图管理模块

mod manager;
mod button;
mod icon;
mod thumbnail;
mod wndproc;

pub use manager::TaskbarManager;
pub use button::{BTN_PREV, BTN_PLAY, BTN_NEXT};
pub use thumbnail::{create_bitmap_from_rgba, set_thumbnail};
pub use wndproc::{subclass_wndproc, CALLBACK, ORIGINAL_WNDPROC};
