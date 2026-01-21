use std::cmp::Ordering;
use std::fmt::{Display, Formatter};
use wasm_bindgen::prelude::wasm_bindgen;

/// RGBA像素结构体
/// - r: 红色通道，取值范围为0-255
/// - g: 绿色通道，取值范围为0-255
/// - b: 蓝色通道，取值范围为0-255
/// - a: 透明度通道，取值范围为0-255，0表示完全透明，255表示完全不透明
#[derive(Clone, Copy, Debug, Default)]
pub struct Pixel {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl Display for Pixel {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "rgba({}, {}, {}, {})", self.r, self.g, self.b, self.a)
    }
}

/// HSV:
/// - Hue: 色相，取值范围为0-360度，表示颜色的类型，如红色、绿色、蓝色等
/// - Saturation: 饱和度，取值范围为0-1，表示颜色的纯度，0表示灰色，1表示纯色
/// - Value: 明度，取值范围为0-1，表示颜色的亮度，0表示黑色，1表示最亮色
#[derive(Clone, Copy, Debug)]
#[allow(clippy::upper_case_acronyms, unused)]
pub struct HSV {
    pub h: f32,
    pub s: f32,
    pub v: f32,
}

impl From<Pixel> for HSV {
    fn from(p: Pixel) -> Self {
        // 归一化到0-1范围
        let r = p.r as f32 / 255.0;
        let g = p.g as f32 / 255.0;
        let b = p.b as f32 / 255.0;
        // 计算最大值、最小值和差值
        let max = r.max(g).max(b);
        let min = r.min(g).min(b);
        let delta = max - min;
        // 明度等于rgb中的最大值
        let value = max;
        // 饱和度等于（最大值-最小值）/最大值
        let saturation = if max == 0.0 { 0.0 } else { delta / max };
        // 色相计算比较复杂
        let hue = if delta == 0.0 {
            0.0 // 无色相
        } else if max == r {
            60.0 * ((g - b) / delta % 6.0)
        } else if max == g {
            60.0 * ((b - r) / delta + 2.0)
        } else {
            60.0 * ((r - g) / delta + 4.0)
        };
        let hue = if hue < 0.0 { hue + 360.0 } else { hue };
        HSV {
            h: hue,
            s: saturation,
            v: value,
        }
    }
}

impl From<&Pixel> for HSV {
    fn from(value: &Pixel) -> Self {
        HSV::from(*value)
    }
}

/// 颜色盒子结构体
/// - r_min, r_max 当前盒子覆盖的红色范围
/// - g_min, g_max 当前盒子覆盖的绿色范围
/// - b_min, b_max 当前盒子覆盖的蓝色范围
/// - pixels 所有落在这个盒子里的像素
#[derive(Debug)]
pub struct ColorBox {
    r_min: u8,
    r_max: u8,
    g_min: u8,
    g_max: u8,
    b_min: u8,
    b_max: u8,
    pixels: Vec<Pixel>,
}

impl ColorBox {
    pub fn pixels_count(&self) -> usize {
        self.pixels.len()
    }

    /// 颜色空间体积
    /// 颜色跨度越大 → 盒子越"混乱" → 越应该优先切分
    pub fn volume(&self) -> usize {
        let r_range = u8::clamp(self.r_max - self.r_min, 1, 255) as usize;
        let g_range = u8::clamp(self.g_max - self.g_min, 1, 255) as usize;
        let b_range = u8::clamp(self.b_max - self.b_min, 1, 255) as usize;
        r_range * g_range * b_range
    }

    /// 优先级计算
    pub fn priority(&self) -> usize {
        let volume = self.volume();
        let count = self.pixels_count();
        if volume > 0 {
            volume.saturating_mul(count)
        } else {
            count
        }
    }

    /// 输出一个“代表色”
    pub fn average_color(&self) -> Pixel {
        let mut r_sum = 0usize;
        let mut g_sum = 0usize;
        let mut b_sum = 0usize;
        let mut a_sum = 0usize;
        let count = self.pixels.len();

        for p in &self.pixels {
            r_sum += p.r as usize;
            g_sum += p.g as usize;
            b_sum += p.b as usize;
            a_sum += p.a as usize;
        }

        Pixel {
            r: (r_sum / count) as u8,
            g: (g_sum / count) as u8,
            b: (b_sum / count) as u8,
            a: (a_sum / count) as u8,
        }
    }

    pub fn split_box(mut self) -> Option<(ColorBox, ColorBox)> {
        if self.pixels_count() < 2 {
            return None;
        }
        // 计算每个通道的跨度
        let r_range = (self.r_max - self.r_min) as usize;
        let g_range = (self.g_max - self.g_min) as usize;
        let b_range = (self.b_max - self.b_min) as usize;
        // 选择跨度最大的通道进行排序
        let channel = if r_range >= g_range && r_range >= b_range {
            0
        } else if g_range >= r_range && g_range >= b_range {
            1
        } else {
            2
        };
        // 根据选择的通道排序像素
        match channel {
            0 => self.pixels.sort_by_key(|p| p.r),
            1 => self.pixels.sort_by_key(|p| p.g),
            2 => self.pixels.sort_by_key(|p| p.b),
            _ => {}
        }
        // 从中间切分
        let mid = self.pixels.len() / 2;
        Some((
            self.pixels[..mid].to_vec().into(),
            self.pixels[mid..].to_vec().into(),
        ))
    }

    pub fn score(&self) -> f32 {
        let population = self.pixels_count() as f32;
        let hsv = HSV::from(self.average_color());
        // 饱和度权重：越鲜艳越好
        let sat_weight = hsv.s.powf(1.5);
        // 亮度权重：中间亮度最好，太暗太亮都惩罚
        let val_weight = 1.0 - (hsv.v - 0.5).abs() * 2.0;
        population * sat_weight * val_weight.max(0.0)
    }
}

impl From<Vec<Pixel>> for ColorBox {
    fn from(pixels: Vec<Pixel>) -> Self {
        let mut r_min = 255;
        let mut r_max = 0;
        let mut g_min = 255;
        let mut g_max = 0;
        let mut b_min = 255;
        let mut b_max = 0;

        for p in &pixels {
            r_min = r_min.min(p.r);
            r_max = r_max.max(p.r);
            g_min = g_min.min(p.g);
            g_max = g_max.max(p.g);
            b_min = b_min.min(p.b);
            b_max = b_max.max(p.b);
        }

        ColorBox {
            r_min,
            r_max,
            g_min,
            g_max,
            b_min,
            b_max,
            pixels,
        }
    }
}

#[derive(Debug, Default)]
pub struct DecodedResult {
    pub pixels: Vec<Pixel>,
    pub wight: u32,
    pub height: u32,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Copy)]
pub struct FilterOptions {
    pub alpha_limit: u8,
    pub saturation_limit: f32,
    pub value_min: f32,
    pub value_max: f32,
}

impl Default for FilterOptions {
    fn default() -> Self {
        Self {
            alpha_limit: 125,
            saturation_limit: 0.2,
            value_min: 0.15,
            value_max: 0.95,
        }
    }
}

#[derive(Debug)]
pub struct PriorityBox {
    pub priority: usize,
    pub color_box: ColorBox,
}

impl PriorityBox {
    pub fn new(color_box: ColorBox) -> Self {
        Self {
            priority: color_box.priority(),
            color_box,
        }
    }
}

impl PartialEq for PriorityBox {
    fn eq(&self, other: &Self) -> bool {
        self.priority == other.priority
    }
}

impl Eq for PriorityBox {}

impl PartialOrd for PriorityBox {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PriorityBox {
    fn cmp(&self, other: &Self) -> Ordering {
        self.priority.cmp(&other.priority)
    }
}
