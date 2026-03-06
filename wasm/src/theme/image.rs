use super::model::{DecodedResult, FilterOptions, HSV, Pixel};
use anyhow::Result;
use image::ImageReader;
use std::io::Cursor;

pub fn decode_image(image_bytes: &[u8]) -> Result<DecodedResult> {
    let image = ImageReader::new(Cursor::new(image_bytes))
        .with_guessed_format()?
        .decode()?
        .to_rgba8();

    let (width, height) = image.dimensions();

    let pixels = image
        .pixels()
        .map(|p| Pixel {
            r: p[0],
            g: p[1],
            b: p[2],
            a: p[3],
        })
        .collect();

    Ok(DecodedResult {
        pixels,
        width,
        height,
    })
}

pub fn resize_bilinear(
    decoded_result: DecodedResult,
    dst_width: usize,
    dst_height: usize,
) -> Vec<Pixel> {
    if dst_width == 0 || dst_height == 0 {
        return Vec::new();
    }

    let src_width = decoded_result.width;
    let src_height = decoded_result.height;
    let pixels = &decoded_result.pixels;
    let capacity = match (dst_width as u64).checked_mul(dst_height as u64) {
        Some(cap) if cap <= usize::MAX as u64 => cap as usize,
        _ => return Vec::new(),
    };
    let x_ratio = src_width as f32 / dst_width as f32;
    let y_ratio = src_height as f32 / dst_height as f32;

    let mut out = Vec::with_capacity(capacity);

    for dst_y in 0..dst_height {
        let src_y = dst_y as f32 * y_ratio;
        let y_low = src_y.floor() as u32;
        let y_high = (y_low + 1).min(src_height - 1);
        let dy = src_y - y_low as f32;

        for dst_x in 0..dst_width {
            let src_x = dst_x as f32 * x_ratio;
            let x_low = src_x.floor() as u32;
            let x_high = (x_low + 1).min(src_width - 1);
            let dx = src_x - x_low as f32;

            let p1 = &pixels[(y_low * src_width + x_low) as usize];
            let p2 = &pixels[(y_low * src_width + x_high) as usize];
            let p3 = &pixels[(y_high * src_width + x_low) as usize];
            let p4 = &pixels[(y_high * src_width + x_high) as usize];

            let r = bilinear(p1.r, p2.r, p3.r, p4.r, dx, dy);
            let g = bilinear(p1.g, p2.g, p3.g, p4.g, dx, dy);
            let b = bilinear(p1.b, p2.b, p3.b, p4.b, dx, dy);
            let a = bilinear(p1.a, p2.a, p3.a, p4.a, dx, dy);

            out.push(Pixel { r, g, b, a });
        }
    }

    out
}

pub fn filter_pixels(pixels: Vec<Pixel>, options: Option<FilterOptions>) -> Vec<Pixel> {
    let options = options.unwrap_or_default();
    let total_count = pixels.len();

    let mut result = Vec::new();
    // 灰度像素缓存
    let mut grayscale_pixels = Vec::new();

    for p in &pixels {
        if p.a < options.alpha_limit {
            continue;
        }
        let hsv = HSV::from(p);
        if hsv.v < options.value_min || hsv.v > options.value_max {
            continue;
        }
        if hsv.s < options.saturation_limit {
            // 保存灰度像素以备后用
            grayscale_pixels.push(*p);
            continue;
        }
        result.push(*p);
    }

    // 如果过滤后的彩色像素太少，说明可能是黑白/灰度图
    // 此时返回灰度像素，避免噪点主导主题色
    let min_color_ratio = 0.01;
    if total_count > 0 && (result.len() as f32 / total_count as f32) < min_color_ratio {
        // 如果灰度像素也很少，返回所有通过透明度过滤的像素
        if grayscale_pixels.is_empty() {
            return pixels
                .into_iter()
                .filter(|p| p.a >= options.alpha_limit)
                .collect();
        }
        return grayscale_pixels;
    }

    result
}

/// 双线性插值算法
///
/// ```text
/// 1. top: (v01 - v00) * dx + v00 = v01 * dx - v00 * dx + v00 = v00 * (1 - dx) + v01 * dx
/// 2. bottom: (v11 - v10) * dx + v10 = v11 * dx - v10 * dx + v10 = v10 * (1 - dx) + v11 * dx
/// 3. value:
///   (bottom - top) * dy + top
///   = bottom * dy - top * dy + top
///   = top * (1 - dy) + bottom * dy
///   = v00 * (1 - dx) * (1 - dy) + v01 * dx * (1 - dy) + v10 * (1 - dx) * dy + v11 * dx * dy
/// ```
#[inline]
fn bilinear(v00: u8, v01: u8, v10: u8, v11: u8, dx: f32, dy: f32) -> u8 {
    (v00 as f32 * (1.0 - dx) * (1.0 - dy)
        + v01 as f32 * dx * (1.0 - dy)
        + v10 as f32 * (1.0 - dx) * dy
        + v11 as f32 * dx * dy)
        .clamp(0.0, 255.0)
        .round() as u8
}
