use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SpectrumProcessor;

#[wasm_bindgen]
impl SpectrumProcessor {
    /// 线性缩放
    /// 直接乘以增益并截断到 [0, 1]
    pub fn process_linear(data: &[f32], gain: f32) -> Vec<f32> {
        data.iter()
            .map(|&v| (v * gain).clamp(0.0, 1.0))
            .collect()
    }

    /// 对数缩放 (Logarithmic Scaling)
    /// 使用 log10(1 + x * multiplier) 压缩动态范围
    /// 这种方式能更好地展示低幅度的细节，同时防止大幅度信号过饱和
    pub fn process_log(data: &[f32], multiplier: f32) -> Vec<f32> {
        // 假设最大输入值约为 5.0 (经验值)，我们希望映射到 1.0
        // log10(1 + 5 * 10) ≈ 1.7
        // 我们可以让用户传入 multiplier，或者使用默认值
        // 这里我们使用一个自适应的归一化因子
        
        // 这里的 base 是为了归一化，假设我们期望的最大输入经过 multiplier 后是这个值
        // 例如 multiplier=10.0, 期望最大输入 5.0 -> 51.0
        let norm_factor = (1.0 + 5.0 * multiplier).log10();

        data.iter()
            .map(|&v| {
                let val = (1.0 + v * multiplier).log10();
                (val / norm_factor).clamp(0.0, 1.0)
            })
            .collect()
    }

    /// 原始数据 (不处理)
    /// 仅做基本的 clamp 防止非法值
    pub fn process_raw(data: &[f32]) -> Vec<f32> {
        data.iter().map(|&v| v.max(0.0)).collect()
    }
    
    /// 优化的混合处理 (推荐)
    /// 结合了对数压缩和增益，使频谱看起来更饱满
    pub fn process_auto(data: &[f32]) -> Vec<f32> {
        // 自适应归一化，避免固定基准导致整体过低
        // 1) 提高低值可见度
        let log_multiplier: f32 = 300.0;
        // 2) 依据当前帧的最大值动态归一化（稳健：用分位数防止极端值影响）
        let mut sorted = data.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let max_est = if !sorted.is_empty() {
            // 95% 分位作为估计最大值
            let idx = ((sorted.len() as f32 * 0.95).floor() as usize).min(sorted.len() - 1);
            sorted[idx].max(1e-6)
        } else {
            1e-6
        };
        // 对应归一化基准
        let norm_base = (1.0 + max_est * log_multiplier).log10().max(1e-6);
        // 最小可见高度稍提高，避免过多接近零的条
        const MIN_VAL: f32 = 0.02;

        data
            .iter()
            .map(|&value| {
                let v = value.max(0.0);
                // 对数压缩 + 自适应归一化
                let log_val = (1.0 + v * log_multiplier).log10();
                let mut norm = log_val / norm_base;
                // 轻微的指数映射提升小值细节
                norm = norm.powf(0.9);
                norm.clamp(MIN_VAL, 1.0)
            })
            .collect()
    }

    /// 计算分贝 (dB) 并归一化
    /// min_db: 最小分贝值 (例如 -100.0)
    pub fn compute_db(data: &[f32], min_db: f32) -> Vec<f32> {
        data.iter()
            .map(|&v| {
                if v <= 0.0 {
                    0.0
                } else {
                    let db = 20.0 * v.log10();
                    // Normalize db from [min_db, 0] to [0, 1]
                    // db = -100 -> 0
                    // db = 0 -> 1
                    (1.0 + db / min_db.abs()).clamp(0.0, 1.0)
                }
            })
            .collect()
    }
}
