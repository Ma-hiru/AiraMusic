use windows_reactor::*;

pub fn error(_: &(), cx: &mut RenderCx) -> Element {
    text_block("error").into()
}
