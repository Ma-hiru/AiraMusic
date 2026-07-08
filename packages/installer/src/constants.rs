use windows_reactor::{Backdrop, InnerConstraints};

pub const APP_NAME: &str = "AiraMusic";
pub const APP_TITLE: &str = "AiraMusic Installer";
pub const APP_WIDTH: f64 = 1024.0;
pub const APP_HEIGHT: f64 = 600.0;
pub const APP_BACKDROP: Backdrop = Backdrop::Acrylic;
pub const APP_WINDOW_SIZE_CONSTRAINTS: InnerConstraints = InnerConstraints {
    max_height: None,
    max_width: None,
    min_height: None,
    min_width: None,
};
