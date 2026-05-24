/// ## 对每帧的频谱幅度做平滑与峰值保持，减少频谱值跳动／闪烁并保留短时峰值。
/// - 平滑（减抖动）：用指数移动平均等方式把当前帧的值和上一帧的平滑值混合，得到更稳定的输出。通常公式为：smoothed = previous * smoothing_factor + current * (1 - smoothing_factor)，其中 smoothing_factor 越大，平滑越明显（变化越慢）。
/// - 峰值保持（peak hold）：记录每个频带的短时峰值，避免峰值瞬间下降看起来突兀。peaks 保存当前峰值，当新值超过峰值时更新，否则按 peak_decay 逐步衰减（例如乘以小于 1 的衰减因子或按速率减少）。
/// - 峰值阈值：peak_threshold 用来决定何时认为峰值有效或何时触发保持/清除，防止噪声造成假峰。
pub struct Smoother {
    /// 上一帧的平滑值
    previous: Vec<f32>,
    /// 峰值保持值
    peaks: Vec<f32>,
    /// 上升时的平滑因子，越小响应越快
    attack_factor: f32,
    /// 下降时的平滑因子，越大回落越慢
    release_factor: f32,
    /// 峰值衰减速率
    peak_decay: f32,
    /// 峰值保持阈值
    peak_threshold: f32,
}

impl Smoother {
    pub fn new(size: usize, smoothing_factor: f32, peak_decay: f32) -> Self {
        let (attack_factor, release_factor) = smoothing_factors(smoothing_factor);
        Self {
            previous: vec![0.0; size],
            peaks: vec![0.0; size],
            attack_factor,
            release_factor,
            peak_decay: peak_decay.clamp(0.0, 1.0),
            peak_threshold: 0.01,
        }
    }

    pub fn reset(&mut self) {
        self.previous.iter_mut().for_each(|v| *v = 0.0);
        self.peaks.iter_mut().for_each(|v| *v = 0.0);
    }

    pub fn set_smoothing_factor(&mut self, factor: f32) {
        let (attack_factor, release_factor) = smoothing_factors(factor);
        self.attack_factor = attack_factor;
        self.release_factor = release_factor;
    }

    pub fn set_peak_decay(&mut self, decay: f32) {
        self.peak_decay = decay.clamp(0.0, 1.0);
    }

    pub fn smooth(&mut self, current: &[f32]) -> Vec<f32> {
        if self.previous.len() != current.len() {
            self.previous.resize(current.len(), 0.0);
        }
        let mut result = vec![0.0; current.len()];

        for i in 0..current.len() {
            let previous = self.previous[i];
            let factor = if current[i] >= previous {
                self.attack_factor
            } else {
                self.release_factor
            };
            result[i] = previous * factor + current[i] * (1.0 - factor);
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
        if self.peaks.len() != current.len() {
            self.peaks.resize(current.len(), 0.0);
        }
        for (i, &current_val) in current.iter().enumerate() {
            if current_val > self.peaks[i] {
                self.peaks[i] = current_val;
            } else {
                self.peaks[i] *= self.peak_decay;
            }
            if self.peaks[i] < self.peak_threshold {
                self.peaks[i] = 0.0;
            }
        }
        self.peaks.clone()
    }
}

fn smoothing_factors(factor: f32) -> (f32, f32) {
    let release_factor = factor.clamp(0.0, 0.98);
    let attack_factor = (release_factor * 0.35).clamp(0.0, 0.5);
    (attack_factor, release_factor)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn smooth_uses_fast_attack_and_slow_release() {
        let mut smoother = Smoother::new(1, 0.8, 0.95);

        let attacked = smoother.smooth(&[1.0])[0];
        let released = smoother.smooth(&[0.0])[0];

        assert!((attacked - 0.72).abs() < 0.0001);
        assert!((released - 0.576).abs() < 0.0001);
    }

    #[test]
    fn peak_decay_is_clamped_to_a_valid_multiplier() {
        let mut smoother = Smoother::new(1, 0.8, 2.0);
        smoother.update_peaks(&[1.0]);

        let peaks = smoother.update_peaks(&[0.0]);

        assert_eq!(peaks[0], 1.0);
    }
}
