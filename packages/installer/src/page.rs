mod error;
mod progress;
mod success;
mod welcome;

use crate::ctx::page::ROUTER_CONTEXT;
use crate::page::error::error;
use crate::page::progress::progress;
use crate::page::success::success;
use crate::page::welcome::welcome;
use windows_reactor::{component, Element, ElementExt, RenderCx};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Page {
    #[default]
    Welcome,
    Progress,
    Error,
    Success,
}

pub fn page_view(_: &(), cx: &mut RenderCx) -> Element {
    let router = ROUTER_CONTEXT.with(|context| cx.use_context(context));

    match router.page {
        Page::Welcome => component(welcome, ()),
        Page::Progress => component(progress, ()),
        Page::Error => component(error, ()),
        Page::Success => component(success, ()),
    }
}
