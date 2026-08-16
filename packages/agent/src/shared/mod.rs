//! shared —— 共享基础: 会话日志 + 共享词汇 + 能力面契约。
//!
//! 拆分后的全图(哪些在 shared, 哪些已搬走):
//!
//!   留在 shared(三方共享, 谁都可以 import):
//!     session.rs    会话日志: 唯一事实源, 只追加
//!                  (由 session 插件提供; boot 负责 seed, 循环负责 append, 插件/界面只读)
//!     message.rs   共享词汇: 消息(Role/ChatMessage) + 模型请求/回复词汇
//!                  (会话日志、循环、能力面契约、插件都用)
//!     services.rs  能力面契约: LlmAdapter / Tool / 两个注册表 / Compactor / SessionSeed
//!                  (循环消费, 插件提供 —— 是 loop 和 plugins 之间的中立合同,
//!                   所以不能塞进 loop, 否则插件就反向依赖循环了)
//!
//!   已搬走:
//!     ctx/         公告板(通用基础设施, 任何项目都能复用)
//!     boot/        装配(插件清单 → 运行中的系统)
//!     loop/        水泵本体 + 循环专属语言(裁决与事件载荷在 loop/models.rs)
//!     plugins/     插件合同(Plugin trait 在 plugins/models.rs)+ 十个插件

pub mod message; // 共享词汇
pub mod services;
pub mod session; // 会话日志 // 能力面契约

// 公告板类型从 ctx 再导出, 方便使用方写 agent::shared::Ctx。
pub use crate::ctx::Ctx;
