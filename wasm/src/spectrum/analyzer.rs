use super::fft::compute_fft;
use super::smoothing::Smoother;
use super::window::WindowFunction;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub struct SpectrumAnalyzer {
    /// FFT 大小
    fft_size: usize,
    /// 窗函数类型
    window_function: WindowFunction,
    /// 频带数量
    num_bands: usize,
    /// 平滑器
    smoother: Smoother,
    /// 采样率
    sample_rate: f32,
}
// 实现构造函数和配置方法
#[wasm_bindgen]
impl SpectrumAnalyzer {
    #[wasm_bindgen(constructor)]
    pub fn new(fft_size: usize, num_bands: usize, sample_rate: f32) -> Self {
        Self {
            fft_size,
            window_function: WindowFunction::Hanning,
            num_bands,
            smoother: Smoother::new(num_bands, 0.8, 0.95),
            sample_rate,
        }
    }
    /// 设置窗函数类型
    #[wasm_bindgen]
    pub fn set_window_function(&mut self, window: WindowFunction) {
        self.window_function = window;
    }
    /// 设置平滑系数
    #[wasm_bindgen]
    pub fn set_smoothing(&mut self, factor: f32) {
        self.smoother.set_smoothing_factor(factor);
    }
    /// 设置峰值衰减速率
    #[wasm_bindgen]
    pub fn set_peak_decay(&mut self, decay: f32) {
        self.smoother.set_peak_decay(decay);
    }
    /// 重置分析器状态
    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.smoother.reset();
    }
    /// 获取频率 bin 的频率值（Hz）
    #[wasm_bindgen]
    pub fn get_frequency(&self, bin: usize) -> f32 {
        (bin as f32 * self.sample_rate) / (self.fft_size as f32)
    }
}
// 实现频谱分析方法
#[wasm_bindgen]
impl SpectrumAnalyzer {
    #[wasm_bindgen]
    pub fn analyze(&mut self, samples: &[f32]) -> Vec<f32> {
        // 计算 FFT 并获取频谱
        let spectrum = compute_fft(samples, self.window_function);
        // 分组频谱到指定频带
        let bands = self.group_logarithmic(&spectrum);
        // 应用平滑器
        self.smoother.smooth(&bands)
    }
    #[wasm_bindgen]
    pub fn analyze_with_peaks(&mut self, samples: &[f32]) -> Vec<f32> {
        let spectrum = compute_fft(samples, self.window_function);
        let bands = self.group_logarithmic(&spectrum);
        let (smoothed, peaks) = self.smoother.smooth_with_peaks(&bands);

        let mut result = Vec::with_capacity(self.num_bands * 2);
        // 交替存储平滑值和峰值
        for i in 0..self.num_bands {
            result.push(smoothed[i]);
            result.push(peaks[i]);
        }

        result
    }
}
// 实现不同的频谱分组方法
impl SpectrumAnalyzer {
    /// 对数分组（低频密集，高频稀疏）
    #[allow(dead_code)]
    fn group_logarithmic(&self, spectrum: &[f32]) -> Vec<f32> {
        let mut bands = vec![0.0; self.num_bands];
        let len = spectrum.len();
        if len == 0 || self.num_bands == 0 {
            return bands;
        }
        // 确保每个频带至少包含一个 bin，并且覆盖连续区间
        let mut prev_end: usize = 0;
        for i in 0..self.num_bands {
            let normalized_start = (i as f32 / self.num_bands as f32).powf(2.0);
            let normalized_end = ((i + 1) as f32 / self.num_bands as f32).powf(2.0);

            // 使用 floor/ceil 获取更稳健的边界
            let mut bin_start = (normalized_start * len as f32).floor() as usize;
            let mut bin_end = (normalized_end * len as f32).ceil() as usize;

            // 保证单调且连续覆盖
            bin_start = bin_start.max(prev_end).min(len);
            bin_end = bin_end.max(bin_start + 1).min(len);

            if bin_start < bin_end {
                let band_sum: f32 = spectrum[bin_start..bin_end].iter().sum();
                bands[i] = band_sum / (bin_end - bin_start) as f32;
                prev_end = bin_end;
            } else {
                // 兜底：若仍出现空区间，尽量从 prev_end 分配一个 bin
                if prev_end < len {
                    bands[i] = spectrum[prev_end];
                    prev_end += 1;
                } else {
                    bands[i] = 0.0;
                }
            }
        }
        bands
    }
    /// 线性分组（均匀分布）
    #[allow(dead_code)]
    fn group_linear(&self, spectrum: &[f32]) -> Vec<f32> {
        let mut bands = vec![0.0; self.num_bands];
        let bin_per_band = spectrum.len() / self.num_bands;

        for i in 0..self.num_bands {
            let bin_start = i * bin_per_band;
            let bin_end = ((i + 1) * bin_per_band).min(spectrum.len());
            let band_sum: f32 = spectrum[bin_start..bin_end].iter().sum();
            bands[i] = band_sum / (bin_end - bin_start) as f32;
        }

        bands
    }
    /// Mel 频率分组（更符合人耳感知）
    #[allow(dead_code)]
    fn group_mel_scale(&self, spectrum: &[f32]) -> Vec<f32> {
        let mut bands = vec![0.0; self.num_bands];
        let max_freq = self.sample_rate / 2.0;
        let max_mel = hz_to_mel(max_freq);

        for i in 0..self.num_bands {
            let mel_start = (i as f32 / self.num_bands as f32) * max_mel;
            let mel_end = ((i + 1) as f32 / self.num_bands as f32) * max_mel;

            let hz_start = mel_to_hz(mel_start);
            let hz_end = mel_to_hz(mel_end);

            let bin_start = ((hz_start / max_freq) * spectrum.len() as f32) as usize;
            let bin_end =
                ((hz_end / max_freq) * spectrum.len() as f32).min(spectrum.len() as f32) as usize;

            if bin_start < bin_end {
                let band_sum: f32 = spectrum[bin_start..bin_end].iter().sum();
                bands[i] = band_sum / (bin_end - bin_start) as f32;
            }
        }

        bands
    }
}

#[inline]
fn hz_to_mel(hz: f32) -> f32 {
    2595.0 * (1.0 + hz / 700.0).log10()
}

#[inline]
fn mel_to_hz(mel: f32) -> f32 {
    700.0 * (10_f32.powf(mel / 2595.0) - 1.0)
}
