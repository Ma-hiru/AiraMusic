use crate::kmeans::{get_rgb_dataset, read_and_resize_image, KMeans, ReadOption, ResizeFilter};
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct KMeansOption {
    // 图片最大尺寸，防止内存溢出
    pub max_height: u32,
    pub max_width: u32,
    // 最大采样数，防止内存溢出
    pub max_samples: usize,
    // 聚类数
    pub k: usize,
    // 最大迭代次数
    pub max_iters: usize,
    // 收敛阈值
    pub tol: f32,
    // 重置图像时使用的过滤器
    pub resize_filter: ResizeFilter,
}
#[wasm_bindgen]
impl KMeansOption {
    #[wasm_bindgen(constructor)]
    pub fn new(
        max_height: u32,
        max_width: u32,
        max_samples: usize,
        k: usize,
        max_iters: usize,
        tol: f32,
        resize_filter: ResizeFilter,
    ) -> Self {
        KMeansOption {
            max_height,
            max_width,
            max_samples,
            k,
            max_iters,
            tol,
            resize_filter,
        }
    }

    pub fn default() -> Self {
        KMeansOption {
            max_height: 800,
            max_width: 800,
            max_samples: 640000,
            k: 5,
            max_iters: 100,
            tol: 0.0001,
            resize_filter: ResizeFilter::CatmullRom,
        }
    }
}

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
