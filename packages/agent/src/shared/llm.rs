//! LLM 能力面的共享协议(与任何厂商无关)。
//!
//! 分层:
//!   适配器(plugins/llm_fake / plugins/llm_openai)把厂商的流式响应
//!   翻译成这里的 StreamEvent; 循环只消费 StreamEvent,
//!   不认识 openai / deepseek —— 换厂商只换适配器插件。
//!
//! StreamEvent 对齐 AGUI 的流式消息形态:
//!   文本:  TextStart → TextDelta* → TextEnd
//!   工具:  ToolCallStart → ToolCallArgs* → ToolCallEnd
//!   收尾:  Usage(可选) → Done

use std::pin::Pin;

use anyhow::Result;
use futures::Stream;

use crate::shared::message::Request;

/// 一次请求的 token 用量(适配器在流尾或 chunk 里上报)。
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Usage {
    /// 输入 token 数。
    pub prompt_tokens: u32,
    /// 输出 token 数。
    pub completion_tokens: u32,
}

/// 模型流式输出的统一事件(厂商无关)。
#[derive(Clone, Debug)]
pub enum StreamEvent {
    /// 文本开始(AGUI: TEXT_MESSAGE_START)。
    TextStart,
    /// 文本增量(AGUI: TEXT_MESSAGE_CONTENT)。
    TextDelta {
        /// 本次增量。
        text: String,
    },
    /// 文本结束(AGUI: TEXT_MESSAGE_END)。
    TextEnd,
    /// 工具调用开始(AGUI: TOOL_CALL_START)。
    ToolCallStart {
        /// 本次调用的编号。
        id: String,
        /// 工具名。
        name: String,
    },
    /// 工具参数增量(AGUI: TOOL_CALL_ARGS, JSON 片段, 可能分多次到达)。
    ToolCallArgs {
        /// 对应哪次调用。
        id: String,
        /// JSON 片段。
        delta: String,
    },
    /// 工具调用结束(AGUI: TOOL_CALL_END, 参数已给全)。
    ToolCallEnd {
        /// 对应哪次调用。
        id: String,
    },
    /// 用量统计(可能出现在流尾)。
    Usage(Usage),
    /// 流结束(携带厂商给的结束原因, 如 "stop" / "length" / "tool_calls")。
    Done {
        /// 厂商结束原因(没有就不带)。
        finish_reason: Option<String>,
    },
}

/// 装箱的流(异步 trait 方法的标准返回类型)。
pub type LlmStream<'a> = Pin<Box<dyn Stream<Item = Result<StreamEvent>> + Send + 'a>>;

/// 通往模型的适配器接口(唯一能力: 流式)。
///
/// 循环调用 stream() 后逐条消费 StreamEvent:
///   文本增量拼成回复正文; 工具调用拼成 ToolCall 列表; Usage 记账。
pub trait LlmAdapter: Send + Sync {
    /// 发一次流式请求。
    /// request 里已经装好了系统提示、历史、工具清单 —— 适配器只负责"送出去 + 翻译回来"。
    fn stream<'a>(&'a self, request: &'a Request) -> LlmStream<'a>;
}
