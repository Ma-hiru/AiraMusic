#![allow(non_snake_case)]
mod image;
mod mmcq;
mod model;

use image::{decode_image, filter_pixels, resize_bilinear};
use mmcq::mmcq;
pub use model::FilterOptions;
use wasm_bindgen::prelude::wasm_bindgen;

/// 使用 MMCQ 算法提取图片主色调
#[wasm_bindgen]
pub fn extractPalette(
    imageBytes: &[u8],
    dst_width: usize,
    dst_height: usize,
    count: usize,
    options: Option<FilterOptions>,
) -> Vec<String> {
    let decoded = match decode_image(imageBytes) {
        Ok(d) => d,
        Err(_) => return vec![],
    };
    let pixels = resize_bilinear(decoded, dst_width, dst_height);
    let filtered_pixels = filter_pixels(pixels, options);
    let mut boxes = mmcq(filtered_pixels, count);

    boxes.sort_by(|a, b| b.score().partial_cmp(&a.score()).unwrap());

    boxes
        .iter()
        .map(|b| b.average_color().to_string())
        .collect()
}
