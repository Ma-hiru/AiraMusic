use windows_reactor::*;

pub fn button(_: &(), cx: &mut RenderCx) -> Element {
    text_block("button").into()
}
