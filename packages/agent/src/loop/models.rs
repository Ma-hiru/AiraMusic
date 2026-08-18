use crate::ctx::models::Event;
use crate::plugins::session::SessionId;
use crate::shared::message::{AssistantReply, ChatMessage, Request, ToolCall};

/// 循环事件
#[derive(Clone, Copy, Debug)]
pub enum LoopEvent {
    TurnStart,
    TurnEnd,
    BeforeRequest,
    AfterReply,
    ToolAfter,
    Error,
}

impl LoopEvent {
    fn name(&self) -> &'static str {
        match self {
            LoopEvent::TurnStart => "loop:turn-start",
            LoopEvent::TurnEnd => "loop:turn-end",
            LoopEvent::BeforeRequest => "loop:before-request",
            LoopEvent::AfterReply => "loop:after-reply",
            LoopEvent::ToolAfter => "loop:tool-after",
            LoopEvent::Error => "loop:error",
        }
    }

    pub fn with_id(self, id: impl Into<String>) -> Event {
        Event {
            name: self.name().into(),
            session_id: Some(id.into()),
        }
    }
}

impl From<LoopEvent> for Event {
    fn from(value: LoopEvent) -> Self {
        Event {
            name: value.name().into(),
            session_id: None,
        }
    }
}

#[derive(Clone)]
pub enum LoopDecision {
    Allow,
    Deny {
        reason: String,
        should_continue: bool,
    },
}

/// loop:turn-start 的载荷(观察类事件)。
#[derive(Clone)]
pub struct LoopPayloadTurnStart {
    /// 属于哪个会话。
    pub session_id: SessionId,
    /// 第几轮(该会话自己的轮次计数)。
    pub turn: u32,
    /// 触发这一轮的用户消息。
    pub message: ChatMessage,
}

/// loop:before-request 的载荷。
pub struct LoopPayloadBeforeRequest {
    /// 即将发出的请求(监听者可改写)。
    pub request: Request,
    pub session_id: SessionId,
    pub user_message_snapshot: ChatMessage,
    pub turn: u32,
}

/// tool:after 的载荷: 结果可被替换; inject 是"给下一轮注入上下文"的合法通道。
pub struct LoopPayloadToolAfter {
    /// 属于哪个会话。
    pub session_id: SessionId,
    pub call_id: String,
    /// 刚执行完的那次调用(名字、参数)。
    pub call: ToolCall,
    /// 工具结果的文本(监听者可替换成自己的版本)。
    pub result: String,
    /// 注入的上下文: 监听者往里塞消息, 循环会替它写进会话日志。
    /// 这样注入也走"唯一写点" —— 模型看到的每句话都有日志可查。
    pub inject: Vec<ChatMessage>,
}

/// loop:after-reply 的载荷。
pub struct LoopPayloadAfterReply {
    /// 属于哪个会话。
    pub session_id: SessionId,
    /// 模型刚给的回复(只读参考)。
    pub reply: AssistantReply,
    pub is_resolved: bool,
    pub tool_calls: Vec<ChatMessage>,
    /// 这是第几轮。
    pub turn: u32,
}

/// loop:turn-end 的载荷(观察类事件)。
#[derive(Clone)]
pub struct LoopPayloadTurnEnd {
    /// 属于哪个会话。
    pub session_id: SessionId,
    /// 第几轮(该会话自己的轮次计数)。
    pub turn: u32,
    /// 为什么结束(模型说完了 / 被谁否决 / 出错 / 超步数)。
    pub reason: String,
    pub user_message_snapshot: ChatMessage,
}

/// loop:error 的载荷(观察类事件)。
#[derive(Clone)]
pub struct LoopPayloadError {
    /// 属于哪个会话。
    pub session_id: SessionId,
    /// 错误内容(已转成字符串)。
    pub error: String,
    pub turn: u32,
    /// 出错时正在处理的那条用户消息。
    pub message: ChatMessage,
}
