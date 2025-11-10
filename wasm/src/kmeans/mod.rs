mod fit;
mod img;

pub use fit::KMeans;
pub use img::{get_rgb_dataset, read_and_resize_image, ReadOption, ResizeFilter};
