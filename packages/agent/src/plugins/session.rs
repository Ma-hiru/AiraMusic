use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
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

/// 会话日志的一次变更(持久化等插件订阅这个通知)。
#[derive(Clone)]
pub enum SessionChange {
    /// 播种: 会话被 seed(初始历史落定)。
    Seeded { messages: Vec<ChatMessage> },
    /// 追加: 一条消息落日志。
    Appended { message: ChatMessage },
}

/// 变更监听者(订阅方, 如持久化插件)。
pub type SessionListener = Arc<dyn Fn(&SessionId, &SessionChange) + Send + Sync>;

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
