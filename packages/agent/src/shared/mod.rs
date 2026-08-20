//! shared —— 三方共享的契约与词汇:
//!   message.rs  会话日志语言(厂商无关的消息/请求/回复)
//!   llm.rs      模型流式协议(StreamEvent / LlmAdapter)
//!   agui.rs     AGUI 协议事件(传输无关的线格式)
//!   services.rs 其他能力面(上下文压缩 / 会话种子)

pub mod agui;
pub mod llm;
pub mod message;
pub mod services;
