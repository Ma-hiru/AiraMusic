//! 第 6 章 · 服务接口 —— 循环认识的"能力面"。
//!
//! 循环(agent_loop.rs)对世界的全部认知就是这几个接口:
//!   模型 = LlmAdapter(一个 complete 方法)
//!   工具 = Tool(name / description / parameters / run)
//! 它不认识 deepseek、不认识 add —— 只认识这些接口。
//!
//! 另外两个是"收纳箱"而不是能力:
//!   ToolRegistry / PromptRegistry: 插件往里面塞东西, 循环从里面取。
//!   它们由 registries 插件提供, 但注册表自己不认识任何具体工具/段落。
//!
//! 为什么接口都这么小?
//!   接口 = 循环对"外面世界"的全部假设。假设越少, 越容易换实现:
//!   换模型只换 LlmAdapter, 换工具执行方式只换 Tool, 循环不用动。

use std::sync::Arc;

use crate::shared::message::{AssistantReply, ChatMessage, Request};
use anyhow::Result;
use futures::future::BoxFuture; // 装箱的异步 future(见下面 Rust 说明)

/// 通往模型的适配器接口。
///
/// Rust 说明: trait 里的 async fn 不能直接做成 trait object(dyn),
/// 所以手写返回类型 BoxFuture<'a, _>。这是语言约束, 不是架构。
/// 'a = 借用 request 的期间。
pub trait LlmAdapter: Send + Sync {
    /// 发一次请求, 拿一次回复。
    /// request 里已经装好了系统提示、历史、工具清单 —— 适配器只需要"送出去"。
    fn complete<'a>(&'a self, request: &'a Request) -> BoxFuture<'a, Result<AssistantReply>>;
}

/// 压缩器: 对会话日志历史的纯投影(不删、不改会话日志本身)。换策略 = 换一个实现。
///
/// 本质就是一个函数: 吃完整历史, 吐"精简后的历史"。
/// 循环只调用它, 不知道(也不关心)里面是什么压缩策略。
pub type Compactor = Arc<dyn Fn(&[ChatMessage]) -> Vec<ChatMessage> + Send + Sync>;

/// 会话加载插件提供的初始历史(种子)。boot 用它 seed 会话日志。
/// 注意服务名: 它挂在 "session-seed" 下, 与会话日志本体的 "session" 区分开。
#[derive(Clone)]
pub struct SessionSeed {
    /// 会话开始前就该在会话日志里的消息(例如"历史已加载"的系统消息)。
    pub initial_messages: Vec<ChatMessage>,
}
