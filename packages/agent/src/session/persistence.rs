use crate::context::models::SessionContext;
use crate::ctx::Ctx;
use crate::ctx::models::{Disposer, DisposerLike};
use crate::llm::models::{ChatMemory, ChatMessage};
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::session::models::{PersistenceCommand, SessionEvent, ThreadMetadata};
use crate::session::{SessionId, SessionManager, SessionPlugin};
use crate::store::local::LocalStore;
use crate::store::models::Store;
use crate::store::{StoreManager, StorePlugin};
use crate::utils::Signal;
use anyhow::Result;
use serde::Serialize;
use serde::de::DeserializeOwned;
use std::collections::HashMap;
use std::ffi::OsString;
use std::sync::Arc;

const MEMORY_STORE: &str = "memories";
const KEY_REAL: &str = "real";
const KEY_CONTEXT: &str = "context-v1";
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
        let mut rx = session_manager.subscribe_persistence()?;

        // 退出由取消信号驱动: disposer 挂到 ctx, ctx.dispose() 时触发
        let cancel_signal = Signal::new(Some("session-persistence-apply"));
        let task_signal = cancel_signal.clone();
        tokio::spawn(async move {
            let mut failure = None;
            let mut saved = HashMap::new();
            loop {
                tokio::select! {
                    biased;
                    _ = task_signal.wait_aborted() => break,
                    event = rx.recv() => match event {
                        Some(command) => Self::process(&store_manager, &session_manager, command, &mut failure, &mut saved).await,
                        None => break,
                    },
                }
            }
            // Reliable queue: close admission and flush all accepted records and receipts.
            rx.close();
            while let Some(command) = rx.recv().await {
                Self::process(
                    &store_manager,
                    &session_manager,
                    command,
                    &mut failure,
                    &mut saved,
                )
                .await;
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
            // Legacy compaction arrays have no coverage watermark. Rebuild from raw history.
            let snapshot = match Self::read::<SessionContext>(&store, KEY_CONTEXT).await? {
                Some(snapshot) => snapshot,
                None => SessionContext::new(
                    Self::read_vec::<ChatMessage>(&store, KEY_REAL).await?,
                    None,
                ),
            };
            snapshot.validate()?;
            let metadata = Self::read::<ThreadMetadata>(&store, KEY_METADATA)
                .await?
                .unwrap_or_else(|| ThreadMetadata::new(""));
            session_manager.restore_session_with_metadata(
                session_id.clone(),
                snapshot.messages,
                Vec::new(),
                metadata,
            )?;
            if let Some(checkpoint) = snapshot.checkpoint {
                session_manager.restore_checkpoint(&session_id, checkpoint);
            }
            restored += 1;
        }

        tracing::info!(restored, "会话恢复完成");
        Ok(())
    }

    async fn process(
        store_manager: &StoreManager,
        sessions: &SessionManager,
        command: PersistenceCommand,
        failure: &mut Option<String>,
        saved: &mut HashMap<SessionId, (usize, u64)>,
    ) {
        if matches!(&command.event, SessionEvent::Flush) {
            if let Some(receipt) = command.receipt {
                let _ = receipt.send(failure.take().map_or(Ok(()), Err));
            }
            return;
        }
        if let SessionEvent::Delete { session_id } = &command.event {
            saved.remove(session_id);
        }
        let result = async {
            let session_id = match &command.event {
                SessionEvent::Create { session_id, .. }
                | SessionEvent::Append { session_id, .. }
                | SessionEvent::Compaction { session_id, .. }
                | SessionEvent::Checkpoint { session_id, .. } => Some(session_id),
                _ => None,
            };
            if let Some(session_id) = session_id {
                // Capture once when writing, not once per queued Append (which would be quadratic memory).
                let snapshot = match command.snapshot {
                    Some(snapshot) => snapshot,
                    None if sessions.has(session_id) => sessions.context_snapshot(session_id)?,
                    None => return Ok(()), // A queued Delete supersedes this write.
                };
                let revision = (
                    snapshot.messages.len(),
                    snapshot
                        .checkpoint
                        .as_ref()
                        .map_or(0, |checkpoint| checkpoint.through_seq),
                );
                if command.receipt.is_some() || saved.get(session_id) != Some(&revision) {
                    let store = Self::session_store(store_manager, session_id).await?;
                    Self::write(&store, KEY_CONTEXT, &snapshot).await?;
                    saved.insert(session_id.clone(), revision);
                }
            }
            Self::persist(store_manager, &command.event).await
        }
        .await;
        if let Err(error) = &result {
            *failure = Some(error.to_string());
            tracing::error!(error = %error, "会话落盘失败");
        }
        if let Some(receipt) = command.receipt {
            let _ = receipt.send(result.map_err(|error| error.to_string()));
        }
    }

    async fn persist(store_manager: &StoreManager, event: &SessionEvent) -> Result<()> {
        match event {
            SessionEvent::Flush => Ok(()),
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
                metadata,
                ..
            } => {
                let store = Self::session_store(store_manager, session_id).await?;
                Self::write(&store, KEY_METADATA, metadata).await
            }
            SessionEvent::Checkpoint { .. } => Ok(()),
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
            SessionEvent::Compaction { .. } => Ok(()),
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

    /// 缺失按空处理；损坏必须报告，避免随后覆盖原始历史。
    async fn read_vec<T: DeserializeOwned>(store: &Arc<LocalStore>, key: &str) -> Result<Vec<T>> {
        match store.get(key).await? {
            Some(raw) => Ok(serde_json::from_str(&raw)?),
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
}
