use crate::session::models::SessionId;
use crate::tools::models::Tool;
use crate::utils::Signal;
use crate::utils::generate_id;
use anyhow::Result;
use futures::Stream;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::fmt;
use std::pin::Pin;
use std::sync::Arc;
use tiktoken_rs::{CoreBPE, o200k_base};

static TOKENIZER: Lazy<CoreBPE> = Lazy::new(|| o200k_base().expect("Failed to load tokenizer"));

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    System,
    User,
    Assistant,
    Tool,
    // 内部使用
    Inner,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum ChatRoleInnerType {
    Think,
    Error,
    Compressed,
    Usage,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: String,
    /// 思考内容 (思考模型且返回思考内容才有)
    /// 仅 assistant 角色有意义
    /// 多轮对话时（有tool call+reasoning）需随消息回传给 API （交错式思考）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reasoning_content: Option<String>,
    /// 仅 assistant 角色
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tool_calls: Vec<ChatToolCall>,
    /// 仅 tool 角色
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    /// 仅 inner 角色
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inner_type: Option<ChatRoleInnerType>,
}
impl ChatMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: ChatRole::System,
            content: content.into(),
            reasoning_content: None,
            tool_calls: Vec::new(),
            tool_call_id: None,
            inner_type: None,
        }
    }

    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: ChatRole::User,
            content: content.into(),
            reasoning_content: None,
            tool_calls: Vec::new(),
            tool_call_id: None,
            inner_type: None,
        }
    }

    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: ChatRole::Assistant,
            content: content.into(),
            reasoning_content: None,
            tool_calls: Vec::new(),
            tool_call_id: None,
            inner_type: None,
        }
    }

    pub fn assistant_with_tool_calls(
        content: impl Into<String>,
        tool_calls: Vec<ChatToolCall>,
    ) -> Self {
        Self::assistant_with_tool_calls_and_reasoning(content, tool_calls, None)
    }

    pub fn assistant_with_tool_calls_and_reasoning(
        content: impl Into<String>,
        tool_calls: Vec<ChatToolCall>,
        reasoning_content: Option<String>,
    ) -> Self {
        Self {
            role: ChatRole::Assistant,
            content: content.into(),
            reasoning_content,
            tool_calls,
            tool_call_id: None,
            inner_type: None,
        }
    }

    pub fn tool(content: impl Into<String>, tool_call_id: impl Into<String>) -> Self {
        Self {
            role: ChatRole::Tool,
            content: content.into(),
            reasoning_content: None,
            tool_calls: Vec::new(),
            tool_call_id: Some(tool_call_id.into()),
            inner_type: None,
        }
    }

    pub fn inner(content: impl Into<String>, inner_type: ChatRoleInnerType) -> Self {
        Self {
            role: ChatRole::Inner,
            content: content.into(),
            reasoning_content: None,
            tool_calls: Vec::new(),
            tool_call_id: None,
            inner_type: Some(inner_type),
        }
    }

    pub fn usage(content: &ChatTurnUsage) -> Self {
        Self::inner(
            serde_json::to_string(content).unwrap(),
            ChatRoleInnerType::Usage,
        )
    }

    pub fn think(content: impl Into<String>) -> Self {
        Self::inner(content, ChatRoleInnerType::Think)
    }

    pub fn error(content: impl Into<String>) -> Self {
        Self::inner(content, ChatRoleInnerType::Error)
    }

    pub fn compressed(content: impl Into<String>) -> Self {
        Self::inner(content, ChatRoleInnerType::Compressed)
    }

    pub fn token_count(&self) -> usize {
        let tokens = TOKENIZER.encode_with_special_tokens(&self.content);
        tokens.len()
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ChatMemory {
    pub id: String,
    pub content: String,
}
impl ChatMemory {
    pub fn new(content: String) -> Self {
        Self {
            id: generate_id("m"),
            content,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ChatToolCall {
    pub id: String,
    pub name: String,
    /// 工具参数(JSON)
    pub args: Value,
}

/// 模型的一轮回复: 文本 + 思考 + 要执行的工具调用
#[derive(Clone, Debug)]
pub struct ChatAssistantReply {
    pub text: String,
    /// 思考内容(思考模式模型才有, 空串 = 无思考)
    pub reasoning: String,
    pub tool_calls: Vec<ChatToolCall>,
}

/// 一次请求的 token 用量
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct ChatUsage {
    /// 输入 token 数
    pub prompt_tokens: u32,
    /// 输出 token 数
    pub completion_tokens: u32,
}

/// 一次请求的 token 用量
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct ChatTurnUsage {
    records: Vec<ChatStepUsage>,
}
impl ChatTurnUsage {
    pub fn new() -> Self {
        Self {
            records: Vec::new(),
        }
    }

    pub fn add(&mut self, record: (u32, ChatUsage)) {
        self.records.push(record.into());
    }
}

/// 请求中某个轮回的 token 用量
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct ChatStepUsage {
    step: u32,
    usage: ChatUsage,
}
impl From<(u32, ChatUsage)> for ChatStepUsage {
    fn from(value: (u32, ChatUsage)) -> Self {
        Self {
            step: value.0,
            usage: value.1,
        }
    }
}

#[derive(Clone)]
pub struct ChatRequest {
    pub system: Vec<String>,
    pub messages: Vec<ChatMessage>,
    pub tools: Vec<Arc<dyn Tool>>,
    pub config: LLMConfig,
    pub cancel: Signal,
}

/// 模型流式输出的统一事件(厂商无关)
#[derive(Clone, Debug)]
pub enum LLMStreamEvent {
    /// 文本开始(AGUI: TEXT_MESSAGE_START)
    TextStart,
    /// 文本增量(AGUI: TEXT_MESSAGE_CONTENT)
    TextDelta {
        /// 本次增量
        text: String,
    },
    /// 文本结束(AGUI: TEXT_MESSAGE_END)
    TextEnd,
    /// 思考开始(AGUI: REASONING_MESSAGE_START, 思考模式模型才有)
    ReasoningStart,
    /// 思考增量(AGUI: REASONING_MESSAGE_CONTENT)
    ReasoningDelta {
        /// 本次增量
        delta: String,
    },
    /// 思考结束(AGUI: REASONING_MESSAGE_END)
    ReasoningEnd,
    /// 工具调用开始(AGUI: TOOL_CALL_START)
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
    Usage(ChatUsage),
    /// 流结束(携带厂商给的结束原因, 如 "stop" / "length" / "tool_calls")
    Done {
        /// 厂商结束原因(没有就不带)
        finish_reason: Option<String>,
    },
}

/// 装箱的流(异步 trait 方法的标准返回类型)
pub type LLMStream<'a> = Pin<Box<dyn Stream<Item = Result<LLMStreamEvent>> + Send + 'a>>;

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize, Default, Eq, Hash)]
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

#[derive(Copy, Clone, Default, Eq, Serialize, Deserialize)]
pub enum LLMContextSize {
    #[serde(rename = "8K")]
    _8K,
    #[default]
    #[serde(rename = "128K")]
    _128K,
    #[serde(rename = "200K")]
    _200K,
    #[serde(rename = "256K")]
    _256K,
    #[serde(rename = "400K")]
    _400K,
    #[serde(rename = "512K")]
    _512K,
    #[serde(rename = "1M")]
    _1M,
    #[serde(rename = "2M")]
    _2M,
    #[serde(rename = "10M")]
    _10M,
    #[serde(untagged)]
    Custom(usize),
}
impl PartialEq for LLMContextSize {
    fn eq(&self, other: &Self) -> bool {
        usize::from(*self) == usize::from(*other)
    }
}
impl PartialOrd for LLMContextSize {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for LLMContextSize {
    fn cmp(&self, other: &Self) -> Ordering {
        usize::from(*self).cmp(&usize::from(*other))
    }
}
impl fmt::Display for LLMContextSize {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::_8K => formatter.write_str("8K"),
            Self::_128K => formatter.write_str("128K"),
            Self::_200K => formatter.write_str("200K"),
            Self::_256K => formatter.write_str("256K"),
            Self::_400K => formatter.write_str("400K"),
            Self::_512K => formatter.write_str("512K"),
            Self::_1M => formatter.write_str("1M"),
            Self::_2M => formatter.write_str("2M"),
            Self::_10M => formatter.write_str("10M"),
            Self::Custom(value) => value.fmt(formatter),
        }
    }
}
impl From<LLMContextSize> for usize {
    fn from(value: LLMContextSize) -> Self {
        match value {
            LLMContextSize::_8K => 8_192,
            LLMContextSize::_128K => 131_072,
            LLMContextSize::_256K => 262_144,
            LLMContextSize::_200K => 204_800,
            LLMContextSize::_400K => 409_600,
            LLMContextSize::_512K => 524_288,
            LLMContextSize::_1M => 1_000_000,
            LLMContextSize::_2M => 2_000_000,
            LLMContextSize::_10M => 10_000_000,
            LLMContextSize::Custom(size) => size,
        }
    }
}
impl<T> From<T> for LLMContextSize
where
    T: AsRef<str>,
{
    fn from(s: T) -> Self {
        let ctx = s.as_ref().trim().to_uppercase();
        match ctx.as_str() {
            "10M" | "10 M" => Self::_10M,
            "2M" | "2 M" => Self::_2M,
            "1M" | "1 M" => Self::_1M,
            "512K" | "512 K" => Self::_512K,
            "400K" | "400 K" => Self::_400K,
            "256K" | "256 K" => Self::_256K,
            "200K" | "200 K" => Self::_200K,
            "128K" | "128 K" => Self::_128K,
            "8K" | "8 K" => Self::_8K,
            other => Self::Custom(other.parse().unwrap_or(Self::default().into())),
        }
    }
}

#[derive(Deserialize, Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMConfig {
    pub id: String,
    pub name: String,
    pub provider: LLMProvider,
    pub model: String,
    pub api_key: String,
    pub context_size: LLMContextSize,
    pub base_url: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub other: Option<Value>,
    pub default: bool,
    /// 思考模式开关(请求带 thinking: {type: enabled})
    #[serde(default)]
    pub thinking: bool,
}
pub type LLMConfigSecret = LLMConfig;

/// LLM 配置变更事件
#[derive(Clone)]
pub enum LLMConfigEvent {
    AddGlobal {
        config: LLMConfig,
    },
    RemoveGlobal {
        id: String,
    },
    SetSession {
        session_id: SessionId,
        config: LLMConfig,
    },
}

/// LLM 适配器(异步接口)
pub trait LLMAdapter: Send + Sync {
    fn stream<'a>(&'a self, request: &'a ChatRequest) -> LLMStream<'a>;
}
