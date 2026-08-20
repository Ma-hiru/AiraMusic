use crate::tools::models::Tool;
use anyhow::Result;
use futures::Stream;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::pin::Pin;
use std::sync::Arc;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    User,
    Assistant,
    Tool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: Role,
    pub content: String,
    /// 仅 assistant 角色
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tool_calls: Vec<ToolCall>,
    /// 仅 tool 角色
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}
impl ChatMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: Role::System,
            content: content.into(),
            tool_calls: Vec::new(),
            tool_call_id: None,
        }
    }

    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: Role::User,
            content: content.into(),
            tool_calls: Vec::new(),
            tool_call_id: None,
        }
    }

    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: Role::Assistant,
            content: content.into(),
            tool_calls: Vec::new(),
            tool_call_id: None,
        }
    }

    pub fn assistant_with_tool_calls(
        content: impl Into<String>,
        tool_calls: Vec<ToolCall>,
    ) -> Self {
        Self {
            role: Role::Assistant,
            content: content.into(),
            tool_calls,
            tool_call_id: None,
        }
    }

    pub fn tool(content: impl Into<String>, tool_call_id: impl Into<String>) -> Self {
        Self {
            role: Role::Tool,
            content: content.into(),
            tool_calls: Vec::new(),
            tool_call_id: Some(tool_call_id.into()),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    /// 工具参数(JSON)
    pub args: Value,
}

/// 模型的一轮回复: 文本 + 要执行的工具调用
#[derive(Clone, Debug)]
pub struct AssistantReply {
    pub text: String,
    pub tool_calls: Vec<ToolCall>,
}

/// 一次请求的 token 用量
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Usage {
    /// 输入 token 数
    pub prompt_tokens: u32,
    /// 输出 token 数
    pub completion_tokens: u32,
}

/// 模型流式输出的统一事件(厂商无关)
#[derive(Clone, Debug)]
pub enum StreamEvent {
    /// 文本开始(AGUI: TEXT_MESSAGE_START)。
    TextStart,
    /// 文本增量(AGUI: TEXT_MESSAGE_CONTENT)。
    TextDelta {
        /// 本次增量
        text: String,
    },
    /// 文本结束(AGUI: TEXT_MESSAGE_END)。
    TextEnd,
    /// 工具调用开始(AGUI: TOOL_CALL_START)。
    ToolCallStart { id: String, name: String },
    /// 工具参数增量(AGUI: TOOL_CALL_ARGS, JSON 片段, 可能分多次到达)
    ToolCallArgs {
        id: String,
        /// JSON 片段
        delta: String,
    },
    /// 工具调用结束(AGUI: TOOL_CALL_END, 参数已给全)
    ToolCallEnd { id: String },
    /// 用量统计(可能出现在流尾)
    Usage(Usage),
    /// 流结束(携带厂商给的结束原因, 如 "stop" / "length" / "tool_calls")
    Done {
        /// 厂商结束原因(没有就不带)
        finish_reason: Option<String>,
    },
}

/// 装箱的流(异步 trait 方法的标准返回类型)
pub type LlmStream<'a> = Pin<Box<dyn Stream<Item = Result<StreamEvent>> + Send + 'a>>;

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum LLMProvider {
    #[default]
    OpenAI,
}
impl LLMProvider {
    pub fn iter() -> impl Iterator<Item = Self> {
        [LLMProvider::OpenAI].iter().copied()
    }
}

#[derive(Deserialize, Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMConfig {
    pub provider: LLMProvider,
    pub model: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub context_size: Option<usize>,
    pub headers: Option<HashMap<String, String>>,
    pub other: Option<Value>,
}

#[derive(Clone)]
pub struct Request {
    pub system: Vec<String>,
    pub messages: Vec<ChatMessage>,
    pub tools: Vec<Arc<dyn Tool>>,
    pub config: LLMConfig,
}

/// LLM 适配器(异步接口)
pub trait LLMAdapter: Send + Sync {
    fn stream<'a>(&'a self, request: &'a Request) -> LlmStream<'a>;
}
