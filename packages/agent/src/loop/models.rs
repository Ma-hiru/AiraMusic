//! loop 的"模型"部分 —— 循环自己的语言: 事件名 + 事件载荷 + 决裁结果。
//!
//! 1. LoopEvent:
//!     - event集中在一个enum里, 由 name() 派发
//!     - 一个event只有一种模式 —— 观察(emit)或决裁(veto)
//! 2. LoopPayload*:
//!     - 每个事件一个专属struct
//!     - veto载荷可被原地改写(&mut p)
//!     - emit载荷是冻结终值(&p)
//!     - 惯例: 载荷都带 session_id / turn / (步级事件带) step;
//!       微事件(流式文本、工具调用)不带 user_message_snapshot ——
//!       它们靠 session_id+turn+step 关联, 快照只在轮级事件上。
//! 3. LoopDecision:
//!     - Allow           放行 载荷里被改写的部分生效
//!     - Deny { reason } 拦截 循环立刻停在该点, reason写进会话日志
//!
//! 流式微事件(对齐 AGUI):
//!   文本: TextStart → TextDelta* → TextEnd
//!   工具: ToolCallStart → ToolCallArgs* → ToolCallEnd(模型侧, 来自 llm 流)
//!         ToolExecStart → ToolResult(执行侧, 来自循环)

use crate::ctx::models::Event;
use crate::plugins::session::SessionId;
use crate::shared::llm::Usage;
use crate::shared::message::{AssistantReply, ChatMessage, Request, ToolCall};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
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
    /// 文本开始(AGUI: TEXT_MESSAGE_START)。
    TextStart,
    /// 文本增量(AGUI: TEXT_MESSAGE_CONTENT)。
    TextDelta,
    /// 文本结束(AGUI: TEXT_MESSAGE_END)。
    TextEnd,
    /// 工具调用开始(AGUI: TOOL_CALL_START, 模型侧)。
    ToolCallStart,
    /// 工具参数增量(AGUI: TOOL_CALL_ARGS, 模型侧)。
    ToolCallArgs,
    /// 工具调用结束(AGUI: TOOL_CALL_END, 模型侧)。
    ToolCallEnd,
    /// 工具开始执行(AGUI: RUN_STARTED 的对应物, 执行侧)。
    ToolExecStart,
    /// 模型回复到达(整条消息的冻结快照, 含工具调用与用量)。
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
            // 观察 · 轮/步级
            LoopEvent::TurnStart => "loop:turn-start",
            LoopEvent::StepStart => "loop:step-start",
            LoopEvent::RequestSent => "loop:request-sent",
            // 观察 · 流式文本
            LoopEvent::TextStart => "loop:text-start",
            LoopEvent::TextDelta => "loop:text-delta",
            LoopEvent::TextEnd => "loop:text-end",
            // 观察 · 工具调用(模型侧)与执行(执行侧)
            LoopEvent::ToolCallStart => "tool:call-start",
            LoopEvent::ToolCallArgs => "tool:call-args",
            LoopEvent::ToolCallEnd => "tool:call-end",
            LoopEvent::ToolExecStart => "tool:exec-start",
            // 观察 · 收尾
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
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub request: Request,
}

pub struct LoopPayloadRequest {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub request: Request,
}

/// 批不批这一次工具调用
pub struct LoopPayloadToolPreExecute {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub call: ToolCall,
}

/// 两种用法:
///   - 原地改 result / 往 inject 塞消息, 返回 Allow (循环用改后的值)
///   - 返回 Deny{reason} = 这一轮到此为止(否决这条结果)
pub struct LoopPayloadToolAfter {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub call: ToolCall,
    pub result: String,
    pub inject: Vec<ChatMessage>,
}

pub struct LoopPayloadAfterReply {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub reply: AssistantReply,
    pub is_resolved: bool,
    pub tool_calls: Vec<ChatMessage>,
}

// ═══════════════ emit ═══════════════

#[derive(Clone)]
pub struct LoopPayloadTurnStart {
    pub turn: u32,
    pub session_id: SessionId,
    pub user_message_snapshot: ChatMessage,
}

#[derive(Clone)]
pub struct LoopPayloadStepStart {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub user_message_snapshot: ChatMessage,
}

#[derive(Clone)]
pub struct LoopPayloadRequestSent {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub user_message_snapshot: ChatMessage,
    pub request: Request,
}

/// loop:text-start(文本流开始)。
#[derive(Clone)]
pub struct LoopPayloadTextStart {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
}

/// loop:text-delta(文本增量, 流式逐片)。
#[derive(Clone)]
pub struct LoopPayloadTextDelta {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    /// 本次增量文本。
    pub delta: String,
}

/// loop:text-end(文本流结束)。
#[derive(Clone)]
pub struct LoopPayloadTextEnd {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
}

/// tool:call-start(模型点名调用工具)。
#[derive(Clone)]
pub struct LoopPayloadToolCallStart {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    /// 本次调用的编号。
    pub call_id: String,
    /// 工具名。
    pub name: String,
}

/// tool:call-args(工具参数增量, JSON 片段)。
#[derive(Clone)]
pub struct LoopPayloadToolCallArgs {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    /// 对应哪次调用。
    pub call_id: String,
    /// JSON 片段。
    pub delta: String,
}

/// tool:call-end(工具参数给全)。
#[derive(Clone)]
pub struct LoopPayloadToolCallEnd {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    /// 对应哪次调用。
    pub call_id: String,
}

/// tool:exec-start(循环开始真正执行工具)。
#[derive(Clone)]
pub struct LoopPayloadToolExecStart {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    /// 本次调用的编号。
    pub call_id: String,
    /// 工具名。
    pub name: String,
}

#[derive(Clone)]
pub struct LoopPayloadReply {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub user_message_snapshot: ChatMessage,
    pub reply: AssistantReply,
    /// 本次请求的用量(适配器上报; 没有则为 None)。
    pub usage: Option<Usage>,
}

#[derive(Clone)]
pub struct LoopPayloadToolResult {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub user_message_snapshot: ChatMessage,
    pub call: ToolCall,
    pub result: String,
}

#[derive(Clone)]
pub struct LoopPayloadError {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub user_message_snapshot: ChatMessage,
    pub error: String,
}

#[derive(Clone)]
pub struct LoopPayloadTurnEnd {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub user_message_snapshot: ChatMessage,
    pub cause: LoopCause,
}

#[derive(Clone, Debug, PartialEq)]
pub enum LoopPhase {
    Vote(LoopEvent),
    MaxStep,
    Error,
    Success,
}
impl From<LoopPhase> for String {
    fn from(value: LoopPhase) -> Self {
        match value {
            LoopPhase::Vote(event) => event.name().into(),
            LoopPhase::MaxStep => "max-step".into(),
            LoopPhase::Error => "error".into(),
            LoopPhase::Success => "success".into(),
        }
    }
}
#[derive(Clone)]
pub struct LoopCause {
    pub reason: String,
    pub phase: LoopPhase,
}
impl LoopCause {
    pub fn new(reason: String, phase: LoopPhase) -> Self {
        LoopCause { reason, phase }
    }

    pub fn success() -> Self {
        LoopCause::new("success".into(), LoopPhase::Success)
    }

    pub fn error(reason: String) -> Self {
        LoopCause::new(reason, LoopPhase::Error)
    }

    pub fn max_step() -> Self {
        LoopCause::new("max-step".into(), LoopPhase::MaxStep)
    }

    pub fn vote(event: LoopEvent, reason: String) -> Self {
        LoopCause::new(reason, LoopPhase::Vote(event))
    }
}
impl From<LoopCause> for String {
    fn from(value: LoopCause) -> Self {
        format!("[{}]: {}", String::from(value.phase), value.reason)
    }
}
