use image::{self, imageops::FilterType, DynamicImage, GenericImageView, ImageError, Rgb};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
#[derive(Copy, Clone)]
pub enum ResizeFilter {
    Nearest,
    Triangle,
    CatmullRom,
    Gaussian,
    Lanczos3,
}

impl From<ResizeFilter> for FilterType {
    fn from(filter: ResizeFilter) -> Self {
        match filter {
            ResizeFilter::Nearest => FilterType::Nearest,
            ResizeFilter::Triangle => FilterType::Triangle,
            ResizeFilter::CatmullRom => FilterType::CatmullRom,
            ResizeFilter::Gaussian => FilterType::Gaussian,
            ResizeFilter::Lanczos3 => FilterType::Lanczos3,
        }
    }
}

pub struct ReadOption {
    pub max_height: u32,
    pub max_width: u32,
    pub resize_filter: ResizeFilter,
}

pub fn read_and_resize_image(
    blob: &[u8],
    read_option: ReadOption,
) -> Result<DynamicImage, ImageError> {
    let ReadOption {
        max_height,
        max_width,
        resize_filter: filter_type,
    } = read_option;

    let img = image::load_from_memory(blob)?;

    let (width, height) = img.dimensions();
    let ratio = (max_height as f32 / height as f32).min(max_width as f32 / width as f32);
    if ratio < 1.0 {
        Ok(img.resize(
            (width as f32 * ratio) as u32,
            (height as f32 * ratio) as u32,
            filter_type.into(),
        ))
    } else {
        Ok(img)
    }
}

pub fn get_rgb_dataset(img: DynamicImage) -> Vec<Rgb<u8>> {
    img.to_rgb8().pixels().copied().collect()
}
