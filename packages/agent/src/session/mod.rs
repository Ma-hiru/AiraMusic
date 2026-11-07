pub mod models;
pub mod persistence;
pub mod usage;

use crate::ctx::Ctx;
use crate::llm::models::{ChatMemory, ChatMessage, ChatRole};
use crate::llm::usage::UsageTrackingEvent;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use models::*;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

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
    // 压缩历史(对话真相，请求依据)
    compaction: Arc<Mutex<HashMap<SessionId, Vec<ChatMessage>>>>,
    metadata: Arc<Mutex<HashMap<SessionId, ThreadMetadata>>>,
    // 全局记忆
    memories: Arc<Mutex<Vec<ChatMemory>>>,
    channel_sender: broadcast::Sender<SessionEvent>,
}
impl SessionManager {
    pub fn new() -> Self {
        Self::default()
    }

    fn send_event(&self, event: SessionEvent) {
        let _ = self.channel_sender.send(event);
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
        self.compaction
            .lock()
            .unwrap()
            .insert(id.clone(), Vec::new());
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
        self.compaction
            .lock()
            .map_err(|e| anyhow::anyhow!("lock compaction 失败: {}", e))?
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

    pub fn record_auxiliary_usage(
        &self,
        id: &SessionId,
        purpose: AuxiliaryUsagePurpose,
        event: &UsageTrackingEvent,
    ) -> anyhow::Result<Option<ThreadMetadata>> {
        let mut all = self
            .metadata
            .lock()
            .map_err(|e| anyhow::anyhow!("lock metadata 失败: {}", e))?;
        let Some(metadata) = all.get_mut(id) else {
            return Ok(None);
        };
        let auxiliary = metadata
            .auxiliary_usage
            .get_or_insert_with(Default::default);
        let totals = match purpose {
            AuxiliaryUsagePurpose::Title => &mut auxiliary.title,
            AuxiliaryUsagePurpose::Compaction => &mut auxiliary.compaction,
        };
        match event {
            UsageTrackingEvent::Started => totals.requests = totals.requests.saturating_add(1),
            UsageTrackingEvent::Reported { previous, usage } => {
                totals.report(previous.as_ref(), usage)
            }
        }
        metadata.touch();
        let metadata = metadata.clone();
        // 与其他元数据变更、删除保持事件顺序，迟到请求不能重建会话。
        self.send_event(SessionEvent::Metadata {
            session_id: id.clone(),
            metadata: metadata.clone(),
        });
        Ok(Some(metadata))
    }

    pub fn rename(&self, id: &SessionId, name: impl Into<String>) -> anyhow::Result<()> {
        {
            let mut all = self
                .metadata
                .lock()
                .map_err(|e| anyhow::anyhow!("lock metadata 失败: {}", e))?;
            let metadata = all
                .get_mut(id)
                .ok_or_else(|| anyhow::anyhow!("会话 {id} 不存在"))?;
            metadata.name = name.into();
            metadata.touch();
            self.send_event(SessionEvent::Metadata {
                session_id: id.clone(),
                metadata: metadata.clone(),
            });
        }
        Ok(())
    }

    pub fn has(&self, id: &SessionId) -> bool {
        self.sessions.lock().unwrap().contains_key(id)
    }

    pub fn rename_if_name(
        &self,
        id: &SessionId,
        expected: &str,
        name: String,
    ) -> anyhow::Result<Option<ThreadMetadata>> {
        let metadata = {
            let mut all = self
                .metadata
                .lock()
                .map_err(|e| anyhow::anyhow!("lock metadata 失败: {}", e))?;
            let Some(metadata) = all.get_mut(id) else {
                return Ok(None);
            };
            // 后台标题不能覆盖用户改名。
            if metadata.name != expected {
                return Ok(None);
            }
            metadata.name = name;
            metadata.touch();
            let metadata = metadata.clone();
            // 与删除保持事件顺序，避免迟到的标题事件重建磁盘会话。
            self.send_event(SessionEvent::Metadata {
                session_id: id.clone(),
                metadata: metadata.clone(),
            });
            metadata
        };
        Ok(Some(metadata))
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
        if !inner {
            self.compaction
                .lock()
                .map_err(|e| anyhow::anyhow!("lock compaction 失败: {}", e))?
                .get_mut(id)
                .ok_or_else(|| anyhow::anyhow!("会话 {id} 不存在"))?
                .push(message.clone());
        }

        {
            let mut all = self
                .metadata
                .lock()
                .map_err(|e| anyhow::anyhow!("lock metadata 失败: {}", e))?;
            let metadata = all
                .get_mut(id)
                .ok_or_else(|| anyhow::anyhow!("会话 {id} 不存在"))?;
            metadata.touch();
            self.send_event(SessionEvent::Append {
                session_id: id.clone(),
                inner,
                message,
                metadata: metadata.clone(),
            });
        }

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

    pub fn compaction_messages(&self, id: &SessionId) -> Vec<ChatMessage> {
        self.compaction
            .lock()
            .unwrap()
            .get(id)
            .cloned()
            .map(|c| {
                c.into_iter()
                    .filter(|m| m.role != ChatRole::Inner)
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn update_compaction_session(&self, id: &SessionId, messages: Vec<ChatMessage>) {
        self.compaction
            .lock()
            .unwrap()
            .insert(id.clone(), messages.clone());
        self.send_event(SessionEvent::Compaction {
            session_id: id.clone(),
            messages,
        });
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
        compaction: Vec<ChatMessage>,
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
            let mut compaction_map = self
                .compaction
                .lock()
                .map_err(|e| anyhow::anyhow!("lock compaction 失败: {}", e))?;
            if compaction_map.contains_key(&id) {
                anyhow::bail!("会话 {id} 已存在, 无法恢复");
            }
            compaction_map.insert(id.clone(), compaction);
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
            compaction: Arc::new(Mutex::new(HashMap::new())),
            metadata: Arc::new(Mutex::new(HashMap::new())),
            sessions: Arc::new(Mutex::new(HashMap::new())),
            memories: Arc::new(Mutex::new(Vec::new())),
            channel_sender: broadcast::channel::<SessionEvent>(256).0,
        }
    }
}
