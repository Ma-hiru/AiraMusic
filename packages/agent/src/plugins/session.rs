use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use serde_json::Value;
use std::sync::{Arc, Mutex};

use crate::shared::message::ChatMessage;

#[derive(Clone)]
pub struct SessionManager {
    // 可以克隆共享句柄
    log: Arc<Mutex<Vec<ChatMessage>>>,
}
impl SessionManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn seed(&self, messages: Vec<ChatMessage>) -> anyhow::Result<()> {
        let mut log = self.log.lock().unwrap();
        if !log.is_empty() {
            anyhow::bail!("会话日志已有内容: seed 只允许在会话开始时调用一次");
        }
        log.extend(messages);
        Ok(())
    }

    pub fn append(&self, message: ChatMessage) {
        self.log.lock().unwrap().push(message);
    }

    pub fn messages(&self) -> Vec<ChatMessage> {
        self.log.lock().unwrap().clone()
    }
}
impl Default for SessionManager {
    fn default() -> Self {
        Self {
            log: Arc::new(Mutex::new(Vec::new())),
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
