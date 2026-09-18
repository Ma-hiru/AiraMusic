pub mod models;
pub mod persistence;

use crate::context::models::{Checkpoint, SessionContext};
use crate::ctx::Ctx;
use crate::llm::models::{ChatMemory, ChatMessage, ChatRole};
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use models::*;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::{broadcast, mpsc, oneshot};

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
    // 真实历史(存储真相，搜索依据)
    sessions: Arc<Mutex<HashMap<SessionId, Vec<ChatMessage>>>>,
    checkpoints: Arc<Mutex<HashMap<SessionId, Checkpoint>>>,
    metadata: Arc<Mutex<HashMap<SessionId, ThreadMetadata>>>,
    // 全局记忆
    memories: Arc<Mutex<Vec<ChatMemory>>>,
    channel_sender: broadcast::Sender<SessionEvent>,
    persistence_sender: Arc<Mutex<Option<mpsc::UnboundedSender<PersistenceCommand>>>>,
}
impl SessionManager {
    pub fn new() -> Self {
        Self::default()
    }

    fn send_event(&self, event: SessionEvent) {
        if let Some(sender) = self.persistence_sender.lock().unwrap().as_ref()
            && sender
                .send(PersistenceCommand {
                    event: event.clone(),
                    snapshot: None,
                    receipt: None,
                })
                .is_err()
        {
            tracing::error!("会话持久化队列已关闭");
        }
        let _ = self.channel_sender.send(event);
    }

    pub(crate) fn subscribe_persistence(
        &self,
    ) -> anyhow::Result<mpsc::UnboundedReceiver<PersistenceCommand>> {
        let mut sender = self.persistence_sender.lock().unwrap();
        anyhow::ensure!(sender.is_none(), "会话持久化已注册");
        let (tx, rx) = mpsc::unbounded_channel();
        *sender = Some(tx);
        Ok(rx)
    }

    pub fn context_snapshot(&self, id: &SessionId) -> anyhow::Result<SessionContext> {
        let sessions = self.sessions.lock().unwrap();
        let messages = sessions
            .get(id)
            .ok_or_else(|| anyhow::anyhow!("会话 {id} 不存在"))?
            .clone();
        let checkpoint = self.checkpoints.lock().unwrap().get(id).cloned();
        Ok(SessionContext::new(messages, checkpoint))
    }

    pub(crate) fn ensure_context_revision(
        &self,
        id: &SessionId,
        expected_len: usize,
        prior: Option<&Checkpoint>,
    ) -> anyhow::Result<()> {
        let sessions = self.sessions.lock().unwrap();
        let checkpoints = self.checkpoints.lock().unwrap();
        anyhow::ensure!(
            sessions
                .get(id)
                .is_some_and(|messages| messages.len() == expected_len)
                && checkpoints.get(id) == prior,
            "会话已更新，请重新准备上下文"
        );
        Ok(())
    }

    pub async fn commit_checkpoint(
        &self,
        id: &SessionId,
        expected_len: usize,
        prior: Option<&Checkpoint>,
        checkpoint: Checkpoint,
    ) -> anyhow::Result<()> {
        let mut snapshot = self.context_snapshot(id)?;
        anyhow::ensure!(
            snapshot.messages.len() == expected_len && snapshot.checkpoint.as_ref() == prior,
            "会话已更新，请重新准备上下文"
        );
        anyhow::ensure!(
            checkpoint.through_seq > prior.map_or(0, |value| value.through_seq),
            "检查点必须向前推进"
        );
        snapshot.checkpoint = Some(checkpoint.clone());
        snapshot.validate()?;
        let event = SessionEvent::Checkpoint {
            session_id: id.clone(),
            checkpoint: checkpoint.clone(),
        };
        let receipt = {
            let sender = self.persistence_sender.lock().unwrap();
            if let Some(sender) = sender.as_ref() {
                let (tx, rx) = oneshot::channel();
                sender
                    .send(PersistenceCommand {
                        event: event.clone(),
                        snapshot: Some(snapshot),
                        receipt: Some(tx),
                    })
                    .map_err(|_| anyhow::anyhow!("会话持久化队列已关闭"))?;
                Some(rx)
            } else {
                None
            }
        };
        if let Some(receipt) = receipt {
            receipt
                .await
                .map_err(|_| anyhow::anyhow!("检查点持久化未确认"))?
                .map_err(anyhow::Error::msg)?;
        }
        // No lock spans I/O. The per-session loop is serial; guard against external edits anyway.
        let sessions = self.sessions.lock().unwrap();
        anyhow::ensure!(
            sessions
                .get(id)
                .is_some_and(|messages| messages.len() == expected_len),
            "会话在检查点提交时发生变化"
        );
        let mut checkpoints = self.checkpoints.lock().unwrap();
        anyhow::ensure!(checkpoints.get(id) == prior, "检查点已更新");
        checkpoints.insert(id.clone(), checkpoint);
        let _ = self.channel_sender.send(event);
        Ok(())
    }

    pub(crate) fn restore_checkpoint(&self, id: &SessionId, checkpoint: Checkpoint) {
        self.checkpoints
            .lock()
            .unwrap()
            .insert(id.clone(), checkpoint);
    }

    /// Waits until the persistence worker has processed all accepted writes.
    pub async fn flush(&self) -> anyhow::Result<()> {
        let receipt = {
            let sender = self.persistence_sender.lock().unwrap();
            let Some(sender) = sender.as_ref() else {
                return Ok(());
            };
            let (tx, rx) = oneshot::channel();
            sender
                .send(PersistenceCommand {
                    event: SessionEvent::Flush,
                    snapshot: None,
                    receipt: Some(tx),
                })
                .map_err(|_| anyhow::anyhow!("会话持久化队列已关闭"))?;
            rx
        };
        receipt
            .await
            .map_err(|_| anyhow::anyhow!("会话持久化未确认"))?
            .map_err(anyhow::Error::msg)
    }

    pub fn session_ids(&self) -> Vec<SessionId> {
        self.sessions.lock().unwrap().keys().cloned().collect()
    }

    pub fn subscribe(&self) -> broadcast::Receiver<SessionEvent> {
        self.channel_sender.subscribe()
    }

    pub fn create_session(&self) -> SessionId {
        self.create_session_named("")
    }

    pub fn create_session_named(&self, name: impl Into<String>) -> SessionId {
        let id = SessionId::new();
        let metadata = ThreadMetadata::new(name);

        self.sessions.lock().unwrap().insert(id.clone(), Vec::new());
        self.metadata
            .lock()
            .unwrap()
            .insert(id.clone(), metadata.clone());

        self.send_event(SessionEvent::Create {
            session_id: id.clone(),
            metadata,
        });

        id
    }

    pub fn delete_session(&self, id: &SessionId) -> anyhow::Result<bool> {
        let removed = self
            .sessions
            .lock()
            .map_err(|e| anyhow::anyhow!("lock sessions 失败: {}", e))?
            .remove(id)
            .is_some();
        if !removed {
            return Ok(false);
        }
        self.checkpoints
            .lock()
            .map_err(|e| anyhow::anyhow!("lock checkpoints 失败: {}", e))?
            .remove(id);
        self.metadata
            .lock()
            .map_err(|e| anyhow::anyhow!("lock metadata 失败: {}", e))?
            .remove(id);
        self.send_event(SessionEvent::Delete {
            session_id: id.clone(),
        });
        Ok(true)
    }

    pub fn metadata(&self, id: &SessionId) -> Option<ThreadMetadata> {
        self.metadata.lock().unwrap().get(id).cloned()
    }

    pub fn rename(&self, id: &SessionId, name: impl Into<String>) -> anyhow::Result<()> {
        let metadata = {
            let mut all = self
                .metadata
                .lock()
                .map_err(|e| anyhow::anyhow!("lock metadata 失败: {}", e))?;
            let metadata = all
                .get_mut(id)
                .ok_or_else(|| anyhow::anyhow!("会话 {id} 不存在"))?;
            metadata.name = name.into();
            metadata.touch();
            metadata.clone()
        };
        self.send_event(SessionEvent::Metadata {
            session_id: id.clone(),
            metadata,
        });
        Ok(())
    }

    pub fn has(&self, id: &SessionId) -> bool {
        self.sessions.lock().unwrap().contains_key(id)
    }

    pub fn append(&self, id: &SessionId, message: ChatMessage) -> anyhow::Result<()> {
        {
            self.sessions
                .lock()
                .map_err(|e| anyhow::anyhow!("lock sessions 失败: {}", e))?
                .get_mut(id)
                .ok_or_else(|| anyhow::anyhow!("会话 {id} 不存在"))?
                .push(message.clone());
        }

        let inner = message.role == ChatRole::Inner;

        let metadata = {
            let mut all = self
                .metadata
                .lock()
                .map_err(|e| anyhow::anyhow!("lock metadata 失败: {}", e))?;
            let metadata = all
                .get_mut(id)
                .ok_or_else(|| anyhow::anyhow!("会话 {id} 不存在"))?;
            metadata.touch();
            metadata.clone()
        };

        self.send_event(SessionEvent::Append {
            session_id: id.clone(),
            inner,
            message,
            metadata,
        });

        Ok(())
    }

    pub fn real_messages(&self, id: &SessionId) -> Vec<ChatMessage> {
        self.sessions
            .lock()
            .unwrap()
            .get(id)
            .cloned()
            .unwrap_or_default()
    }

    pub fn append_memory(&self, memory: ChatMemory) -> anyhow::Result<()> {
        self.memories
            .lock()
            .map_err(|e| anyhow::anyhow!("lock memories 失败: {}", e))?
            .push(memory.clone());

        self.send_event(SessionEvent::AppendMemory {
            content: memory.content,
            id: memory.id,
        });

        Ok(())
    }

    pub fn delete_memory(&self, id: &str) -> anyhow::Result<()> {
        self.memories
            .lock()
            .map_err(|e| anyhow::anyhow!("lock memories 失败: {}", e))?
            .retain(|m| m.id != id);

        self.send_event(SessionEvent::DeleteMemory { id: id.to_string() });

        Ok(())
    }

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

    pub fn search_memory(&self, keyword: &str) -> Vec<ChatMemory> {
        self.memories
            .lock()
            .unwrap()
            .iter()
            .filter(|m| m.content.contains(keyword))
            .cloned()
            .collect()
    }

    /// 静默插入
    pub fn restore_session(
        &self,
        id: SessionId,
        real: Vec<ChatMessage>,
        compaction: Vec<ChatMessage>,
    ) -> anyhow::Result<()> {
        self.restore_session_with_metadata(id, real, compaction, ThreadMetadata::new(""))
    }

    pub fn restore_session_with_metadata(
        &self,
        id: SessionId,
        real: Vec<ChatMessage>,
        _compaction: Vec<ChatMessage>,
        metadata: ThreadMetadata,
    ) -> anyhow::Result<()> {
        {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|e| anyhow::anyhow!("lock sessions 失败: {}", e))?;
            if sessions.contains_key(&id) {
                anyhow::bail!("会话 {id} 已存在, 无法恢复");
            }
            sessions.insert(id.clone(), real);
        }
        {
            self.metadata
                .lock()
                .map_err(|e| anyhow::anyhow!("lock metadata 失败: {}", e))?
                .insert(id, metadata);
        }
        Ok(())
    }

    // 静默插入
    pub fn restore_memories(&self, memories: Vec<ChatMemory>) -> anyhow::Result<()> {
        self.memories
            .lock()
            .map_err(|e| anyhow::anyhow!("lock memories 失败: {}", e))?
            .extend(memories);
        Ok(())
    }
}
impl Default for SessionManager {
    fn default() -> Self {
        Self {
            checkpoints: Arc::new(Mutex::new(HashMap::new())),
            persistence_sender: Arc::new(Mutex::new(None)),
            metadata: Arc::new(Mutex::new(HashMap::new())),
            sessions: Arc::new(Mutex::new(HashMap::new())),
            memories: Arc::new(Mutex::new(Vec::new())),
            channel_sender: broadcast::channel::<SessionEvent>(256).0,
        }
    }
}
