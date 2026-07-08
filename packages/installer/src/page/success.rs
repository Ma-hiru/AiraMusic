use windows_reactor::*;

pub fn success(_: &(), cx: &mut RenderCx) -> Element {
    text_block("success").into()
}
