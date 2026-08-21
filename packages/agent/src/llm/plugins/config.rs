use crate::ctx::Ctx;
use crate::llm::models::{LLMConfig, LLMProvider};
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::session::models::SessionId;
use std::sync::Arc;

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
pub struct LLMConfigManager {}
impl LLMConfigManager {
    pub fn new() -> Self {
        Self {}
    }

    pub fn current_config(&self, _session_id: &SessionId) -> LLMConfig {
        LLMConfig {
            provider: LLMProvider::OpenAI,
            base_url: std::env::var("OPENAI_BASE_URL").ok(),
            api_key: std::env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY not found"),
            model: std::env::var("OPENAI_MODEL").expect("OPENAI_MODEL not found"),
            context_size: None,
            other: None,
            headers: None,
        }
    }

    pub fn list_configs(&self) -> Vec<LLMConfig> {
        vec![]
    }
}
