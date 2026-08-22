use crate::llm::models::ChatMessage;
use crate::utils::generate_id;
use serde::{Deserialize, Serialize};
use std::fmt::Display;

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

#[derive(Clone)]
pub enum SessionEvent {
    Create {
        session_id: SessionId,
    },
    Append {
        session_id: SessionId,
        message: ChatMessage,
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
