use crate::spectrum::window::{apply_window, WindowFunction};
use rustfft::num_complex::Complex;
use rustfft::FftPlanner;

pub fn compute_fft(samples: &[f32], window: WindowFunction) -> Vec<f32> {
    // 应用窗函数
    let windowed_samples = apply_window(samples, window);
    // 准备复数缓冲区
    let mut buffer = windowed_samples
        .iter()
        .map(|&s| Complex::new(s, 0.0))
        .collect::<Vec<Complex<f32>>>();
    // 创建 FFT 规划并执行 FFT
    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(buffer.len());
    fft.process(&mut buffer);
    // 计算幅度并转换为 i32，只取前半部分（实数信号的 FFT 结果是对称的）
    let half_len = buffer.len() / 2;
    buffer[0..half_len]
        .iter()
        .map(|c| {
            // magnitude = sqrt(re² + im²)
            let magnitude = (c.re.powi(2) + c.im.powi(2)).sqrt();
            // 不归一化，返回原始幅度以获得更好的视觉效果
            // 或者使用较小的归一化因子
            magnitude / (buffer.len() as f32).sqrt() // 除以 sqrt(2048) ≈ 45，而非 2048
        })
        .collect()
}
