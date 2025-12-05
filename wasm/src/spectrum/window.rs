use std::f32::consts::PI;
use wasm_bindgen::prelude::wasm_bindgen;

/// # 窗函数（window function）是在对有限时域数据做 FFT 之前，与信号逐点相乘的函数，用来减小由于截断/边界不连续引起的频谱泄露（spectral leakage）。
/// - 主要要点：
///   + 问题：直接截取有限长度信号相当于乘以矩形窗，会在频域产生高幅度旁瓣（泄露）。
///   + 作用：用平滑的窗减少边界突变，从而降低旁瓣能量，但会增宽主瓣（降低频率分辨率）。
///   + 使用方法：在计算 FFT 前对时域样本做 element-wise 相乘，然后再 FFT。若需要恢复幅值，可能要做归一化补偿。
///   + 常见窗及特性：None（矩形窗）——主瓣最窄、旁瓣最高；Hanning（Hann）——旁瓣低、分辨率中等；Hamming——与 Hann 类似、旁瓣略高但峰值保持好；Blackman——旁瓣很低但主瓣较宽。
///   + 选择依据：是否优先抑制旁瓣（选 Blackman/Hann）或优先频率分辨率（选矩形/无窗）。
#[derive(Clone, Copy)]
#[wasm_bindgen]
pub enum WindowFunction {
    /// 矩形窗，主瓣最窄、旁瓣最高
    None,
    /// 旁瓣低、分辨率中等
    Hanning,
    /// 与 Hann 类似、旁瓣略高但峰值保持好
    Hamming,
    /// 旁瓣很低但主瓣较宽，最平滑，但能量损失较大
    Blackman,
}

/// ## cosine 基函数 - cos(θ) = cos(2π * n / (size - 1))
/// - `θ = 2π * n / (size - 1)` 把索引线性映射到 0 到 (2π)（n 从 0 到 size-1）。
/// - `cos(θ)` 得到一个在两端平滑衰减、中间较高的周期性形状，乘以系数并叠加常数就能产生不同窗的形状（控制主瓣宽度和旁瓣高度）。
/// - `size - 1 而不是 size` 通常这样做可使窗在两端对称（n=0 和 n=N-1 对应端点），有利于保证某些窗在端点为零或对称，从而减少不连续性引起的泄露。
/// - `不同窗的差别在于系数与是否含有更高次余弦项（比如 Blackman 包含 cos(2θ)），这些系数决定旁瓣衰减和主瓣宽度的折中。`
#[inline]
fn cosine(n: usize, size: usize, alpha: f32) -> f32 {
    (alpha * 2.0 * PI * n as f32 / (size - 1) as f32).cos()
}

/// `Hann:    w\[n\] = 0.5  - 0.5  * cos(θ)`
#[inline]
fn hanning_window(n: usize, size: usize) -> f32 {
    0.5 - 0.5 * cosine(n, size, 1.0)
}

/// `Hamming: w\[n\] = 0.54 - 0.46 * cos(θ)`
#[inline]
fn hamming_window(n: usize, size: usize) -> f32 {
    0.54 - 0.46 * cosine(n, size, 1.0)
}

const A0: f32 = 7938.0 / 18608.0; // 约 0.42659
const A1: f32 = 9230.0 / 18608.0; // 约 0.49656
const A2: f32 = 2330.0 / 18608.0; // 约 0.12505
/// `Blackman: w\[n\] = A0 - A1 * cos(θ) + A2 * cos(2θ)`
#[inline]
fn blackman_window(n: usize, size: usize) -> f32 {
    A0 - A1 * cosine(n, size, 1.0) + A2 * cosine(n, size, 2.0)
}

pub fn apply_window(samples: &[f32], window: WindowFunction) -> Vec<f32> {
    let size = samples.len();
    let weight = match window {
        WindowFunction::None => |n, size| 1.0,
        WindowFunction::Hanning => hanning_window,
        WindowFunction::Hamming => hamming_window,
        WindowFunction::Blackman => blackman_window,
    };
    samples
        .iter()
        .enumerate()
        .map(|(i, &sample)| sample * weight(i, size))
        .collect()
}
