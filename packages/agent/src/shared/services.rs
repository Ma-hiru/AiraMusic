//! 能力面契约(LLM 之外): 上下文压缩 + 会话种子。
//! LLM 契约在 shared/llm.rs(那是独立的一块, 因为要表达流式/AGUI 事件)。

use anyhow::Result;
use futures::future::BoxFuture; // 装箱的异步 future(trait 对象需要)

use crate::shared::message::ChatMessage;

/// 一次压缩的产物:
///   messages = 压缩后发给模型的历史
///   summary  = 若有, 循环会把它作为 system 消息落会话日志(压缩结果留痕, 可回放)
#[derive(Clone)]
pub struct Compaction {
    /// 压缩后的历史。
    pub messages: Vec<ChatMessage>,
    /// 压缩摘要(可写进会话日志)。
    pub summary: Option<String>,
}

/// 上下文压缩器。异步接口 —— 因为压缩可能调用 LLM(必须 await)。
///
/// 两种实现(都是插件, 二选一挂到 "compactor" 服务名):
///   context-compactor: 截断策略(同步逻辑, 异步接口)
///   llm-compactor:     调模型总结旧历史(真异步)
pub trait ContextCompactor: Send + Sync {
    /// 吃完整历史, 吐压缩产物。
    fn compact<'a>(&'a self, messages: &'a [ChatMessage]) -> BoxFuture<'a, Result<Compaction>>;
}

/// 会话加载插件提供的初始历史(种子)。boot 用它 seed 会话日志。
/// 服务名 "session-seed" —— 和会话日志本体的 "session_manager" 区分开。
#[derive(Clone)]
pub struct SessionSeed {
    /// 会话开始前就该在会话日志里的消息(例如"历史已加载"的系统消息)。
    pub initial_messages: Vec<ChatMessage>,
}
