use crate::cancel::Signal;
use crate::ctx::Ctx;
use crate::ctx::models::{Disposer, DisposerLike};
use crate::llm::models::{LLMConfig, LLMConfigEvent};
use crate::llm::plugins::config::LLMConfigManager;
use crate::llm::plugins::config::LLMConfigPlugin;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::session::models::SessionId;
use crate::store::local::LocalStore;
use crate::store::models::Store;
use crate::store::{StoreManager, StorePlugin};
use anyhow::Result;
use serde::Serialize;
use serde::de::DeserializeOwned;
use std::ffi::OsString;
use std::sync::Arc;
use tokio::sync::broadcast::error::RecvError;

const GLOBAL_STORE: &str = "llm-configs";
const KEY_ITEMS: &str = "items";
const KEY_SESSION_CONFIG: &str = "llm";

pub struct LLMConfigPersistencePlugin;
impl PluginMeta<()> for LLMConfigPersistencePlugin {
    fn name() -> &'static str {
        "llm-config-persistence"
    }
}
impl Plugin<(), ()> for LLMConfigPersistencePlugin {
    fn inject(&self) -> Vec<&'static str> {
        vec![LLMConfigPlugin::service_name(), StorePlugin::service_name()]
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: ()) -> Result<PluginApplyResult<()>> {
        let config_manager = LLMConfigPlugin::get_service(ctx)?;
        let store_manager = StorePlugin::get_service(ctx)?;
        let mut rx = config_manager.subscribe();

        let cancel_signal = Signal::new();
        let task_signal = cancel_signal.clone();

        tokio::spawn(async move {
            if let Err(error) = Self::restore(&config_manager, &store_manager).await {
                tracing::error!(error = %error, "llm 配置恢复失败");
            }
            // 恢复完立刻放掉 ConfigManager(broadcast Sender)
            // 不然recv() 永远不会 Closed(自己永远持有一个 Sender)
            drop(config_manager);
            loop {
                tokio::select! {
                    biased;
                    _ = task_signal.cancelled() => break,
                    event = rx.recv() => match event {
                        Ok(event) => {
                            if let Err(error) = Self::persist(&store_manager, &event).await {
                                tracing::error!(error = %error, "llm 配置落盘失败");
                            }
                        }
                        Err(RecvError::Lagged(skipped)) => {
                            tracing::warn!(skipped, "llm 配置事件积压, 丢弃 {skipped} 条");
                        }
                        Err(RecvError::Closed) => break,
                    },
                }
            }
            // 处理广播里已积压的事件
            while let Ok(event) = rx.try_recv() {
                if let Err(error) = Self::persist(&store_manager, &event).await {
                    tracing::error!(error = %error, "llm 配置落盘失败");
                }
            }
        });

        let disposer: Disposer = Box::new(move || cancel_signal.cancel());
        Ok(PluginApplyResult {
            service: None,
            emit_disposers: disposer.to_option_disposers(),
        })
    }
}

impl LLMConfigPersistencePlugin {
    async fn restore(
        config_manager: &LLMConfigManager,
        store_manager: &StoreManager,
    ) -> Result<()> {
        let mut restored = 0usize;
        for store in store_manager.stores().await? {
            let name = store.name();
            if name == GLOBAL_STORE {
                // 全局配置: 静默恢复(不发事件, 避免启动即回写)
                for config in Self::read_vec::<LLMConfig>(&store, KEY_ITEMS).await? {
                    config_manager.restore_global_config(config);
                    restored += 1;
                }
                continue;
            }
            // 会话目录: 有 llm 键就恢复该会话的配置绑定
            if let Some(raw) = store.get(KEY_SESSION_CONFIG).await? {
                let config: LLMConfig = serde_json::from_str(&raw)?;
                config_manager.restore_session_config(&SessionId::from(name), config);
                restored += 1;
            }
        }
        tracing::info!(restored, "llm 配置恢复完成");
        Ok(())
    }

    /// 一条配置事件 → 一次 store 写入
    async fn persist(store_manager: &StoreManager, event: &LLMConfigEvent) -> Result<()> {
        match event {
            LLMConfigEvent::AddGlobal { config } => {
                // 追加 = 读-改-写(单任务串行, 无并发竞争)
                let store = store_manager
                    .get_or_create(&OsString::from(GLOBAL_STORE))
                    .await?;
                let mut configs = Self::read_vec::<LLMConfig>(&store, KEY_ITEMS).await?;
                configs.push(config.clone());
                Self::write_vec(&store, KEY_ITEMS, &configs).await
            }
            LLMConfigEvent::RemoveGlobal { id } => {
                let store = store_manager
                    .get_or_create(&OsString::from(GLOBAL_STORE))
                    .await?;
                let mut configs = Self::read_vec::<LLMConfig>(&store, KEY_ITEMS).await?;
                configs.retain(|c| c.id != *id);
                Self::write_vec(&store, KEY_ITEMS, &configs).await
            }
            LLMConfigEvent::SetSession { session_id, config } => {
                // 每会话一份配置: 整文件重写单个 JSON 对象
                let store = store_manager
                    .get_or_create(&OsString::from(session_id.as_ref()))
                    .await?;
                let raw = serde_json::to_string(config)?;
                if !store.set(KEY_SESSION_CONFIG, raw).await? {
                    anyhow::bail!("写入会话 llm 配置失败");
                }
                Ok(())
            }
        }
    }

    async fn read_vec<T: DeserializeOwned>(store: &Arc<LocalStore>, key: &str) -> Result<Vec<T>> {
        let Some(raw) = store.get(key).await? else {
            return Ok(Vec::new());
        };
        Ok(serde_json::from_str(&raw)?)
    }

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
}
