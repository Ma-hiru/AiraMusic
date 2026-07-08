use crate::components::title_bar::title_bar;
use crate::ctx::page::{RouterContext, ROUTER_CONTEXT};
use crate::page::{page_view, Page};
use windows_reactor::*;

pub fn app(cx: &mut RenderCx) -> Element {
    let (page, set_page) = cx.use_state(Page::default());

    let router = RouterContext {
        page,
        navigate: set_page.into(),
    };

    let title_bar_container = grid([component(title_bar, ())]).grid_row(0);
    let page_container = grid([component(page_view, ())])
        .padding(10.0)
        .grid_row(1)
        .horizontal_alignment(HorizontalAlignment::Stretch)
        .vertical_alignment(VerticalAlignment::Stretch);

    ROUTER_CONTEXT.with(|context| {
        grid((title_bar_container, page_container))
            .rows([GridLength::Auto, GridLength::Star(1.0)])
            .columns([GridLength::Star(1.0)])
            .provide(context, router)
    })
}
