use super::processor::SpectrumAutoProcessor;
use super::smoothing::Smoother;
use super::window::{WindowFunction, build_window_coeffs};
use rustfft::Fft;
use rustfft::FftPlanner;
use rustfft::num_complex::Complex;
use std::sync::Arc;
use wasm_bindgen::prelude::wasm_bindgen;

const ANALYSIS_BANDS: usize = 64;

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
    frame_interval_ms: f32,
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

    /// 有增益上限的 dB 高度映射
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
            frame_interval_ms: 1000.0 / 30.0,
            smoother: Smoother::new(ANALYSIS_BANDS, 0.82, 0.965),
            sample_rate,
            fft,
            fft_buffer: vec![Complex::new(0.0, 0.0); fft_size],
            window_coeffs: build_window_coeffs(fft_size, window_function),
            spectrum_half: vec![0.0; fft_size / 2],
            band_ranges: build_band_ranges(fft_size, ANALYSIS_BANDS, sample_rate),
            bands_buf: vec![0.0; ANALYSIS_BANDS],
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

    /// 使用采样之间的实际间隔，兼容未设置时的 30 FPS 调用。
    #[wasm_bindgen]
    pub fn set_frame_interval(&mut self, elapsed_ms: f32) {
        self.frame_interval_ms = if elapsed_ms.is_finite() {
            elapsed_ms.clamp(1.0, 1000.0)
        } else {
            1000.0 / 30.0
        };
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
        let targets = self.compute_heights(samples);
        let smoothed = self.smoother.smooth(&targets, self.frame_interval_ms);
        resample_bands(&smoothed, self.num_bands)
    }

    /// 数据排列为 [band, peak, band, peak, ...]
    #[wasm_bindgen]
    pub fn analyze_frame_with_peaks(&mut self, samples: &[f32]) -> Vec<f32> {
        let targets = self.compute_heights(samples);
        let (bands, peaks) = self
            .smoother
            .smooth_with_peaks(&targets, self.frame_interval_ms);
        let bands = resample_bands(&bands, self.num_bands);
        let peaks = resample_bands(&peaks, self.num_bands);
        self.combined_buf.clear();
        for (band, peak) in bands.into_iter().zip(peaks) {
            self.combined_buf.extend_from_slice(&[band, peak]);
        }
        self.combined_buf.clone()
    }
}

impl SpectrumAnalyzer {
    fn compute_heights(&mut self, samples: &[f32]) -> Vec<f32> {
        self.compute_bands(samples);
        let mut heights = self
            .auto_processor
            .process(&self.bands_buf, self.frame_interval_ms);
        smooth_frequency_inplace(&mut heights);
        heights
    }

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
            let sample = samples
                .get(i)
                .copied()
                .filter(|v| v.is_finite())
                .unwrap_or(0.0);
            self.fft_buffer[i] = Complex::new(sample * self.window_coeffs[i], 0.0);
        }

        self.fft.process(&mut self.fft_buffer);

        let half = n / 2;
        if self.spectrum_half.len() != half {
            self.spectrum_half.resize(half, 0.0);
        }
        // 补偿窗函数的 coherent gain，让绝对幅度门槛不随 FFT 大小变化。
        let norm = (self.window_coeffs.iter().sum::<f32>() / 2.0).max(1.0);
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

    for band in 0..num_bands {
        let start_t = band as f32 / num_bands as f32;
        let end_t = (band + 1) as f32 / num_bands as f32;
        let start_hz = mel_to_hz(min_mel + (max_mel - min_mel) * start_t);
        let end_hz = mel_to_hz(min_mel + (max_mel - min_mel) * end_t);

        let start = hz_to_bin_floor(start_hz, sample_rate, fft_size).min(half.saturating_sub(1));
        let end = hz_to_bin_ceil(end_hz, sample_rate, fft_size)
            .max(start + 1)
            .min(half);

        // 低频允许共享 FFT bin；不能为了凑柱数把频段不断推向高频。
        ranges.push((start, end));
    }

    ranges
}

/// 固定分析频段，显示柱数只改变密度，不改变音频分析与增益。
fn resample_bands(data: &[f32], count: usize) -> Vec<f32> {
    if data.is_empty() {
        return vec![0.0; count];
    }
    (0..count)
        .map(|i| {
            let position = ((i as f32 + 0.5) * data.len() as f32 / count as f32 - 0.5)
                .clamp(0.0, (data.len() - 1) as f32);
            let left = position.floor() as usize;
            let right = (left + 1).min(data.len() - 1);
            let t = position - left as f32;
            let t = t * t * (3.0 - 2.0 * t);
            data[left] + (data[right] - data[left]) * t
        })
        .collect()
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
    fn tone(size: usize, hz: f32, amplitude: f32) -> Vec<f32> {
        (0..size)
            .map(|i| amplitude * (std::f32::consts::TAU * hz * i as f32 / 48_000.0).sin())
            .collect()
    }

    #[test]
    fn display_density_does_not_move_tones_to_other_frequencies() {
        for hz in [110.0, 1000.0, 8000.0] {
            let expected = (hz_to_mel(hz) - hz_to_mel(MIN_VISUAL_HZ))
                / (hz_to_mel(MAX_VISUAL_HZ) - hz_to_mel(MIN_VISUAL_HZ));
            for count in [48, 88, 300] {
                let mut analyzer = SpectrumAnalyzer::new(2048, count, 48_000.0);
                analyzer.set_smoothing(0.0);
                let bands = analyzer.analyze_frame(&tone(2048, hz, 0.5));
                let peak = bands
                    .iter()
                    .enumerate()
                    .max_by(|a, b| a.1.total_cmp(b.1))
                    .unwrap()
                    .0;
                let position = (peak as f32 + 0.5) / count as f32;
                assert!(
                    (position - expected).abs() < 0.035,
                    "{hz}Hz / {count} bars: {position}, expected {expected}"
                );
            }
        }
    }

    #[test]
    fn fft_amplitude_is_independent_of_window_size() {
        for size in [1024, 2048, 4096] {
            let mut analyzer = SpectrumAnalyzer::new(size, 64, 48_000.0);
            analyzer.compute_fft_half(&tone(size, 1500.0, 0.5));
            let peak = analyzer
                .spectrum_half
                .iter()
                .copied()
                .fold(0.0_f32, f32::max);
            assert!((peak - 0.5).abs() < 0.001, "size={size}, peak={peak}");
        }
    }

    #[test]
    fn silence_release_is_consistent_at_different_analysis_rates() {
        let mut tails = Vec::new();
        for fps in [15, 30, 60] {
            let mut analyzer = SpectrumAnalyzer::new(2048, 48, 48_000.0);
            analyzer.set_frame_interval(1000.0 / fps as f32);
            let samples = tone(2048, 110.0, 0.5);
            for _ in 0..fps * 2 {
                analyzer.analyze_frame(&samples);
            }
            let mut frame = Vec::new();
            for _ in 0..fps {
                frame = analyzer.analyze_frame(&[0.0; 2048]);
            }
            let tail = frame.iter().copied().fold(0.0_f32, f32::max);
            assert!(tail < 0.005, "fps={fps}, tail={tail}");
            tails.push(tail);
        }
        assert!((tails[0] - tails[2]).abs() < 0.0001);
    }

    #[test]
    fn tiny_signal_stays_dark_after_gain_settles() {
        let mut analyzer = SpectrumAnalyzer::new(2048, 300, 48_000.0);
        let samples = tone(2048, 110.0, 1e-6);
        for _ in 0..600 {
            assert!(analyzer.analyze_frame(&samples).iter().all(|&v| v == 0.0));
        }
    }

    #[test]
    fn peak_output_preserves_pairs_and_bounds_after_resampling() {
        let mut analyzer = SpectrumAnalyzer::new(2048, 300, 48_000.0);
        analyzer.analyze_frame_with_peaks(&tone(2048, 1000.0, 0.5));
        let frame = analyzer.analyze_frame_with_peaks(&[0.0; 2048]);
        assert_eq!(frame.len(), 600);
        for pair in frame.as_chunks::<2>().0 {
            assert!((0.0..=1.0).contains(&pair[0]));
            assert!(pair[1] >= pair[0] && pair[1] <= 1.0);
        }
    }
}
