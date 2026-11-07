use crate::llm::models::{ChatMessage, ChatUsage};
use crate::utils::generate_id;
use serde::{Deserialize, Serialize};
use std::fmt::Display;
use std::time::{SystemTime, UNIX_EPOCH};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SessionId(String);

impl SessionId {
    pub fn new() -> Self {
        generate_id("s").into()
    }
}

impl Display for SessionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl AsRef<str> for SessionId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl From<&str> for SessionId {
    fn from(value: &str) -> Self {
        Self(value.to_string())
    }
}

impl From<String> for SessionId {
    fn from(value: String) -> Self {
        Self(value)
    }
}

impl From<SessionId> for String {
    fn from(value: SessionId) -> Self {
        value.0
    }
}

impl Default for SessionId {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ThreadMetadata {
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auxiliary_usage: Option<ThreadAuxiliaryUsage>,
}

impl ThreadMetadata {
    pub fn title_from_input(input: &str) -> String {
        input
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(32)
            .collect()
    }

    pub fn new(name: impl Into<String>) -> Self {
        let now = current_timestamp_millis();
        Self {
            name: name.into(),
            created_at: now,
            updated_at: now,
            auxiliary_usage: None,
        }
    }

    pub fn touch(&mut self) {
        self.updated_at = current_timestamp_millis().max(self.updated_at.saturating_add(1));
    }
}

#[derive(Clone, Copy)]
pub enum AuxiliaryUsagePurpose {
    Title,
    Compaction,
}

pub const SESSION_USAGE_UPDATED: &str = "session:usage-updated";

#[derive(Clone)]
pub struct SessionUsageUpdated {
    pub session_id: SessionId,
    pub run_id: String,
    pub metadata: ThreadMetadata,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ThreadAuxiliaryUsage {
    pub title: RequestUsageTotals,
    pub compaction: RequestUsageTotals,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RequestUsageTotals {
    pub requests: u32,
    pub reported_requests: u32,
    pub prompt_tokens: u64,
    pub completion_tokens: u64,
}

impl RequestUsageTotals {
    pub(super) fn report(&mut self, previous: Option<&ChatUsage>, usage: &ChatUsage) {
        if let Some(previous) = previous {
            self.prompt_tokens = self
                .prompt_tokens
                .saturating_sub(u64::from(previous.prompt_tokens));
            self.completion_tokens = self
                .completion_tokens
                .saturating_sub(u64::from(previous.completion_tokens));
        } else {
            self.reported_requests = self.reported_requests.saturating_add(1);
        }
        self.prompt_tokens = self
            .prompt_tokens
            .saturating_add(u64::from(usage.prompt_tokens));
        self.completion_tokens = self
            .completion_tokens
            .saturating_add(u64::from(usage.completion_tokens));
    }
}

fn current_timestamp_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or_default()
}

#[derive(Clone)]
pub enum SessionEvent {
    Create {
        session_id: SessionId,
        metadata: ThreadMetadata,
    },
    Delete {
        session_id: SessionId,
    },
    Append {
        session_id: SessionId,
        message: ChatMessage,
        inner: bool,
        metadata: ThreadMetadata,
    },
    Metadata {
        session_id: SessionId,
        metadata: ThreadMetadata,
    },
    AppendMemory {
        id: String,
        content: String,
    },
    DeleteMemory {
        id: String,
    },
    Compaction {
        session_id: SessionId,
        messages: Vec<ChatMessage>,
    },
}
