use wasm_bindgen::prelude::wasm_bindgen;

pub mod kmeans;
pub mod lyric;
pub mod path;
pub mod range;
pub mod search;
pub mod spectrum;

#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(target_arch = "wasm32")]
    console_error_panic_hook::set_once();
}
