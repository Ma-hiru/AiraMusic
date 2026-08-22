use crate::cancel::Signal;
use crate::session::models::SessionId;
use crate::tools::models::Tool;
use crate::utils::generate_id;
use anyhow::Result;
use futures::Stream;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::borrow::Cow;
use std::collections::HashMap;
use std::pin::Pin;
use std::sync::Arc;
use tiktoken_rs::{CoreBPE, o200k_base};

static TOKENIZER: Lazy<CoreBPE> = Lazy::new(|| o200k_base().expect("Failed to load tokenizer"));

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

// 10M	10,000,000	Llama 4 Scout
// 2M	2,000,000	Gemini 3.1 Pro
// 1M	1,000,000	GPT-5.5, Claude Opus 4.8, DeepSeek V4, Qwen3.7 Max
// 512K	524,288	Kimi K2.5
// 400K	409,600	GPT-5.4-mini
// 256K	262,144	Kimi K2, 混元 Hy3
// 200K	204,800	Claude 3.5 Sonnet, Kimi K2
// 128K	131,072	Llama 3.1, DeepSeek-V3, Qwen2.5
// 8K	8,192	Llama 2, 早期GPT模型
#[derive(Copy, Clone, PartialEq, PartialOrd, Ord, Eq, Default, Serialize, Deserialize)]
pub enum LLMContextSize {
    #[serde(rename = "8K")]
    _8K,
    #[default]
    #[serde(rename = "128K")]
    _128K,
    #[serde(rename = "256K")]
    _256K,
    #[serde(rename = "200K")]
    _200K,
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
impl LLMContextSize {
    pub fn from_model(model: Cow<str>) -> Self {
        match model.as_ref() {
            "deepseek-v4-flash" => Self::from("1M"),
            "deepseek-v4-flash-vision-exp" => Self::from("1M"),
            "deepseek-v4-pro" => Self::from("1M"),
            _ => Self::default(),
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

#[derive(Clone)]
pub struct Request {
    pub system: Vec<String>,
    pub messages: Vec<ChatMessage>,
    pub tools: Vec<Arc<dyn Tool>>,
    pub config: LLMConfig,
    pub cancel: Signal,
}

/// LLM 适配器(异步接口)
pub trait LLMAdapter: Send + Sync {
    fn stream<'a>(&'a self, request: &'a Request) -> LlmStream<'a>;
}
