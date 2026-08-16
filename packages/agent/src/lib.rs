//! AiraMusic 的 agent 包: 插件化架构的最小 Rust 实现(学习用)。
//!
//! 借鉴 deepseek-harness 的核心思想, 只回答一个问题:
//! 一个笨循环跑在中间, 所有具体行为都是挂在旁边、只"交/听/拦"的插件 —— 它们是怎么联动的?
//!
//! 一句话版架构:
//!   插件在装配期把"能力"和"监听"挂到公告板(ctx)上;
//!   运行期只有循环派生的 driver 任务在转, 它从公告板上取能力、
//!   往公告板上喊广播、把一切事实写进会话日志; 插件只在被叫到时运行代码。
//!
//! 模块地图(按阅读顺序):
//!   ctx/               公告板 —— 服务表 + 两条广播通道 + 收据(通用基础设施)
//!   plugins/models.rs  插件合同 —— name / inject / apply
//!   boot/              装配 —— 把清单变成运行中的系统
//!   shared/message.rs  共享词汇 —— 消息 + 模型请求/回复
//!   shared/session.rs  会话日志 —— 唯一事实源(只追加)
//!   shared/services.rs 能力面契约 —— 循环消费、插件提供的模型/工具/注册表接口
//!   loop/              笨循环 —— 水泵本体; loop/models.rs 放循环专属的裁决与事件载荷
//!   plugins/           十个插件 —— 三种角色(提供者/贡献者/监听者)
//!
//! 完整阅读路径(含流程图与名词表)见 README.md。

// 常量模块: 目前只放模型名字, 供 main.rs 的配置引用。
pub mod constants;
// 共享层: 会话日志、共享词汇、能力面契约(见上面模块地图)。
pub mod shared;
// 公告板: 通用基础设施, 不是插件。
pub mod ctx;
// 装配: 插件清单 → 运行中的系统。
pub mod boot;
// 循环: 水泵本体 + 循环专属语言(loop 是关键字, 模块名写作 r#loop)。
pub mod r#loop;
// 插件: 合同(plugins/models.rs)+ 十个演示插件。
pub mod plugins;
