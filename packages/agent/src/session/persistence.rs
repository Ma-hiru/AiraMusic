use crate::ctx::Ctx;
use crate::ctx::models::{Disposer, DisposerLike};
use crate::llm::models::{ChatMemory, ChatMessage};
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::session::models::{SessionEvent, ThreadMetadata};
use crate::session::{SessionId, SessionManager, SessionPlugin};
use crate::store::local::LocalStore;
use crate::store::models::Store;
use crate::store::{StoreManager, StorePlugin};
use crate::utils::Signal;
use anyhow::Result;
use serde::Serialize;
use serde::de::DeserializeOwned;
use std::ffi::OsString;
use std::sync::Arc;
use tokio::sync::broadcast::error::RecvError;

const MEMORY_STORE: &str = "memories";
const KEY_REAL: &str = "real";
const KEY_COMPACTION: &str = "compaction";
const KEY_METADATA: &str = "metadata";
const KEY_MEMORY: &str = "items";

pub struct SessionPersistencePlugin;
impl PluginMeta<()> for SessionPersistencePlugin {
    fn name() -> &'static str {
        "session-persistence"
    }
}
impl Plugin<(), ()> for SessionPersistencePlugin {
    fn inject(&self) -> Vec<&'static str> {
        vec![SessionPlugin::service_name(), StorePlugin::service_name()]
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: ()) -> Result<PluginApplyResult<()>> {
        let session_manager = SessionPlugin::get_service(ctx)?;
        let store_manager = StorePlugin::get_service(ctx)?;
        let mut rx = session_manager.subscribe();

        // 退出由取消信号驱动: disposer 挂到 ctx, ctx.dispose() 时触发
        let cancel_signal = Signal::new(Some("session-persistence-apply"));
        let task_signal = cancel_signal.clone();
        drop(session_manager);
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    biased;
                    _ = task_signal.wait_aborted() => break,
                    event = rx.recv() => match event {
                        Ok(event) => {
                            if let Err(error) = Self::persist(&store_manager, &event).await {
                                tracing::error!(error = %error, "会话落盘失败");
                            }
                        }
                        Err(RecvError::Lagged(skipped)) => {
                            // 丢事件: 磁盘将缺中间片段, 后续 Append 仍正常追加(目前无整写兜底)
                            tracing::warn!(skipped, "会话事件积压, 丢弃 {skipped} 条");
                        }
                        Err(RecvError::Closed) => break,
                    },
                }
            }
            // 处理广播里已积压的事件
            while let Ok(event) = rx.try_recv() {
                if let Err(error) = Self::persist(&store_manager, &event).await {
                    tracing::error!(error = %error, "会话落盘失败");
                }
            }
        });

        let disposer: Disposer = Box::new(move || cancel_signal.abort());
        Ok(PluginApplyResult {
            service: None,
            emit_disposers: disposer.to_option_disposers(),
        })
    }
}
impl SessionPersistencePlugin {
    pub(crate) async fn restore(
        session_manager: &SessionManager,
        store_manager: &StoreManager,
    ) -> Result<()> {
        let mut restored = 0usize;
        for store in store_manager.stores().await? {
            let name = store.name();
            if name == MEMORY_STORE {
                let memories = Self::read_vec::<ChatMemory>(&store, KEY_MEMORY).await?;
                session_manager.restore_memories(memories)?;
                continue;
            }
            let session_id = SessionId::from(name);
            if session_manager.has(&session_id) {
                tracing::warn!(session = %session_id, "恢复会话已存在于内存, 跳过");
                continue;
            }
            let real = Self::read_vec::<ChatMessage>(&store, KEY_REAL).await?;
            let compaction = Self::read_vec::<ChatMessage>(&store, KEY_COMPACTION).await?;
            let metadata = Self::read::<ThreadMetadata>(&store, KEY_METADATA)
                .await?
                .unwrap_or_else(|| ThreadMetadata::new(""));
            session_manager
                .restore_session_with_metadata(session_id, real, compaction, metadata)?;
            restored += 1;
        }

        tracing::info!(restored, "会话恢复完成");
        Ok(())
    }

    async fn persist(store_manager: &StoreManager, event: &SessionEvent) -> Result<()> {
        match event {
            SessionEvent::Create {
                session_id,
                metadata,
            } => {
                let store = Self::session_store(store_manager, session_id).await?;
                Self::write(&store, KEY_METADATA, metadata).await
            }
            SessionEvent::Delete { session_id } => {
                store_manager
                    .remove(&Self::session_store_key(session_id))
                    .await?;
                Ok(())
            }
            SessionEvent::Append {
                session_id,
                message,
                inner,
                metadata,
            } => {
                let store = Self::session_store(store_manager, session_id).await?;
                Self::append_to::<ChatMessage>(&store, KEY_REAL, message).await?;
                // 非内部消息才写入压缩历史
                if !(*inner) {
                    Self::append_to::<ChatMessage>(&store, KEY_COMPACTION, message).await?;
                }
                Self::write(&store, KEY_METADATA, metadata).await
            }
            SessionEvent::Metadata {
                session_id,
                metadata,
            } => {
                let store = Self::session_store(store_manager, session_id).await?;
                Self::write(&store, KEY_METADATA, metadata).await
            }
            SessionEvent::AppendMemory { id, content } => {
                let store = store_manager
                    .get_or_create(&OsString::from(MEMORY_STORE))
                    .await?;
                let mut memories = Self::read_vec::<ChatMemory>(&store, KEY_MEMORY).await?;
                memories.push(ChatMemory {
                    id: id.clone(),
                    content: content.clone(),
                });
                Self::write_vec(&store, KEY_MEMORY, &memories).await
            }
            SessionEvent::DeleteMemory { id } => {
                let Some(store) = store_manager.get(&OsString::from(MEMORY_STORE)).await? else {
                    return Ok(());
                };
                let mut memories = Self::read_vec::<ChatMemory>(&store, KEY_MEMORY).await?;
                memories.retain(|m| m.id != *id);
                Self::write_vec(&store, KEY_MEMORY, &memories).await
            }
            SessionEvent::Compaction {
                session_id,
                messages,
            } => {
                // 压缩更新 = 整文件重写压缩历史
                let store = Self::session_store(store_manager, session_id).await?;
                Self::write_vec(&store, KEY_COMPACTION, messages).await
            }
        }
    }

    /// 会话 id → store 目录 key
    fn session_store_key(id: &SessionId) -> OsString {
        OsString::from(id.to_string())
    }

    /// 取(或创建)某个会话的 store
    async fn session_store(
        store_manager: &StoreManager,
        session_id: &SessionId,
    ) -> Result<Arc<LocalStore>> {
        store_manager
            .get_or_create(&Self::session_store_key(session_id))
            .await
    }

    /// 读一个 JSON 数组文件(缺失/损坏按空处理)
    async fn read_vec<T: DeserializeOwned>(store: &Arc<LocalStore>, key: &str) -> Result<Vec<T>> {
        match store.get(key).await? {
            Some(raw) => Ok(serde_json::from_str(&raw).unwrap_or_default()),
            None => Ok(Vec::new()),
        }
    }

    /// 整文件重写一个 JSON 数组
    async fn write_vec<T: Serialize>(
        store: &Arc<LocalStore>,
        key: &str,
        items: &[T],
    ) -> Result<()> {
        let raw = serde_json::to_string(items)?;
        if !store.set(key, raw).await? {
            anyhow::bail!("写入 store 键 {key} 失败");
        }
        Ok(())
    }

    async fn read<T: DeserializeOwned>(store: &Arc<LocalStore>, key: &str) -> Result<Option<T>> {
        store
            .get(key)
            .await?
            .map(|raw| serde_json::from_str(&raw).map_err(Into::into))
            .transpose()
    }

    async fn write<T: Serialize>(store: &Arc<LocalStore>, key: &str, item: &T) -> Result<()> {
        let raw = serde_json::to_string(item)?;
        if !store.set(key, raw).await? {
            anyhow::bail!("写入 store 键 {key} 失败");
        }
        Ok(())
    }

    /// 往 JSON 数组末尾追加一条
    async fn append_to<T>(store: &Arc<LocalStore>, key: &str, item: &T) -> Result<()>
    where
        T: DeserializeOwned + Serialize + Clone,
    {
        let mut items = Self::read_vec::<T>(store, key).await?;
        items.push(item.clone());
        Self::write_vec(store, key, &items).await
    }
}
