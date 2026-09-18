use crate::llm::models::ChatMessage;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ContextPolicy {
    pub recent_token_budget: usize,
    pub summary_output_tokens: usize,
    pub tool_output_tokens: usize,
    pub stale_tool_output_tokens: usize,
    pub safety_buffer: usize,
    pub trigger_ratio: f64,
    pub max_summary_passes: usize,
}

impl Default for ContextPolicy {
    fn default() -> Self {
        Self {
            recent_token_budget: 16_000,
            summary_output_tokens: 4_096,
            tool_output_tokens: 4_096,
            stale_tool_output_tokens: 1_024,
            safety_buffer: 8_192,
            trigger_ratio: 0.85,
            max_summary_passes: 16,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Checkpoint {
    /// Inclusive, one-based position in the append-only raw log, including Inner records.
    pub through_seq: u64,
    pub summary: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SessionContext {
    pub version: u32,
    pub messages: Vec<ChatMessage>,
    pub checkpoint: Option<Checkpoint>,
}

impl SessionContext {
    pub fn new(messages: Vec<ChatMessage>, checkpoint: Option<Checkpoint>) -> Self {
        Self {
            version: 1,
            messages,
            checkpoint,
        }
    }

    pub fn validate(&self) -> anyhow::Result<()> {
        anyhow::ensure!(
            self.version == 1,
            "不支持的上下文存储版本: {}",
            self.version
        );
        if let Some(checkpoint) = &self.checkpoint {
            anyhow::ensure!(
                checkpoint.through_seq > 0 && checkpoint.through_seq <= self.messages.len() as u64,
                "检查点覆盖范围超出原始历史"
            );
            anyhow::ensure!(!checkpoint.summary.trim().is_empty(), "检查点摘要为空");
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize)]
pub(crate) struct HistoryMessage {
    pub seq: u64,
    pub message: ChatMessage,
}
