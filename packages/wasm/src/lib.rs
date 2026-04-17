use wasm_bindgen::prelude::wasm_bindgen;

pub mod lyric;
pub mod renderer;
pub mod search;
pub mod spectrum;
pub mod theme;

#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(target_arch = "wasm32")]
    console_error_panic_hook::set_once();
}
