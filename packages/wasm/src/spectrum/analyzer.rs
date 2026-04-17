use super::processor::SpectrumAutoProcessor;
use super::smoothing::Smoother;
use super::window::WindowFunction;
use js_sys::Date;
use rustfft::Fft;
use rustfft::FftPlanner;
use rustfft::num_complex::Complex;
use std::sync::Arc;
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

    /// FFT 规划与复用缓冲区（避免每帧重新分配/规划）
    fft: Arc<dyn Fft<f32>>,
    fft_buffer: Vec<Complex<f32>>,
    window_coeffs: Vec<f32>,
    spectrum_half: Vec<f32>,

    /// 频带复用缓冲区（避免 group_logarithmic 每帧分配）
    bands_buf: Vec<f32>,

    /// 带峰值时的交错缓冲区（避免每帧新建 Vec）
    combined_buf: Vec<f32>,

    /// 推荐的美化处理：跨帧 EMA 动态归一化
    auto_processor: SpectrumAutoProcessor,

    /// wasm/rust 端计算限帧（0 表示不限制），默认 60
    fps_limit: u32,
    last_compute_ms: f64,
    cached_frame: Vec<f32>,
    cached_frame_with_peaks: Vec<f32>,
}
// 实现构造函数和配置方法
#[wasm_bindgen]
impl SpectrumAnalyzer {
    #[wasm_bindgen(constructor)]
    pub fn new(fft_size: usize, num_bands: usize, sample_rate: f32) -> Self {
        let mut planner = FftPlanner::<f32>::new();
        let fft = planner.plan_fft_forward(fft_size);
        let fft_buffer = vec![Complex::new(0.0, 0.0); fft_size];
        let window_coeffs = build_window_coeffs(fft_size, WindowFunction::Hanning);
        let spectrum_half = vec![0.0; fft_size / 2];
        Self {
            fft_size,
            window_function: WindowFunction::Hanning,
            num_bands,
            smoother: Smoother::new(num_bands, 0.8, 0.95),
            sample_rate,
            fft,
            fft_buffer,
            window_coeffs,
            spectrum_half,
            bands_buf: vec![0.0; num_bands],
            combined_buf: Vec::with_capacity(num_bands.saturating_mul(2)),
            auto_processor: SpectrumAutoProcessor::new(),
            fps_limit: 60,
            last_compute_ms: 0.0,
            cached_frame: Vec::new(),
            cached_frame_with_peaks: Vec::new(),
        }
    }

    /// 设置 wasm/rust 端计算限帧：Some(0) 表示不限制；None 表示默认 60
    #[wasm_bindgen]
    pub fn set_fps_limit(&mut self, fps: Option<u32>) {
        // 约定：None => 默认 60；Some(0) => 不限制
        self.fps_limit = fps.unwrap_or(60);
    }
    /// 设置窗函数类型
    #[wasm_bindgen]
    pub fn set_window_function(&mut self, window: WindowFunction) {
        self.window_function = window;
        self.window_coeffs = build_window_coeffs(self.fft_size, window);
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
        self.auto_processor.reset();
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
        self.compute_fft_half(samples);
        // 分组频谱到指定频带
        let num_bands = self.num_bands;
        SpectrumAnalyzer::group_logarithmic_into(
            num_bands,
            &self.spectrum_half,
            &mut self.bands_buf,
        );
        // 应用平滑器
        let smoothed = self.smoother.smooth(&self.bands_buf);
        let mut processed = self.auto_processor.process_auto_ema(&smoothed);
        self.smooth_frequency_inplace(&mut processed);
        processed
    }
    #[wasm_bindgen]
    pub fn analyze_with_peaks(&mut self, samples: &[f32]) -> Vec<f32> {
        self.compute_fft_half(samples);
        let num_bands = self.num_bands;
        SpectrumAnalyzer::group_logarithmic_into(
            num_bands,
            &self.spectrum_half,
            &mut self.bands_buf,
        );
        let (smoothed, peaks) = self.smoother.smooth_with_peaks(&self.bands_buf);

        // 关键：不要把 peaks 混进归一化基准，否则 bands 会被“压平/怪异”。
        // 以 smoothed（能量）更新 EMA 基准一次，然后用同一 norm_base 处理 smoothed 与 peaks。
        let norm_base = self.auto_processor.update_norm_base(&smoothed);
        let mut processed_bands = self
            .auto_processor
            .apply_with_norm_base(&smoothed, norm_base);
        self.smooth_frequency_inplace(&mut processed_bands);
        let processed_peaks = self.auto_processor.apply_with_norm_base(&peaks, norm_base);

        let target_len = self.num_bands.saturating_mul(2);
        self.combined_buf.clear();
        self.combined_buf.reserve(target_len);
        for i in 0..self.num_bands {
            self.combined_buf
                .push(*processed_bands.get(i).unwrap_or(&0.0));
            self.combined_buf
                .push(*processed_peaks.get(i).unwrap_or(&0.0));
        }

        self.combined_buf.clone()
    }

    /// 返回经过平滑与美化处理的频带（推荐：max 聚合 + 平滑 + EMA 动态归一化）
    /// 返回长度 = num_bands
    #[wasm_bindgen]
    pub fn analyze_frame(&mut self, samples: &[f32]) -> Vec<f32> {
        if let Some(cached) = self.maybe_return_cached(false) {
            return cached;
        }
        self.compute_fft_half(samples);

        let num_bands = self.num_bands;
        SpectrumAnalyzer::group_logarithmic_into(
            num_bands,
            &self.spectrum_half,
            &mut self.bands_buf,
        );
        let smoothed = self.smoother.smooth(&self.bands_buf);

        let mut processed = self.auto_processor.process_auto_ema(&smoothed);
        // 轻量的频带方向平滑（让观感更像常见音乐 app）
        self.smooth_frequency_inplace(&mut processed);

        self.cache_result(false, &processed);
        processed
    }

    /// 带峰值版本：数据排列为 [band, peak, band, peak, ...]
    #[wasm_bindgen]
    pub fn analyze_frame_with_peaks(&mut self, samples: &[f32]) -> Vec<f32> {
        if let Some(cached) = self.maybe_return_cached(true) {
            return cached;
        }
        self.compute_fft_half(samples);

        let num_bands = self.num_bands;
        SpectrumAnalyzer::group_logarithmic_into(
            num_bands,
            &self.spectrum_half,
            &mut self.bands_buf,
        );
        let (smoothed, peaks) = self.smoother.smooth_with_peaks(&self.bands_buf);

        // 同 analyze_with_peaks：EMA 基准仅基于 smoothed 更新一次，然后分别处理 bands/peaks。
        let norm_base = self.auto_processor.update_norm_base(&smoothed);
        let mut processed_bands = self
            .auto_processor
            .apply_with_norm_base(&smoothed, norm_base);
        self.smooth_frequency_inplace(&mut processed_bands);
        let processed_peaks = self.auto_processor.apply_with_norm_base(&peaks, norm_base);

        let target_len = self.num_bands.saturating_mul(2);
        self.combined_buf.clear();
        self.combined_buf.reserve(target_len);
        for i in 0..self.num_bands {
            self.combined_buf
                .push(*processed_bands.get(i).unwrap_or(&0.0));
            self.combined_buf
                .push(*processed_peaks.get(i).unwrap_or(&0.0));
        }

        let out = self.combined_buf.clone();
        self.cache_result(true, &out);
        out
    }
}
// 实现不同的频谱分组方法
impl SpectrumAnalyzer {
    fn compute_fft_half(&mut self, samples: &[f32]) {
        let n = self.fft_size;
        if n == 0 {
            self.spectrum_half.clear();
            return;
        }
        if self.fft_buffer.len() != n {
            self.fft_buffer.resize(n, Complex::new(0.0, 0.0));
        }
        if self.window_coeffs.len() != n {
            self.window_coeffs = build_window_coeffs(n, self.window_function);
        }

        for i in 0..n {
            let s = samples.get(i).copied().unwrap_or(0.0);
            self.fft_buffer[i] = Complex::new(s * self.window_coeffs[i], 0.0);
        }

        self.fft.process(&mut self.fft_buffer);

        let half = n / 2;
        if self.spectrum_half.len() != half {
            self.spectrum_half.resize(half, 0.0);
        }
        let norm = (n as f32).sqrt().max(1.0);
        for i in 0..half {
            let c = self.fft_buffer[i];
            let magnitude = (c.re * c.re + c.im * c.im).sqrt();
            self.spectrum_half[i] = magnitude / norm;
        }
    }

    fn maybe_return_cached(&mut self, with_peaks: bool) -> Option<Vec<f32>> {
        if self.fps_limit == 0 {
            return None;
        }
        let now = Date::now();
        let min_interval = 1000.0 / (self.fps_limit as f64).max(1.0);
        if self.last_compute_ms > 0.0 && (now - self.last_compute_ms) < min_interval {
            let cached = if with_peaks {
                &self.cached_frame_with_peaks
            } else {
                &self.cached_frame
            };
            if !cached.is_empty() {
                return Some(cached.clone());
            }
        }
        self.last_compute_ms = now;
        None
    }

    fn cache_result(&mut self, with_peaks: bool, out: &[f32]) {
        if with_peaks {
            self.cached_frame_with_peaks.clear();
            self.cached_frame_with_peaks.extend_from_slice(out);
        } else {
            self.cached_frame.clear();
            self.cached_frame.extend_from_slice(out);
        }
    }

    fn smooth_frequency_inplace(&self, data: &mut [f32]) {
        // 3-tap 平滑：new[i] = (prev + 2*cur + next) / 4
        if data.len() < 3 {
            return;
        }
        let mut prev = data[0];
        let mut cur = data[1];
        for i in 1..(data.len() - 1) {
            let next = data[i + 1];
            let smoothed = (prev + 2.0 * cur + next) * 0.25;
            prev = cur;
            cur = next;
            data[i] = smoothed;
        }
    }

    /// 对数分组（低频密集，高频稀疏）
    fn group_logarithmic_into(num_bands: usize, spectrum: &[f32], out: &mut Vec<f32>) {
        out.clear();
        out.resize(num_bands, 0.0);

        let len = spectrum.len();
        if len == 0 || num_bands == 0 {
            return;
        }
        // 确保每个频带至少包含一个 bin，并且覆盖连续区间
        let mut prev_end: usize = 0;
        #[allow(clippy::needless_range_loop)]
        for i in 0..num_bands {
            let normalized_start = (i as f32 / num_bands as f32).powf(2.0);
            let normalized_end = ((i + 1) as f32 / num_bands as f32).powf(2.0);

            // 使用 floor/ceil 获取更稳健的边界
            let mut bin_start = (normalized_start * len as f32).floor() as usize;
            let mut bin_end = (normalized_end * len as f32).ceil() as usize;

            // 保证单调且连续覆盖
            bin_start = bin_start.max(prev_end).min(len);
            bin_end = bin_end.max(bin_start + 1).min(len);

            if bin_start < bin_end {
                // 用 max 比平均更“有冲击力”，观感更接近常见 app
                let mut band_max: f32 = 0.0;
                for &v in &spectrum[bin_start..bin_end] {
                    band_max = band_max.max(v);
                }
                out[i] = band_max;
                prev_end = bin_end;
            } else {
                // 兜底：若仍出现空区间，尽量从 prev_end 分配一个 bin
                if prev_end < len {
                    out[i] = spectrum[prev_end];
                    prev_end += 1;
                } else {
                    out[i] = 0.0;
                }
            }
        }
    }

    /// 线性分组（均匀分布）
    #[allow(dead_code)]
    fn group_linear(&self, spectrum: &[f32]) -> Vec<f32> {
        let mut bands = vec![0.0; self.num_bands];
        let bin_per_band = spectrum.len() / self.num_bands;

        #[allow(clippy::needless_range_loop)]
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

        #[allow(clippy::needless_range_loop)]
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

fn build_window_coeffs(size: usize, window: WindowFunction) -> Vec<f32> {
    if size <= 1 {
        return vec![1.0; size];
    }
    use std::f32::consts::PI;

    let cosine = |n: usize, alpha: f32| (alpha * 2.0 * PI * n as f32 / (size - 1) as f32).cos();
    let w = |n: usize| match window {
        WindowFunction::None => 1.0,
        WindowFunction::Hanning => 0.5 - 0.5 * cosine(n, 1.0),
        WindowFunction::Hamming => 0.54 - 0.46 * cosine(n, 1.0),
        WindowFunction::Blackman => {
            const A0: f32 = 7938.0 / 18608.0;
            const A1: f32 = 9230.0 / 18608.0;
            const A2: f32 = 2330.0 / 18608.0;
            A0 - A1 * cosine(n, 1.0) + A2 * cosine(n, 2.0)
        }
    };

    (0..size).map(w).collect()
}

#[inline]
fn hz_to_mel(hz: f32) -> f32 {
    2595.0 * (1.0 + hz / 700.0).log10()
}

#[inline]
fn mel_to_hz(mel: f32) -> f32 {
    700.0 * (10_f32.powf(mel / 2595.0) - 1.0)
}
