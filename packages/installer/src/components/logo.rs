use crate::assets;
use crate::constants::APP_NAME;
use windows_reactor::*;

pub fn logo(_: &(), cx: &mut RenderCx) -> Element {
    hstack((
        Image::new_with_uri(assets::logo_uri())
            .width(64.0)
            .height(64.0)
            .stretch(Stretch::UniformToFill),
        relative_panel([text_block(APP_NAME)
            .font_size(30.0)
            .bold()
            .relative_align_h_center()
            .relative_align_v_center()]),
    ))
    .spacing(12.0)
    .into()
}
