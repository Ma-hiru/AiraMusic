use windows_reactor::*;

pub fn progress(_: &(), cx: &mut RenderCx) -> Element {
    text_block("progress").into()
}
