use crate::ctx::Ctx;
use crate::llm::models::{LLMConfig, LLMConfigEvent, LLMConfigSecret};
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::session::models::SessionId;
use crate::utils::secret_key;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

pub struct LLMConfigPlugin;
impl PluginMeta<LLMConfigManager> for LLMConfigPlugin {
    fn name() -> &'static str {
        "llm-config"
    }

    fn service_name() -> &'static str {
        "llm-config-manager"
    }
}
impl Plugin<(), LLMConfigManager> for LLMConfigPlugin {
    fn apply(
        &self,
        _ctx: &Arc<Ctx>,
        _config: (),
    ) -> anyhow::Result<PluginApplyResult<LLMConfigManager>> {
        Ok(PluginApplyResult {
            service: Some(LLMConfigManager::new()),
            emit_disposers: None,
        })
    }
}

#[derive(Clone)]
pub struct LLMConfigManager {
    // id -> LLMConfig
    configs: Arc<Mutex<HashMap<String, LLMConfig>>>,
    // session_id -> LLMConfig
    current_config: Arc<Mutex<HashMap<SessionId, LLMConfig>>>,
    channel_sender: broadcast::Sender<LLMConfigEvent>,
}
impl Default for LLMConfigManager {
    fn default() -> Self {
        Self::new()
    }
}
impl LLMConfigManager {
    pub fn new() -> Self {
        let (channel_sender, _) = broadcast::channel(64);
        Self {
            configs: Arc::new(Mutex::new(HashMap::new())),
            current_config: Arc::new(Mutex::new(HashMap::new())),
            channel_sender,
        }
    }

    fn send_event(&self, event: LLMConfigEvent) {
        let _ = self.channel_sender.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<LLMConfigEvent> {
        self.channel_sender.subscribe()
    }

    pub fn get_default_config(&self) -> anyhow::Result<Option<LLMConfig>> {
        Ok(self
            .configs
            .lock()
            .map_err(|e| anyhow::anyhow!("lock configs 失败: {}", e))?
            .values()
            .find(|config| config.default)
            .cloned())
    }

    pub fn add_global_config(&self, config: LLMConfig) -> anyhow::Result<()> {
        self.configs
            .lock()
            .map_err(|e| anyhow::anyhow!("lock configs 失败: {}", e))?
            .insert(config.id.clone(), config.clone());
        self.send_event(LLMConfigEvent::AddGlobal { config });
        Ok(())
    }

    pub fn remove_global_config(&self, id: &str) -> anyhow::Result<()> {
        self.configs
            .lock()
            .map_err(|e| anyhow::anyhow!("lock configs 失败: {}", e))?
            .remove(id);
        self.send_event(LLMConfigEvent::RemoveGlobal { id: id.to_string() });
        Ok(())
    }

    pub fn set_session_config(
        &self,
        session_id: &SessionId,
        config: LLMConfig,
    ) -> anyhow::Result<()> {
        self.current_config
            .lock()
            .map_err(|e| anyhow::anyhow!("lock current_config 失败: {}", e))?
            .insert(session_id.clone(), config.clone());
        self.send_event(LLMConfigEvent::SetSession {
            session_id: session_id.clone(),
            config,
        });
        Ok(())
    }

    /// 静默恢复全局配置(不发事件, 避免启动即回写)
    pub fn restore_global_config(&self, config: LLMConfig) {
        self.configs
            .lock()
            .unwrap()
            .insert(config.id.clone(), config);
    }

    /// 静默恢复会话配置绑定(不发事件)
    pub fn restore_session_config(&self, session_id: &SessionId, config: LLMConfig) {
        self.current_config
            .lock()
            .unwrap()
            .insert(session_id.clone(), config);
    }

    pub fn get_session_config(&self, session_id: &SessionId) -> anyhow::Result<Option<LLMConfig>> {
        let session_config = self
            .current_config
            .lock()
            .map_err(|e| anyhow::anyhow!("lock current_config 失败: {}", e))?
            .get(session_id)
            .cloned();
        if session_config.is_some() {
            Ok(session_config)
        } else {
            tracing::info!(session_id = ?session_id, "not found, try get global config");
            Ok(self.get_default_config()?)
        }
    }

    pub fn list(&self) -> Vec<LLMConfigSecret> {
        self.configs
            .lock()
            .unwrap()
            .values()
            .cloned()
            .map(|mut config| {
                config.api_key = secret_key(config.api_key);
                config
            })
            .collect()
    }
}
