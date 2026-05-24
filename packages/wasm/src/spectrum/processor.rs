/// 有状态的频谱处理器：用于跨帧复用动态归一化基准（EMA），视觉更稳定。
pub struct SpectrumAutoProcessor {
    norm_base_ema: f32,
    attack_alpha: f32,
    release_alpha: f32,
    log_multiplier: f32,
    min_val: f32,
    noise_floor: f32,
}

impl Default for SpectrumAutoProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl SpectrumAutoProcessor {
    pub fn new() -> SpectrumAutoProcessor {
        SpectrumAutoProcessor {
            norm_base_ema: 1.0,
            attack_alpha: 0.28,
            release_alpha: 0.035,
            log_multiplier: 260.0,
            min_val: 0.0,
            noise_floor: 0.012,
        }
    }

    pub fn reset(&mut self) {
        self.norm_base_ema = 1.0;
    }

    /// 更新内部 EMA 归一化基准，并返回当前 norm_base。
    pub fn update_norm_base(&mut self, data: &[f32]) -> f32 {
        let mut max_est = 1e-6_f32;
        for &v in data {
            if v.is_finite() {
                max_est = max_est.max(v.max(0.0));
            }
        }
        let norm_base_new = (1.0 + max_est * self.log_multiplier).log10().max(1e-6);
        let alpha = if norm_base_new > self.norm_base_ema {
            self.attack_alpha
        } else {
            self.release_alpha
        };
        self.norm_base_ema = ((1.0 - alpha) * self.norm_base_ema + alpha * norm_base_new).max(1e-6);
        self.norm_base_ema
    }

    /// 在不更新 EMA 的情况下，用指定 norm_base 对数据做同一套压缩/归一化。
    pub fn apply_with_norm_base(&self, data: &[f32], norm_base: f32) -> Vec<f32> {
        let norm_base = norm_base.max(1e-6);
        let log_multiplier = self.log_multiplier;
        let min_val = self.min_val;
        let noise_floor = self.noise_floor;

        data.iter()
            .map(|&value| {
                let v = value.max(0.0);
                let log_val = (1.0 + v * log_multiplier).log10();
                let mut norm = log_val / norm_base;
                norm = norm.powf(0.85);
                if norm < noise_floor {
                    return 0.0;
                }
                norm.clamp(min_val, 1.0)
            })
            .collect()
    }

    /// 跨帧稳定的 auto 处理：max + EMA 动态归一化
    pub fn process_auto_ema(&mut self, data: &[f32]) -> Vec<f32> {
        let norm_base = self.update_norm_base(data);
        self.apply_with_norm_base(data, norm_base)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn norm_base_attacks_faster_than_it_releases() {
        let mut processor = SpectrumAutoProcessor::new();

        let attacked = processor.update_norm_base(&[1.0]);
        let released = processor.update_norm_base(&[0.001]);

        assert!(attacked > 1.0);
        assert!(released < attacked);
        assert!(released > 1.2);
    }

    #[test]
    fn apply_with_norm_base_clamps_values_under_noise_floor() {
        let processor = SpectrumAutoProcessor::new();

        let result = processor.apply_with_norm_base(&[0.000001, 1.0], 2.0);

        assert_eq!(result[0], 0.0);
        assert!(result[1] > 0.0);
        assert!(result[1] <= 1.0);
    }
}
