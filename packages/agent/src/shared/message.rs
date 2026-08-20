//! 共享词汇: 会话日志的语言(厂商无关)。
//!
//! ChatMessage 是"一条能被任意厂商适配器翻译的消息":
//!   assistant 角色 → tool_calls 字段(模型在这条消息里发起的工具调用)
//!   tool 角色     → tool_call_id 字段(对应当初哪次调用)
//! 适配器(如 llm_openai)负责把它翻译成厂商的消息格式 —— 见 plugins/llm_openai.rs。

use std::sync::Arc;

// 序列化: 会话日志要能落盘/走网络
use crate::plugins::tools::Tool;
use serde::{Deserialize, Serialize};
use serde_json::Value; // JSON 值: 工具参数的通用表示

// ═══════════════════ 一、消息(会话日志里存的东西) ═══════════════════

/// 消息的四种角色。
/// #[serde(rename_all = "lowercase")] = 序列化成小写("system"/"user"…)。
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    /// 系统消息: 初始历史、否决记录、错误记录、压缩摘要。
    System,
    /// 用户消息: 外界 send 进来的输入。
    User,
    /// 助手消息: 模型的回复(可能携带工具调用)。
    Assistant,
    /// 工具消息: 一次工具执行的结果。
    Tool,
}

/// 会话日志里的一条事实。
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ChatMessage {
    /// 谁说的(见 Role)。
    pub role: Role,
    /// 说了什么。
    pub content: String,
    /// 仅 assistant 角色: 模型在这条消息里发起的工具调用
    /// (回放给模型时必须带上, 否则模型不知道"我为什么要调工具")。
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tool_calls: Vec<ToolCall>,
    /// 仅 tool 角色: 对应哪一次模型工具调用(ToolCall.id)。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl ChatMessage {
    /// 快捷构造: 一条系统消息。
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: Role::System,
            content: content.into(),
            tool_calls: Vec::new(),
            tool_call_id: None,
        }
    }

    /// 快捷构造: 一条用户消息。
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: Role::User,
            content: content.into(),
            tool_calls: Vec::new(),
            tool_call_id: None,
        }
    }

    /// 快捷构造: 一条助手消息(纯文本, 不带工具调用)。
    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: Role::Assistant,
            content: content.into(),
            tool_calls: Vec::new(),
            tool_call_id: None,
        }
    }

    /// 快捷构造: 一条携带工具调用的助手消息。
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

    /// 快捷构造: 一条工具结果消息。
    pub fn tool(content: impl Into<String>, tool_call_id: impl Into<String>) -> Self {
        Self {
            role: Role::Tool,
            content: content.into(),
            tool_calls: Vec::new(),
            tool_call_id: Some(tool_call_id.into()),
        }
    }
}

// ═══════════════════ 二、模型请求与回复 ═══════════════════

/// 模型要求执行的一次工具调用。循环只按 name 找工具, 不认识工具本身。
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ToolCall {
    /// 本次调用的唯一编号(会话日志里工具结果靠它对齐)。
    pub id: String,
    /// 要调的工具名(循环拿它去注册表里查)。
    pub name: String,
    /// 工具参数(JSON, 由工具自己校验)。
    pub args: Value,
}

/// 模型的一轮回复: 文本 + 要执行的工具调用。
#[derive(Clone, Debug)]
pub struct AssistantReply {
    /// 模型说的话(可能为空, 比如"只调工具不发言")。
    pub text: String,
    /// 模型点名要执行的工具调用(可能为空 = 没有)。
    pub tool_calls: Vec<ToolCall>,
}

/// "前"阶段组装出来的请求: 循环每步重建, 决裁之后照此发模型。
#[derive(Clone)]
pub struct Request {
    /// 模型名("用哪个模型"是请求的一部分 —— 路由插件可以在 loop:request 决裁点改写它)。
    pub model: String,
    /// 系统提示词: 各插件注册的段落, 已按 order 排好序(纯文本列表)。
    pub system: Vec<String>,
    /// 发给模型的历史: 会话日志经过压缩投影的结果。
    pub messages: Vec<ChatMessage>,
    /// 可用工具清单: 各插件注册的工具。
    pub tools: Vec<Arc<dyn Tool>>,
}
