//! loop 的"模型"部分 —— 循环自己的语言。
//!
//! 这里放"只有循环世界才用的类型":
//!   裁决(否决链的两端): 循环发起表决, 监听者返回的答案
//!   事件载荷: 循环广播时附带的"信封"
//!
//! 注意依赖方向: loop → shared(message)。
//! 载荷里嵌套的 Request / AssistantReply / ToolCall / ChatMessage 是共享词汇,
//! 留在 shared/message.rs —— 因为能力面(shared/services.rs)的接口也要用它们,
//! 而插件同样 import 那些接口。循环专属的才放这里。

use crate::shared::message::{AssistantReply, ChatMessage, Request, ToolCall};

// ═══════════════════ 一、裁决(否决链的两端) ═══════════════════

/// 前阶段表决(before-request)的结果。
pub enum PreRequestDecision {
    /// 放行: 携带(可能被插件改写过的)请求, 继续发给模型。
    Send {
        /// 要发出的请求。
        request: Request,
    },
    /// 否决: 这一轮不发给模型, reason 说明为什么。
    Veto {
        /// 否决原因(会写进会话日志, 方便事后查)。
        reason: String,
    },
}

/// 后阶段表决(after-reply)的裁决对象。
/// 默认值由循环从数据算出, 插件只能改写它。
#[derive(Clone)]
pub struct LoopDecision {
    /// 是否再来一步(消化工具结果)。
    pub should_continue: bool,
    /// 为什么(会写进 turn-end 日志)。
    pub reason: String,
}

// ═══════════════════ 二、事件载荷(循环广播时附带的"信封") ═══════════════════

/// loop:before-request 的载荷。
pub struct BeforeRequestPayload {
    /// 即将发出的请求(监听者可改写)。
    pub request: Request,
}

/// loop:after-reply 的载荷。
pub struct AfterReplyPayload {
    /// 模型刚给的回复(只读参考)。
    pub reply: AssistantReply,
    /// 这是第几轮。
    pub turn: u32,
    /// 循环算出的默认裁决(监听者可改写后"放行", 或直接返回自己的"否决")。
    pub default_decision: LoopDecision,
}

/// tool:after 的载荷: 结果可被替换; inject 是"给下一轮注入上下文"的合法通道。
pub struct ToolOutcome {
    /// 刚执行完的那次调用(名字、参数)。
    pub call: ToolCall,
    /// 工具结果的文本(监听者可替换成自己的版本)。
    pub result: String,
    /// 注入的上下文: 监听者往里塞消息, 循环会替它写进会话日志。
    /// 这样注入也走"唯一写点" —— 模型看到的每句话都有日志可查。
    pub inject: Vec<ChatMessage>,
}

/// loop:turn-start 的载荷(观察类事件)。
#[derive(Clone)]
pub struct TurnStartPayload {
    /// 第几轮。
    pub turn: u32,
    /// 触发这一轮的用户消息。
    pub message: ChatMessage,
}

/// loop:turn-end 的载荷(观察类事件)。
#[derive(Clone)]
pub struct TurnEndPayload {
    /// 第几轮。
    pub turn: u32,
    /// 为什么结束(模型说完了 / 被谁否决 / 出错 / 超步数)。
    pub reason: String,
}

/// loop:error 的载荷(观察类事件)。
#[derive(Clone)]
pub struct LoopErrorPayload {
    /// 错误内容(已转成字符串)。
    pub error: String,
    /// 出错时正在处理的那条用户消息。
    pub message: ChatMessage,
}
