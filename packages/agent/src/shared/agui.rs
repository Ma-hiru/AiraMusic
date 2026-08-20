//! AGUI(Agent-UI)协议事件 —— 传输无关的线格式词汇。
//!
//! 序列化为 camelCase JSON(对齐 AG-UI 协议的事件命名);
//! 传输层(SSE / WebSocket / 控制台)只负责把事件发出去, 不关心语义。
//! 由 agui 插件(翻译器)产出, 任何传输插件订阅广播即可。
//!
//! 事件 → AG-UI 协议对照:
//!   RunStarted / RunFinished / RunError / StepStarted / StepFinished
//!   TextMessageStart / TextMessageContent / TextMessageEnd
//!   ToolCallStart / ToolCallArgs / ToolCallEnd / ToolCallResult

use serde::{Deserialize, Serialize};

/// 一条 AGUI 协议事件(Clone: 广播通道要求可克隆)。
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AguiEvent {
    /// 一次运行开始(对应循环的一轮)。
    RunStarted {
        /// 会话 id(AGUI 的 threadId)。
        thread_id: String,
        /// 运行 id(会话内唯一)。
        run_id: String,
    },
    /// 一次运行结束。
    RunFinished {
        thread_id: String,
        run_id: String,
        /// 结束原因(成功 / 被拦 / 出错 / 超步数)。
        result: Option<String>,
    },
    /// 运行出错。
    RunError {
        thread_id: String,
        run_id: String,
        message: String,
    },
    /// 一步开始(工具往返的一小步)。
    StepStarted {
        thread_id: String,
        run_id: String,
        /// 步骤名(如 "turn1-step2")。
        step_name: String,
    },
    /// 一步结束。
    StepFinished {
        thread_id: String,
        run_id: String,
        step_name: String,
    },
    /// 文本消息开始。
    TextMessageStart {
        /// 消息 id(一个 step 一段文本)。
        message_id: String,
        /// 角色(恒为 assistant, 循环只流模型输出)。
        role: String,
    },
    /// 文本增量。
    TextMessageContent { message_id: String, delta: String },
    /// 文本消息结束。
    TextMessageEnd { message_id: String },
    /// 模型点名调用工具。
    ToolCallStart {
        tool_call_id: String,
        tool_call_name: String,
    },
    /// 工具参数增量(JSON 片段)。
    ToolCallArgs { tool_call_id: String, delta: String },
    /// 工具参数收齐。
    ToolCallEnd { tool_call_id: String },
    /// 工具执行结果(循环执行完之后的终值)。
    ToolCallResult {
        tool_call_id: String,
        content: String,
    },
}
