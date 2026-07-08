mod app;
mod assets;
mod components;
mod constants;
mod ctx;
mod log;
mod page;

use crate::app::*;
use crate::assets::assets_prepare;
use crate::constants::*;
use crate::log::init_log;
use windows_reactor::*;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_log()?;
    assets_prepare()?;
    bootstrap()?;

    App::new()
        .title(APP_TITLE)
        .backdrop(APP_BACKDROP)
        .inner_size(APP_WIDTH, APP_HEIGHT)
        .inner_constraints(APP_WINDOW_SIZE_CONSTRAINTS)
        .render(app)?;

    Ok(())
}
