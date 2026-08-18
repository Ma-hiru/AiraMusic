use crate::ctx::models::Disposer;
use crate::ctx::Ctx;
use crate::plugins::models::Plugin;
use crate::shared::message::ChatMessage;
use anyhow::Context;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fmt;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SessionId(String);

impl SessionId {
    pub fn new() -> Self {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let count = COUNTER.fetch_add(1, Ordering::Relaxed);

        let millis = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);

        Self(format!("s-{millis:x}-{count}"))
    }
}

impl fmt::Display for SessionId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
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
pub struct SessionManager {
    // 可以克隆共享句柄; 每个会话一条日志, 互不干扰
    sessions: Arc<Mutex<HashMap<SessionId, Vec<ChatMessage>>>>,
}
impl SessionManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn create_session(&self) -> SessionId {
        let id = SessionId::new();
        self.sessions.lock().unwrap().insert(id.clone(), Vec::new());
        id
    }

    pub fn has(&self, id: &SessionId) -> bool {
        self.sessions.lock().unwrap().contains_key(id)
    }

    pub fn seed(&self, id: &SessionId, messages: Vec<ChatMessage>) -> anyhow::Result<()> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|e| anyhow::anyhow!("[SessionManager.seed] lock sessions 失败: {}", e))?;

        match sessions.get_mut(id) {
            None => {
                self.sessions
                    .lock()
                    .map_err(|e| {
                        anyhow::anyhow!("[SessionManager.seed] lock sessions 失败: {}", e)
                    })?
                    .insert(id.clone(), messages);
            }
            Some(session) => {
                if !session.is_empty() {
                    anyhow::bail!(
                        "[SessionManager.seed] 会话 {id} 已有内容: seed 只允许在会话开始时调用一次"
                    );
                }
                session.extend(messages);
            }
        }

        Ok(())
    }

    pub fn append(&self, id: &SessionId, message: ChatMessage) -> anyhow::Result<()> {
        Ok(self
            .sessions
            .lock()
            .map_err(|e| anyhow::anyhow!("[SessionManager.append] lock sessions 失败: {}", e))?
            .get_mut(id)
            .context("[SessionManager.append] 会话 {id} 不存在")?
            .push(message))
    }

    pub fn messages(&self, id: &SessionId) -> Vec<ChatMessage> {
        self.sessions
            .lock()
            .unwrap()
            .get(id)
            .cloned()
            .unwrap_or_default()
    }

    pub fn session_ids(&self) -> Vec<SessionId> {
        self.sessions.lock().unwrap().keys().cloned().collect()
    }
}
impl Default for SessionManager {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

pub struct SessionPlugin;
impl SessionPlugin {
    pub fn name() -> &'static str {
        "session"
    }

    pub fn service_name() -> &'static str {
        "session_manager"
    }

    fn register_service(ctx: &Arc<Ctx>) -> anyhow::Result<Disposer> {
        ctx.provide(Self::service_name(), SessionManager::new())
    }

    pub fn get_service(ctx: &Arc<Ctx>) -> anyhow::Result<Arc<SessionManager>> {
        ctx.get::<SessionManager>(Self::service_name())
    }
}
impl Plugin for SessionPlugin {
    fn name(&self) -> &'static str {
        Self::name()
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: Value) -> anyhow::Result<Option<Disposer>> {
        Ok(Some(Self::register_service(ctx)?))
    }
}
