use crate::llm::models::ChatMessage;
use crate::utils::generate_id;
use serde::{Deserialize, Serialize};
use std::fmt::Display;
use std::time::{SystemTime, UNIX_EPOCH};

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

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadMetadata {
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

impl ThreadMetadata {
    pub fn new(name: impl Into<String>) -> Self {
        let now = current_timestamp_millis();
        Self {
            name: name.into(),
            created_at: now,
            updated_at: now,
        }
    }

    pub fn touch(&mut self) {
        self.updated_at = current_timestamp_millis().max(self.updated_at);
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
