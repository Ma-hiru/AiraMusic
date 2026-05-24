use super::processor::SpectrumAutoProcessor;
use super::smoothing::Smoother;
use super::window::{WindowFunction, build_window_coeffs};
use rustfft::Fft;
use rustfft::FftPlanner;
use rustfft::num_complex::Complex;
use std::sync::Arc;
use wasm_bindgen::prelude::wasm_bindgen;

const MIN_VISUAL_HZ: f32 = 45.0;
const MAX_VISUAL_HZ: f32 = 16_000.0;

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

    band_ranges: Vec<(usize, usize)>,
    bands_buf: Vec<f32>,

    /// 带峰值时的交错缓冲区（避免每帧新建 Vec）
    combined_buf: Vec<f32>,

    /// 推荐的美化处理：跨帧 EMA 动态归一化
    auto_processor: SpectrumAutoProcessor,
}

#[wasm_bindgen]
impl SpectrumAnalyzer {
    #[wasm_bindgen(constructor)]
    pub fn new(fft_size: usize, num_bands: usize, sample_rate: f32) -> Self {
        let mut planner = FftPlanner::<f32>::new();
        let fft = planner.plan_fft_forward(fft_size);
        let window_function = WindowFunction::Hanning;
        Self {
            fft_size,
            window_function,
            num_bands,
            smoother: Smoother::new(num_bands, 0.82, 0.965),
            sample_rate,
            fft,
            fft_buffer: vec![Complex::new(0.0, 0.0); fft_size],
            window_coeffs: build_window_coeffs(fft_size, window_function),
            spectrum_half: vec![0.0; fft_size / 2],
            band_ranges: build_band_ranges(fft_size, num_bands, sample_rate),
            bands_buf: vec![0.0; num_bands],
            combined_buf: Vec::with_capacity(num_bands.saturating_mul(2)),
            auto_processor: SpectrumAutoProcessor::new(),
        }
    }

    #[wasm_bindgen]
    pub fn set_window_function(&mut self, window: WindowFunction) {
        self.window_function = window;
        self.window_coeffs = build_window_coeffs(self.fft_size, window);
    }

    #[wasm_bindgen]
    pub fn set_smoothing(&mut self, factor: f32) {
        self.smoother.set_smoothing_factor(factor);
    }

    #[wasm_bindgen]
    pub fn set_peak_decay(&mut self, decay: f32) {
        self.smoother.set_peak_decay(decay);
    }

    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.smoother.reset();
        self.auto_processor.reset();
    }

    #[wasm_bindgen]
    pub fn get_frequency(&self, bin: usize) -> f32 {
        if self.fft_size == 0 {
            return 0.0;
        }
        (bin as f32 * self.sample_rate) / (self.fft_size as f32)
    }
}

#[wasm_bindgen]
impl SpectrumAnalyzer {
    #[wasm_bindgen]
    pub fn analyze(&mut self, samples: &[f32]) -> Vec<f32> {
        self.analyze_frame(samples)
    }

    #[wasm_bindgen]
    pub fn analyze_with_peaks(&mut self, samples: &[f32]) -> Vec<f32> {
        self.analyze_frame_with_peaks(samples)
    }

    #[wasm_bindgen]
    pub fn analyze_frame(&mut self, samples: &[f32]) -> Vec<f32> {
        self.compute_bands(samples);
        let smoothed = self.smoother.smooth(&self.bands_buf);
        let mut processed = self.auto_processor.process_auto_ema(&smoothed);
        smooth_frequency_inplace(&mut processed);
        processed
    }

    /// 数据排列为 [band, peak, band, peak, ...]
    #[wasm_bindgen]
    pub fn analyze_frame_with_peaks(&mut self, samples: &[f32]) -> Vec<f32> {
        self.compute_bands(samples);
        let (smoothed, peaks) = self.smoother.smooth_with_peaks(&self.bands_buf);

        let norm_base = self.auto_processor.update_norm_base(&smoothed);
        let mut processed_bands = self
            .auto_processor
            .apply_with_norm_base(&smoothed, norm_base);
        smooth_frequency_inplace(&mut processed_bands);
        let processed_peaks = self.auto_processor.apply_with_norm_base(&peaks, norm_base);

        self.combined_buf.clear();
        self.combined_buf.reserve(self.num_bands.saturating_mul(2));
        for i in 0..self.num_bands {
            self.combined_buf
                .push(*processed_bands.get(i).unwrap_or(&0.0));
            self.combined_buf
                .push(*processed_peaks.get(i).unwrap_or(&0.0));
        }

        self.combined_buf.clone()
    }
}

impl SpectrumAnalyzer {
    fn compute_bands(&mut self, samples: &[f32]) {
        self.compute_fft_half(samples);
        group_perceptual_into(&self.band_ranges, &self.spectrum_half, &mut self.bands_buf);
    }

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
            let sample = samples.get(i).copied().unwrap_or(0.0);
            self.fft_buffer[i] = Complex::new(sample * self.window_coeffs[i], 0.0);
        }

        self.fft.process(&mut self.fft_buffer);

        let half = n / 2;
        if self.spectrum_half.len() != half {
            self.spectrum_half.resize(half, 0.0);
        }
        let norm = (n as f32).sqrt().max(1.0);
        for i in 0..half {
            let c = self.fft_buffer[i];
            self.spectrum_half[i] = (c.re * c.re + c.im * c.im).sqrt() / norm;
        }
    }
}

fn group_perceptual_into(ranges: &[(usize, usize)], spectrum: &[f32], out: &mut Vec<f32>) {
    out.clear();
    out.resize(ranges.len(), 0.0);
    if spectrum.is_empty() {
        return;
    }

    for (index, &(start, end)) in ranges.iter().enumerate() {
        let start = start.min(spectrum.len().saturating_sub(1));
        let end = end.max(start + 1).min(spectrum.len());
        let mut max_value = 0.0_f32;
        let mut sum_square = 0.0_f32;
        let mut count = 0usize;

        for &value in &spectrum[start..end] {
            let value = value.max(0.0);
            max_value = max_value.max(value);
            sum_square += value * value;
            count += 1;
        }

        if count > 0 {
            let rms = (sum_square / count as f32).sqrt();
            out[index] = (rms * 0.72 + max_value * 0.28) * visual_band_weight(index, ranges.len());
        }
    }
}

fn build_band_ranges(fft_size: usize, num_bands: usize, sample_rate: f32) -> Vec<(usize, usize)> {
    let half = fft_size / 2;
    let mut ranges = Vec::with_capacity(num_bands);
    if half == 0 || num_bands == 0 || !sample_rate.is_finite() || sample_rate <= 0.0 {
        ranges.resize(num_bands, (0, 0));
        return ranges;
    }

    let bin_hz = sample_rate / fft_size.max(1) as f32;
    let nyquist = sample_rate * 0.5;
    let min_hz = MIN_VISUAL_HZ.max(bin_hz).min(nyquist * 0.8);
    let max_hz = MAX_VISUAL_HZ.min(nyquist * 0.96).max(min_hz + bin_hz);
    let min_mel = hz_to_mel(min_hz);
    let max_mel = hz_to_mel(max_hz);
    let mut prev_end = hz_to_bin_floor(min_hz, sample_rate, fft_size).min(half.saturating_sub(1));

    for band in 0..num_bands {
        let start_t = band as f32 / num_bands as f32;
        let end_t = (band + 1) as f32 / num_bands as f32;
        let start_hz = mel_to_hz(min_mel + (max_mel - min_mel) * start_t);
        let end_hz = mel_to_hz(min_mel + (max_mel - min_mel) * end_t);

        let mut start = hz_to_bin_floor(start_hz, sample_rate, fft_size)
            .max(prev_end)
            .min(half.saturating_sub(1));
        let mut end = hz_to_bin_ceil(end_hz, sample_rate, fft_size)
            .max(start + 1)
            .min(half);

        if end <= start {
            start = half.saturating_sub(1);
            end = half;
        }

        ranges.push((start, end));
        prev_end = if end >= half {
            half.saturating_sub(1)
        } else {
            end
        };
    }

    ranges
}

fn smooth_frequency_inplace(data: &mut [f32]) {
    if data.len() < 3 {
        return;
    }
    let mut prev = data[0];
    let mut cur = data[1];
    for i in 1..(data.len() - 1) {
        let next = data[i + 1];
        data[i] = (prev + 2.0 * cur + next) * 0.25;
        prev = cur;
        cur = next;
    }
}

fn visual_band_weight(index: usize, total: usize) -> f32 {
    if total <= 1 {
        return 1.0;
    }
    let t = index as f32 / (total - 1) as f32;
    0.82 + 0.36 * t.powf(0.75)
}

#[inline]
fn hz_to_bin_floor(hz: f32, sample_rate: f32, fft_size: usize) -> usize {
    ((hz / sample_rate) * fft_size as f32).floor().max(0.0) as usize
}

#[inline]
fn hz_to_bin_ceil(hz: f32, sample_rate: f32, fft_size: usize) -> usize {
    ((hz / sample_rate) * fft_size as f32).ceil().max(0.0) as usize
}

#[inline]
fn hz_to_mel(hz: f32) -> f32 {
    2595.0 * (1.0 + hz / 700.0).log10()
}

#[inline]
fn mel_to_hz(mel: f32) -> f32 {
    700.0 * (10_f32.powf(mel / 2595.0) - 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn band_ranges_ignore_dc_and_unneeded_ultra_high_bins() {
        let ranges = build_band_ranges(2048, 32, 48_000.0);

        assert_eq!(ranges.len(), 32);
        assert!(ranges[0].0 > 0);
        assert!(ranges[0].1 > ranges[0].0);
        assert!(ranges.last().unwrap().1 < 2048 / 2);

        for window in ranges.windows(2) {
            assert!(window[0].0 <= window[0].1);
            assert!(window[0].1 <= window[1].1);
        }
    }

    #[test]
    fn perceptual_grouping_blends_rms_and_peak_energy() {
        let spectrum = vec![3.0, 4.0];
        let ranges = vec![(0, 2)];
        let mut out = Vec::new();

        group_perceptual_into(&ranges, &spectrum, &mut out);

        let rms = ((3.0_f32 * 3.0 + 4.0 * 4.0) / 2.0).sqrt();
        let expected = rms * 0.72 + 4.0 * 0.28;
        assert!((out[0] - expected).abs() < 0.0001);
    }

    #[test]
    fn analyze_frame_returns_configured_band_count() {
        let mut analyzer = SpectrumAnalyzer::new(128, 12, 48_000.0);
        let samples = vec![0.25; 128];

        let frame = analyzer.analyze_frame(&samples);

        assert_eq!(frame.len(), 12);
        assert!(frame.iter().all(|value| value.is_finite()));
    }
}
