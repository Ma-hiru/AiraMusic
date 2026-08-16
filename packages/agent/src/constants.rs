//! 全局常量: 模型名字。
//!
//! 目前只有假模型在用(main.rs 把它们当配置传给 llm-fake 插件);
//! 将来接真模型时, 适配器插件同样引用这些名字, 保证拼写统一。

/// DeepSeek V4 闪速版模型名。
pub const DEEPSEEK_V4_FLASH: &str = "deepseek-v4-flash";
/// MIMO V2.5 Pro 模型名。
pub const MIMO_V2_5_PRO: &str = "mimo-v2.5-pro";
