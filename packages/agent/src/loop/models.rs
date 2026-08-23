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
//!   思考: ReasoningStart → ReasoningDelta* → ReasoningEnd(思考模式模型才有)
//!   工具: ToolCallStart → ToolCallArgs* → ToolCallEnd(模型侧, 来自 llm 流)
//!         ToolExecStart → ToolResult(执行侧, 来自循环)

use crate::ctx::models::Event;
use crate::llm::models::{AssistantReply, ChatMessage, Request, ToolCall, TurnUsage, Usage};
use crate::session::models::SessionId;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum LoopEvent {
    // ── 决裁事件(veto): 插件可改写载荷、可拦截 ──
    /// 准入: 能不能发
    BeforeRequest,
    /// 定稿: 请求最终改写
    Request,
    /// 审批: 工具调用批不批
    ToolPreExecute,
    /// 改写: 工具结果改写 + 注入上下文
    ToolAfter,
    /// 判读: 这一轮继不继续
    AfterReply,

    // ── 观察事件(emit): 只读的"阶段事实", 载荷是冻结终值 ──
    /// 一轮开始
    TurnStart,
    /// 一步开始(一轮可有多步,比如工具往返)
    StepStart,
    /// 请求已定稿发出(决裁之后的终值)
    RequestSent,
    /// 文本开始(AGUI: TEXT_MESSAGE_START)
    TextStart,
    /// 文本增量(AGUI: TEXT_MESSAGE_CONTENT)
    TextDelta,
    /// 文本结束(AGUI: TEXT_MESSAGE_END)
    TextEnd,
    /// 思考开始(AGUI: REASONING_MESSAGE_START)
    ReasoningStart,
    /// 思考增量(AGUI: REASONING_MESSAGE_CONTENT)
    ReasoningDelta,
    /// 思考结束(AGUI: REASONING_MESSAGE_END)
    ReasoningEnd,
    /// 工具调用开始(AGUI: TOOL_CALL_START)
    ToolCallStart,
    /// 工具参数增量(AGUI: TOOL_CALL_ARGS)
    ToolCallArgs,
    /// 工具调用结束(AGUI: TOOL_CALL_END)
    ToolCallEnd,
    /// 工具开始执行(AGUI: RUN_STARTED 的对应物, 执行侧)。
    ToolExecStart,
    /// 模型回复到达(整条消息的冻结快照, 含工具调用与用量)
    Reply,
    /// 工具结果落定(决裁之后的终值)
    ToolResult,
    /// 一轮结束(决裁之后的终局)，除非发生 InnerError，否则结束后一定会触发 TurnEnd
    TurnEnd,
    /// 循环出错
    Error,
    /// 程序错误
    InnerError,
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
            // 观察 - 轮/步级
            LoopEvent::TurnStart => "loop:turn-start",
            LoopEvent::StepStart => "loop:step-start",
            LoopEvent::RequestSent => "loop:request-sent",
            // 观察 - 流式文本
            LoopEvent::TextStart => "loop:text-start",
            LoopEvent::TextDelta => "loop:text-delta",
            LoopEvent::TextEnd => "loop:text-end",
            // 观察 - 流式思考
            LoopEvent::ReasoningStart => "loop:reasoning-start",
            LoopEvent::ReasoningDelta => "loop:reasoning-delta",
            LoopEvent::ReasoningEnd => "loop:reasoning-end",
            // 观察 - 工具调用(模型侧)与执行(执行侧)
            LoopEvent::ToolCallStart => "tool:call-start",
            LoopEvent::ToolCallArgs => "tool:call-args",
            LoopEvent::ToolCallEnd => "tool:call-end",
            LoopEvent::ToolExecStart => "tool:exec-start",
            // 观察 - 收尾
            LoopEvent::Reply => "loop:reply",
            LoopEvent::ToolResult => "tool:result",
            LoopEvent::TurnEnd => "loop:turn-end",
            LoopEvent::Error => "loop:error",
            LoopEvent::InnerError => "loop:inner-error",
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
    pub run_id: String,
    pub turn: u32,
    pub session_id: SessionId,
    pub user_message_snapshot: ChatMessage,
}

#[derive(Clone)]
pub struct LoopPayloadStepStart {
    pub run_id: String,
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

#[derive(Clone)]
pub struct LoopPayloadTextStart {
    pub run_id: String,
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
}

#[derive(Clone)]
pub struct LoopPayloadTextDelta {
    pub run_id: String,
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    /// 本次增量文本。
    pub delta: String,
}

#[derive(Clone)]
pub struct LoopPayloadTextEnd {
    pub run_id: String,
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
}

#[derive(Clone)]
pub struct LoopPayloadReasoningStart {
    pub run_id: String,
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
}

#[derive(Clone)]
pub struct LoopPayloadReasoningDelta {
    pub run_id: String,
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    /// 本次思考增量
    pub delta: String,
}

#[derive(Clone)]
pub struct LoopPayloadReasoningEnd {
    pub run_id: String,
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
}

#[derive(Clone)]
pub struct LoopPayloadToolCallStart {
    pub run_id: String,
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub call_id: String,
    pub name: String,
}

#[derive(Clone)]
pub struct LoopPayloadToolCallArgs {
    pub run_id: String,
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub call_id: String,
    /// JSON 片段
    pub delta: String,
}

#[derive(Clone)]
pub struct LoopPayloadToolCallEnd {
    pub run_id: String,
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub call_id: String,
}

#[derive(Clone)]
pub struct LoopPayloadToolExecStart {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub call_id: String,
    pub name: String,
}

#[derive(Clone)]
pub struct LoopPayloadReply {
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub user_message_snapshot: ChatMessage,
    pub reply: AssistantReply,
    /// 本次请求的用量(适配器上报; 没有则为 None)
    pub usage: Option<Usage>,
}

#[derive(Clone)]
pub struct LoopPayloadToolResult {
    pub run_id: String,
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub user_message_snapshot: ChatMessage,
    pub call: ToolCall,
    pub result: String,
}

#[derive(Clone)]
pub struct LoopPayloadError {
    pub run_id: String,
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub user_message_snapshot: ChatMessage,
    pub error: String,
}

#[derive(Clone)]
pub struct LoopPayloadInnerError {
    pub run_id: String,
    pub session_id: SessionId,
    pub error: String,
    /// inner error 是内部非预期错误，不会触发 TurnEnd 和 Error 事件
    /// Error 是预期错误，会触发 TurnEnd 和 Error 事件
    /// 因此inner error 需要单独带上 usages
    pub usages: TurnUsage,
    pub turn: Option<u32>,
}

#[derive(Clone)]
pub struct LoopPayloadTurnEnd {
    pub run_id: String,
    pub turn: u32,
    pub step: u32,
    pub session_id: SessionId,
    pub usages: TurnUsage,
    pub user_message_snapshot: ChatMessage,
    pub cause: LoopCause,
}

#[derive(Clone, Debug, PartialEq)]
pub enum LoopPhase {
    Vote(LoopEvent),
    MaxStep,
    Error,
    Cancel,
    Success,
}
impl From<LoopPhase> for String {
    fn from(value: LoopPhase) -> Self {
        match value {
            LoopPhase::Vote(event) => event.name().into(),
            LoopPhase::MaxStep => "max-step".into(),
            LoopPhase::Error => "error".into(),
            LoopPhase::Cancel => "cancel".into(),
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

    pub fn cancel() -> Self {
        LoopCause::new("已取消".into(), LoopPhase::Cancel)
    }
}
impl From<LoopCause> for String {
    fn from(value: LoopCause) -> Self {
        format!("[{}]: {}", String::from(value.phase), value.reason)
    }
}
