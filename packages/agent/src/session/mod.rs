pub mod models;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::llm::models::ChatMessage;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use anyhow::Context;
use models::*;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct SessionPlugin;
impl PluginMeta<SessionManager> for SessionPlugin {
    fn name() -> &'static str {
        "session"
    }

    fn service_name() -> &'static str {
        "session-manager"
    }
}
impl Plugin<(), SessionManager> for SessionPlugin {
    fn apply(
        &self,
        _ctx: &Arc<Ctx>,
        _config: (),
    ) -> anyhow::Result<PluginApplyResult<SessionManager>> {
        Ok(PluginApplyResult {
            service: Some(SessionManager::new()),
            emit_disposers: None,
        })
    }
}

#[derive(Clone)]
pub struct SessionManager {
    // 可以克隆共享句柄; 每个会话一条日志, 互不干扰
    sessions: Arc<Mutex<HashMap<SessionId, Vec<ChatMessage>>>>,
    // 变更监听者列表(订阅即收据可撤)
    listeners: Arc<Mutex<Vec<SessionListener>>>,
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

    /// 恢复一个历史会话(持久化插件启动时用)。
    pub fn restore_session(&self, id: SessionId, messages: Vec<ChatMessage>) -> anyhow::Result<()> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|e| anyhow::anyhow!("[SessionManager.restore] lock sessions 失败: {}", e))?;
        if sessions.contains_key(&id) {
            anyhow::bail!("[SessionManager.restore] 会话 {id} 已存在, 无法恢复");
        }
        sessions.insert(id, messages);
        Ok(())
    }

    /// 订阅会话变更(返回收据)。
    pub fn subscribe(
        &self,
        listener: impl Fn(&SessionId, &SessionChange) + Send + Sync + 'static,
    ) -> Disposer {
        let entry: SessionListener = Arc::new(listener);
        self.listeners.lock().unwrap().push(Arc::clone(&entry));
        let listeners = Arc::clone(&self.listeners);
        Box::new(move || {
            listeners
                .lock()
                .unwrap()
                .retain(|e| !Arc::ptr_eq(e, &entry));
        })
    }

    /// 通知所有订阅者(先复制列表再喊, 避免回调里再碰锁死锁)。
    fn notify(&self, id: &SessionId, change: &SessionChange) {
        let snapshot: Vec<SessionListener> = self.listeners.lock().unwrap().clone();
        for listener in &snapshot {
            listener(id, change);
        }
    }

    pub fn seed(&self, id: &SessionId, messages: Vec<ChatMessage>) -> anyhow::Result<()> {
        // 写日志(锁作用域 = 这个花括号, 出块即放锁)
        {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|e| anyhow::anyhow!("[SessionManager.seed] lock sessions 失败: {}", e))?;

            match sessions.get_mut(id) {
                None => {
                    sessions.insert(id.clone(), messages);
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
        }
        // 通知订阅者(锁已放, 回调里随便干什么)
        let messages = self.messages(id);
        self.notify(id, &SessionChange::Seeded { messages });
        Ok(())
    }

    pub fn append(&self, id: &SessionId, message: ChatMessage) -> anyhow::Result<()> {
        {
            self.sessions
                .lock()
                .map_err(|e| anyhow::anyhow!("[SessionManager.append] lock sessions 失败: {}", e))?
                .get_mut(id)
                .context("[SessionManager.append] 会话 {id} 不存在")?
                .push(message.clone());
        }
        self.notify(id, &SessionChange::Appended { message });
        Ok(())
    }

    pub fn messages(&self, id: &SessionId) -> Vec<ChatMessage> {
        self.sessions
            .lock()
            .unwrap()
            .get(id)
            .cloned()
            .unwrap_or_default()
    }

    /// 按关键词搜索会话历史(history_search 工具用)。
    /// 只读: 不写会话日志, 不触碰"唯一写点"纪律。
    pub fn search(&self, id: &SessionId, keyword: &str) -> Vec<ChatMessage> {
        self.sessions
            .lock()
            .unwrap()
            .get(id)
            .map(|log| {
                log.iter()
                    .filter(|m| m.content.contains(keyword))
                    .cloned()
                    .collect()
            })
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
            listeners: Arc::new(Mutex::new(Vec::new())),
        }
    }
}
