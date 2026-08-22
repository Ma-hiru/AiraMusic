use crate::llm::models::Role;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::broadcast;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AguiEvent {
    RunStarted {
        /// 会话 id(AGUI 的 threadId)
        thread_id: String,
        /// 运行 id(会话内唯一, turn相关)
        run_id: String,
    },
    RunFinished {
        thread_id: String,
        run_id: String,
        /// 结束原因(成功 / 被拦 / 出错 / 超步数)
        result: Option<String>,
    },
    RunError {
        thread_id: String,
        run_id: String,
        message: String,
    },
    /// 一步开始(工具往返的一小步)
    StepStarted {
        thread_id: String,
        run_id: String,
        /// 步骤名(如 "turn1-step2")
        step_name: String,
    },
    StepFinished {
        thread_id: String,
        run_id: String,
        step_name: String,
    },
    TextMessageStart {
        /// 消息 id(一个 step 一段文本)
        message_id: String,
        /// 角色(恒为 assistant, 循环只流模型输出)
        role: Role,
    },
    TextMessageContent {
        message_id: String,
        delta: String,
    },
    TextMessageEnd {
        message_id: String,
    },
    ToolCallStart {
        tool_call_id: String,
        tool_call_name: String,
    },
    /// 工具参数增量(JSON 片段)
    ToolCallArgs {
        tool_call_id: String,
        delta: String,
    },
    ToolCallEnd {
        tool_call_id: String,
    },
    ToolCallResult {
        tool_call_id: String,
        content: String,
    },
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
