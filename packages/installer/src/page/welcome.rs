use crate::components::logo::logo;
use windows_reactor::*;

pub fn welcome(_: &(), _cx: &mut RenderCx) -> Element {
    let content = vstack([component(logo, ()), text_block("").into()])
        .spacing(8.0)
        .relative_align_h_center()
        .relative_align_v_center();

    relative_panel([content])
        .horizontal_alignment(HorizontalAlignment::Stretch)
        .vertical_alignment(VerticalAlignment::Stretch)
        .into()
}
