use crate::page::Page;
use windows_reactor::{Callback, Context};

#[derive(Clone, Debug, PartialEq)]
pub struct RouterContext {
    pub page: Page,
    pub navigate: Callback<Page>,
}

thread_local! {
    pub static ROUTER_CONTEXT: Context<RouterContext> = Context::new(
        RouterContext {
            page: Page::Welcome,
            navigate: Callback::new(|_|{}),
        }
    )
}
