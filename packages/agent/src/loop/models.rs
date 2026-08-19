//! 1. LoopEvent:
//!     - event集中在一个enum里, 由 name() 派发
//!     - 一个event只有一种模式 —— 观察(emit)或决裁(veto)
//! 2. LoopPayload*:
//!     - 每个事件一个专属struct
//!     - veto载荷可被原地改写(&mut p)
//!     - emit载荷是冻结终值(&p)
//! 3. LoopDecision:
//!     - Allow           放行 载荷里被改写的部分生效
//!     - Deny { reason } 拦截 循环立刻停在该点, reason写进会话日志

use crate::ctx::models::Event;
use crate::plugins::session::SessionId;
use crate::shared::message::{AssistantReply, ChatMessage, Request, ToolCall};

#[derive(Clone, Copy, Debug)]
pub enum LoopEvent {
    // ── 决裁事件(veto): 插件可改写载荷、可拦截 ──
    /// 准入: 这一步能不能发(可改写请求)。
    BeforeRequest,
    /// 定稿: 请求最终改写(将来放路由/模型选择)。
    Request,
    /// 审批: 这个工具调用批不批。
    ToolPreExecute,
    /// 改写: 工具结果改写 + 注入上下文。
    ToolAfter,
    /// 判读: 这一轮继不继续。
    AfterReply,
    // ── 观察事件(emit): 只读的"阶段事实", 载荷是冻结终值 ──
    /// 一轮开始。
    TurnStart,
    /// 一步开始(一轮可有多步: 工具往返)。
    StepStart,
    /// 请求已定稿发出(决裁之后的终值)。
    RequestSent,
    /// 模型回复到达。
    Reply,
    /// 工具结果落定(决裁之后的终值)。
    ToolResult,
    /// 一轮结束(决裁之后的终局)。
    TurnEnd,
    /// 循环出错。
    Error,
}

impl LoopEvent {
    /// 事件名(交给 ctx 的 on / emit / on_veto / veto)
    pub fn name(&self) -> &'static str {
        match self {
            // 决裁
            LoopEvent::BeforeRequest => "loop:before-request",
            LoopEvent::Request => "loop:request",
            LoopEvent::ToolPreExecute => "tool:pre-execute",
            LoopEvent::ToolAfter => "tool:after",
            LoopEvent::AfterReply => "loop:after-reply",
            // 观察
            LoopEvent::TurnStart => "loop:turn-start",
            LoopEvent::StepStart => "loop:step-start",
            LoopEvent::RequestSent => "loop:request-sent",
            LoopEvent::Reply => "loop:reply",
            LoopEvent::ToolResult => "tool:result",
            LoopEvent::TurnEnd => "loop:turn-end",
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

/// 统一的决裁结果
#[derive(Clone, Debug, PartialEq)]
pub enum LoopDecision {
    /// 循环继续默认行为, 载荷里被原地改写的内容生效
    Allow,
    /// 循环立刻停在该点, reason 写进会话日志
    Deny {
        /// 拦截原因
        reason: String,
    },
}

// ═══════════════ veto ═══════════════

// 决定 Request 是否可发
pub struct LoopPayloadBeforeRequest {
    /// 属于哪个会话
    pub session_id: SessionId,
    /// 第几轮 / 第几步
    pub turn: u32,
    pub step: u32,
    /// 即将发出的请求(监听者可原地改写)
    pub request: Request,
    /// 触发这一轮的用户消息(只读参考)
    pub user_message_snapshot: ChatMessage,
}

pub struct LoopPayloadRequest {
    pub session_id: SessionId,
    pub turn: u32,
    pub step: u32,
    pub request: Request,
}

/// 批不批这一次工具调用
pub struct LoopPayloadToolPreExecute {
    pub session_id: SessionId,
    pub turn: u32,
    pub step: u32,
    /// 待审批的调用
    pub call: ToolCall,
}

/// 两种用法:
///   - 原地改 result / 往 inject 塞消息, 返回 Allow (循环用改后的值)
///   - 返回 Deny{reason} = 这一轮到此为止(否决这条结果)
pub struct LoopPayloadToolAfter {
    pub session_id: SessionId,
    pub turn: u32,
    pub step: u32,
    /// 本次调用的编号(与会话日志里的 tool 消息对齐)。
    pub call_id: String,
    /// 刚执行完的那次调用(名字、参数)
    pub call: ToolCall,
    /// 工具结果的文本(监听者可替换成自己的版本)。
    pub result: String,
    /// 注入的上下文: 监听者往里塞消息, 循环会替它写会话日志。
    /// 这样注入也走"唯一写点" —— 模型看到的每句话都有日志可查。
    pub inject: Vec<ChatMessage>,
}

/// loop:after-reply 的载荷(决裁)。
/// is_resolved 由循环按数据算好(没有工具调用 = 这一轮解决);
/// 拦截就 Deny; 想继续/结束按 is_resolved 走就返回 Allow。
pub struct LoopPayloadAfterReply {
    /// 属于哪个会话。
    pub session_id: SessionId,
    /// 第几轮。
    pub turn: u32,
    /// 模型刚给的回复。
    pub reply: AssistantReply,
    /// 这一轮是否已解决(循环按数据算出, 监听者只读)。
    pub is_resolved: bool,
    /// 本步产生的工具结果(注入的消息也在里面)。
    pub tool_calls: Vec<ChatMessage>,
}

// ═══════════════ emit ═══════════════

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

/// loop:step-start 的载荷(观察类事件)。一轮可有多步(工具往返)。
#[derive(Clone)]
pub struct LoopPayloadStepStart {
    /// 属于哪个会话。
    pub session_id: SessionId,
    /// 第几轮 / 第几步。
    pub turn: u32,
    pub step: u32,
}

/// loop:request-sent 的载荷(观察类事件)。决裁后的冻结请求。
#[derive(Clone)]
pub struct LoopPayloadRequestSent {
    /// 属于哪个会话。
    pub session_id: SessionId,
    /// 第几轮 / 第几步。
    pub turn: u32,
    pub step: u32,
    /// 真正发出去的请求(终值)。
    pub request: Request,
}

/// loop:reply 的载荷(观察类事件)。模型回复的冻结快照。
#[derive(Clone)]
pub struct LoopPayloadReply {
    /// 属于哪个会话。
    pub session_id: SessionId,
    /// 第几轮 / 第几步。
    pub turn: u32,
    pub step: u32,
    /// 模型刚给的回复(终值)。
    pub reply: AssistantReply,
}

/// tool:result 的载荷(观察类事件)。决裁后的冻结结果。
#[derive(Clone)]
pub struct LoopPayloadToolResult {
    /// 属于哪个会话。
    pub session_id: SessionId,
    /// 第几轮 / 第几步。
    pub turn: u32,
    pub step: u32,
    /// 刚执行完的那次调用。
    pub call: ToolCall,
    /// 最终写进会话日志的结果(终值)。
    pub result: String,
}

/// loop:turn-end 的载荷(观察类事件)。决裁后的终局。
#[derive(Clone)]
pub struct LoopPayloadTurnEnd {
    /// 属于哪个会话。
    pub session_id: SessionId,
    /// 第几轮(该会话自己的轮次计数)。
    pub turn: u32,
    /// 为什么结束(模型说完了 / 被谁拦截 / 出错 / 超步数)。
    pub reason: String,
    /// 触发这一轮的用户消息(只读参考)。
    pub user_message_snapshot: ChatMessage,
}

/// loop:error 的载荷(观察类事件)。
#[derive(Clone)]
pub struct LoopPayloadError {
    /// 属于哪个会话。
    pub session_id: SessionId,
    /// 第几轮。
    pub turn: u32,
    /// 错误内容(已转成字符串)。
    pub error: String,
    /// 出错时正在处理的那条用户消息。
    pub message: ChatMessage,
}
