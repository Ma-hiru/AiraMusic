use crate::constants::APP_NAME;
use windows_reactor::*;

pub fn title_bar(_: &(), cx: &mut RenderCx) -> Element {
    TitleBar::new(APP_NAME)
        .subtitle("Installer")
        .tall(false)
        .into()
}
