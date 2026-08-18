//! 词典 · 共享词汇 —— 循环、插件、会话日志三方共同的语言。
//!
//! 这里只留"大家都用"的类型, 分两组:
//!   一、消息(会话日志里存的东西)
//!   二、模型请求与回复(能力面契约 + 循环都用)
//! 循环专属的"裁决"和"事件载荷"已搬到 loop/models.rs ——
//! 判据: 只有循环世界用到的类型放 loop, 三方共享的留这里。

use std::sync::Arc;

use crate::plugins::tools::Tool;
use serde::{Deserialize, Serialize}; // 序列化: 将来存盘/走网络要用
use serde_json::Value;
// JSON 值: 工具参数的通用表示

// ═══════════════════ 一、消息(会话日志里存的东西) ═══════════════════

/// 消息的四种角色。
/// #[serde(rename_all = "lowercase")] = 存盘时序列化成小写("system"/"user"…)。
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    /// 系统消息: 初始历史、否决记录、错误记录(不出自模型和用户)。
    System,
    /// 用户消息: 外界 send 进来的输入。
    User,
    /// 助手消息: 模型的回复。
    Assistant,
    /// 工具消息: 一次工具执行的结果。
    Tool,
}

/// 会话日志里的一条事实: 角色 + 内容; tool 角色用 tool_call_id 关联模型发出的调用。
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    /// 谁说的(见 Role)。
    pub role: Role,
    /// 说了什么。
    pub content: String,
    /// 仅 tool 角色使用: 对应哪一次模型工具调用(ToolCall.id)。
    /// #[serde(skip_serializing_if)] = 为空时存盘不写这个字段。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl ChatMessage {
    /// 快捷构造: 一条系统消息。
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: Role::System,
            content: content.into(), // Into<String> 让调用方可以直接传 &str
            tool_call_id: None,
        }
    }

    /// 快捷构造: 一条用户消息。
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: Role::User,
            content: content.into(),
            tool_call_id: None,
        }
    }
}

// ═══════════════════ 二、模型请求与回复 ═══════════════════

/// 模型要求执行的一次工具调用。循环只按 name 找工具, 不认识工具本身。
#[derive(Clone, Debug)]
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

/// "前"阶段组装出来的请求: 循环每步重建, 表决之后照此发模型。
#[derive(Clone)]
pub struct Request {
    /// 系统提示词: 各插件注册的段落, 已按 order 排好序(纯文本列表)。
    pub system: Vec<String>,
    /// 发给模型的历史: 会话日志经过压缩投影的结果。
    pub messages: Vec<ChatMessage>,
    /// 可用工具清单: 各插件注册的工具。
    pub tools: Vec<Arc<dyn Tool>>,
}
