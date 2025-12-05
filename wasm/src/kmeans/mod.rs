pub mod fit;
pub mod img;
pub mod opt;

use fit::KMeans;
use img::{get_rgb_dataset, read_and_resize_image, ReadOption};
use opt::KMeansOption;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

#[wasm_bindgen]
pub fn kmeans(blob: &[u8], option: KMeansOption) -> Result<Vec<String>, JsValue> {
    let img = read_and_resize_image(
        blob,
        ReadOption {
            max_height: option.max_height,
            max_width: option.max_width,
            resize_filter: option.resize_filter,
        },
    )
    .map_err(|e| JsValue::from_str(&e.to_string()))?;

    let rgb_dataset = get_rgb_dataset(img);

    let mut kmeans = KMeans::new(&rgb_dataset, option.max_samples, option.k);
    kmeans.fit(option.max_iters, option.tol);

    Ok(kmeans
        .palette_rgb8()
        .into_iter()
        .map(|rgb| format!("#{:02X}{:02X}{:02X}", rgb[0], rgb[1], rgb[2]))
        .collect())
}
