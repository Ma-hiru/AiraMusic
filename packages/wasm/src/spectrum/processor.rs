/// 在幅度归一化后的 FFT 上映射 dB 高度。自动增益有上限，静音不会被放大。
pub struct SpectrumAutoProcessor {
    reference_db: f32,
}

const INITIAL_REFERENCE_DB: f32 = -18.0;
const MIN_REFERENCE_DB: f32 = -30.0;
const MAX_REFERENCE_DB: f32 = -6.0;
const DISPLAY_RANGE_DB: f32 = 48.0;
const NOISE_FLOOR_DB: f32 = -78.0;

impl Default for SpectrumAutoProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl SpectrumAutoProcessor {
    pub fn new() -> Self {
        Self {
            reference_db: INITIAL_REFERENCE_DB,
        }
    }

    pub fn reset(&mut self) {
        self.reference_db = INITIAL_REFERENCE_DB;
    }

    pub fn process(&mut self, data: &[f32], elapsed_ms: f32) -> Vec<f32> {
        let peak = data
            .iter()
            .copied()
            .filter(|v| v.is_finite())
            .fold(0.0_f32, f32::max);
        let peak_db = amplitude_db(peak);
        // 静音时保持增益，避免停顿后弱小的尾音被抬高。
        if peak_db > NOISE_FLOOR_DB {
            let target = peak_db.clamp(MIN_REFERENCE_DB, MAX_REFERENCE_DB);
            let tau_ms = if target > self.reference_db {
                180.0
            } else {
                2500.0
            };
            let factor = (-elapsed_ms / tau_ms).exp();
            self.reference_db = target + (self.reference_db - target) * factor;
        }
        data.iter()
            .map(|&value| {
                let db = amplitude_db(value);
                if db <= NOISE_FLOOR_DB {
                    return 0.0;
                }
                ((db - self.reference_db + DISPLAY_RANGE_DB) / DISPLAY_RANGE_DB)
                    .clamp(0.0, 1.0)
                    .powf(1.3)
            })
            .collect()
    }
}

fn amplitude_db(value: f32) -> f32 {
    if !value.is_finite() || value <= 0.0 {
        return -120.0;
    }
    20.0 * value.max(1e-6).log10()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn automatic_gain_does_not_amplify_silence_or_noise() {
        let mut processor = SpectrumAutoProcessor::new();
        for _ in 0..600 {
            assert_eq!(
                processor.process(&[0.0, 1e-6], 1000.0 / 30.0),
                vec![0.0, 0.0]
            );
        }
    }

    #[test]
    fn quiet_signal_keeps_headroom_after_gain_settles() {
        let mut processor = SpectrumAutoProcessor::new();
        let mut height = 0.0;
        for _ in 0..600 {
            height = processor.process(&[0.005], 1000.0 / 30.0)[0];
        }
        assert!(height > 0.2 && height < 0.65, "height={height}");
    }

    #[test]
    fn gain_depends_on_time_not_frame_count() {
        let references: Vec<_> = [15, 30, 60]
            .iter()
            .map(|&fps| {
                let mut processor = SpectrumAutoProcessor::new();
                for _ in 0..fps {
                    processor.process(&[0.01], 1000.0 / fps as f32);
                }
                processor.reference_db
            })
            .collect();
        assert!((references[0] - references[2]).abs() < 0.0001);
    }
}
