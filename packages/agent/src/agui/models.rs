use crate::llm::models::{Role, TurnUsage};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::{Display, Formatter};
use tokio::sync::broadcast;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AguiReasoningRole {
    Reasoning,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "SCREAMING_SNAKE_CASE",
    rename_all_fields = "camelCase"
)]
pub enum AguiEvent {
    RunStarted {
        /// 会话 id(AGUI 的 threadId)
        #[serde(rename = "threadId")]
        session_id: String,
        /// 运行 id(会话内唯一, turn相关)
        run_id: String,
    },
    RunFinished {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        /// 结束原因(成功 / 被拦 / 出错 / 超步数)
        result: Option<String>,
        /// (step, usage)
        usages: TurnUsage,
    },
    RunError {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        message: String,
        // 如果是 inner error 不会出现 turn end事件
        // 也不会间接触发 RunFinished 事件，此时 usages 在这里出现
        usages: Option<TurnUsage>,
    },
    /// 一步开始(工具往返的一小步)
    StepStarted {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        /// 步骤名(如 "turn1-step2")
        step_name: String,
    },
    StepFinished {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        step_name: String,
    },
    TextMessageStart {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        /// 消息 id(一个 step 一段文本)
        message_id: String,
        /// 角色(恒为 assistant, 循环只流模型输出)
        role: Role,
    },
    TextMessageContent {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        message_id: String,
        delta: String,
    },
    TextMessageEnd {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        message_id: String,
    },
    ReasoningMessageStart {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        message_id: String,
        role: AguiReasoningRole,
    },
    ReasoningMessageContent {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        message_id: String,
        delta: String,
    },
    ReasoningMessageEnd {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        message_id: String,
    },
    ToolCallStart {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        tool_call_id: String,
        tool_call_name: String,
    },
    /// 工具参数增量(JSON 片段)
    ToolCallArgs {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        tool_call_id: String,
        delta: String,
    },
    ToolCallEnd {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        tool_call_id: String,
    },
    ToolCallResult {
        #[serde(rename = "threadId")]
        session_id: String,
        run_id: String,
        message_id: String,
        tool_call_id: String,
        content: String,
    },
}
impl Display for AguiEvent {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            AguiEvent::RunStarted { run_id, session_id } => {
                write!(f, "RunStarted({session_id}) {run_id}")
            }
            AguiEvent::RunFinished {
                run_id,
                session_id,
                result,
                usages,
            } => {
                write!(
                    f,
                    "RunFinished({session_id}) {run_id} result: {:#?} usages: {:#?}",
                    result, usages
                )
            }
            AguiEvent::RunError {
                session_id,
                run_id,
                message,
                usages,
            } => {
                write!(
                    f,
                    "RunError({session_id}) {run_id} message: {message} usages: {:#?}",
                    usages
                )
            }
            AguiEvent::StepStarted {
                session_id,
                run_id,
                step_name,
            } => {
                write!(
                    f,
                    "StepStarted({session_id}) {run_id} step_name: {step_name}"
                )
            }
            AguiEvent::StepFinished {
                step_name,
                run_id,
                session_id,
            } => {
                write!(
                    f,
                    "StepFinished({session_id}) {run_id} step_name: {step_name}"
                )
            }
            AguiEvent::TextMessageStart {
                message_id,
                role,
                session_id,
                run_id,
            } => {
                write!(
                    f,
                    "TextMessageStart({session_id}) {run_id} message_id: {message_id} role: {:#?}",
                    role
                )
            }
            AguiEvent::TextMessageContent { delta, .. } => {
                write!(f, "{delta}")
            }
            AguiEvent::TextMessageEnd {
                session_id,
                run_id,
                message_id,
            } => {
                write!(
                    f,
                    "TextMessageEnd({session_id}) {run_id} message_id: {message_id}"
                )
            }
            AguiEvent::ReasoningMessageStart {
                message_id,
                run_id,
                session_id,
                ..
            } => {
                write!(
                    f,
                    "ReasoningMessageStart({session_id}) {run_id} message_id: {message_id}"
                )
            }
            AguiEvent::ReasoningMessageContent { delta, .. } => {
                write!(f, "{delta}")
            }
            AguiEvent::ReasoningMessageEnd {
                message_id,
                run_id,
                session_id,
            } => {
                write!(
                    f,
                    "ReasoningMessageEnd({session_id}) {run_id} message_id: {message_id}"
                )
            }
            AguiEvent::ToolCallStart {
                tool_call_name,
                tool_call_id,
                run_id,
                session_id,
            } => {
                write!(
                    f,
                    "ToolCallStart({session_id}) {run_id} tool_call_id: {tool_call_id} tool_call_name: {tool_call_name}"
                )
            }
            AguiEvent::ToolCallArgs { delta, .. } => {
                write!(f, "{delta}")
            }
            AguiEvent::ToolCallEnd {
                tool_call_id,
                run_id,
                session_id,
            } => {
                write!(
                    f,
                    "ToolCallEnd({session_id}) {run_id} tool_call_id: {tool_call_id}"
                )
            }
            AguiEvent::ToolCallResult {
                tool_call_id,
                session_id,
                run_id,
                content,
                ..
            } => {
                write!(
                    f,
                    "ToolCallResult({session_id}) {run_id} tool_call_id: {tool_call_id} content: {content}"
                )
            }
        }
    }
}

/// AGUI 事件广播服务(传输层订阅它)。
#[derive(Clone)]
pub struct AguiEmitter {
    pub tx: broadcast::Sender<AguiEvent>,
}
impl AguiEmitter {
    /// 订阅事件流。
    pub fn subscribe(&self) -> broadcast::Receiver<AguiEvent> {
        self.tx.subscribe()
    }
}

/// 翻译器状态: 记录每个会话"当前进行中的步骤", 以便发 StepFinished。
#[derive(Default)]
pub struct AguiState {
    /// session_id → (run_id, step_name)
    pub current_step: HashMap<String, (String, String)>,
}
