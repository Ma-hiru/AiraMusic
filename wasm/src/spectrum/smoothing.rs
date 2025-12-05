use wasm_bindgen::prelude::wasm_bindgen;

/// ## 对每帧的频谱幅度做平滑与峰值保持，减少频谱值跳动／闪烁并保留短时峰值。
/// - 平滑（减抖动）：用指数移动平均等方式把当前帧的值和上一帧的平滑值混合，得到更稳定的输出。通常公式为：smoothed = previous * smoothing_factor + current * (1 - smoothing_factor)，其中 smoothing_factor 越大，平滑越明显（变化越慢）。
/// - 峰值保持（peak hold）：记录每个频带的短时峰值，避免峰值瞬间下降看起来突兀。peaks 保存当前峰值，当新值超过峰值时更新，否则按 peak_decay 逐步衰减（例如乘以小于 1 的衰减因子或按速率减少）。
/// - 峰值阈值：peak_threshold 用来决定何时认为峰值有效或何时触发保持/清除，防止噪声造成假峰。
pub struct Smoother {
    /// 上一帧的平滑值
    previous: Vec<f32>,
    /// 峰值保持值
    peaks: Vec<f32>,
    /// 平滑因子，范围 [0.0, 1.0]，值越大平滑效果越明显
    smoothing_factor: f32,
    /// 峰值衰减速率
    peak_decay: f32,
    /// 峰值保持阈值
    peak_threshold: f32,
}
impl Smoother {
    pub fn new(size: usize, smoothing_factor: f32, peak_decay: f32) -> Self {
        Self {
            previous: vec![0.0; size],
            peaks: vec![0.0; size],
            smoothing_factor: smoothing_factor.clamp(0.0, 1.0),
            peak_decay,
            peak_threshold: 0.01,
        }
    }

    pub fn resize(&mut self, new_size: usize) {
        self.previous.resize(new_size, 0.0);
        self.peaks.resize(new_size, 0.0);
    }

    pub fn reset(&mut self) {
        self.previous.iter_mut().for_each(|v| *v = 0.0);
        self.peaks.iter_mut().for_each(|v| *v = 0.0);
    }

    pub fn set_smoothing_factor(&mut self, factor: f32) {
        self.smoothing_factor = factor.clamp(0.0, 1.0);
    }

    pub fn set_peak_decay(&mut self, decay: f32) {
        self.peak_decay = decay.max(0.0);
    }

    pub fn smooth(&mut self, current: &[f32]) -> Vec<f32> {
        let mut result = vec![0.0; current.len()];

        for i in 0..current.len() {
            // 计算峰值保持 EMA: smoothed = previous * smoothing_factor + current * (1 - smoothing_factor)
            result[i] = self.previous[i] * self.smoothing_factor
                + current[i] * (1.0 - self.smoothing_factor);
            // 更新历史峰值
            self.previous[i] = result[i];
        }

        result
    }

    pub fn smooth_with_peaks(&mut self, current: &[f32]) -> (Vec<f32>, Vec<f32>) {
        let smoothed = self.smooth(current);
        let peaks = self.update_peaks(&smoothed);
        (smoothed, peaks)
    }

    pub fn update_peaks(&mut self, current: &[f32]) -> Vec<f32> {
        for i in 0..current.len() {
            // 如果当前值大于峰值，则更新峰值
            if current[i] > self.peaks[i] {
                self.peaks[i] = current[i];
            } else {
                // 否则按衰减速率降低峰值
                self.peaks[i] *= self.peak_decay;
            }
            // 低于阈值的峰值重置为 0
            if self.peaks[i] < self.peak_threshold {
                self.peaks[i] = 0.0;
            }
        }
        self.peaks.clone()
    }
}
