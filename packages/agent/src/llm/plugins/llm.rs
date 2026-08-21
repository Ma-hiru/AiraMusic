use crate::ctx::Ctx;
use crate::llm::{
    adapter::openai::OpenAiAdapter,
    models::{LLMAdapter, LLMProvider},
};
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct LLMPlugin;
impl PluginMeta<LLMAdapterManager> for LLMPlugin {
    fn name() -> &'static str {
        "llm"
    }
    fn service_name() -> &'static str {
        "llm-adapter-manager"
    }
}
impl Plugin<(), LLMAdapterManager> for LLMPlugin {
    fn apply(
        &self,
        _ctx: &Arc<Ctx>,
        _config: (),
    ) -> anyhow::Result<PluginApplyResult<LLMAdapterManager>> {
        Ok(PluginApplyResult {
            service: Some(LLMAdapterManager::new()),
            emit_disposers: None,
        })
    }
}

pub struct LLMAdapterManager {
    pub providers: Arc<Mutex<HashMap<LLMProvider, Arc<dyn LLMAdapter>>>>,
}
impl Default for LLMAdapterManager {
    fn default() -> Self {
        Self::new()
    }
}

impl LLMAdapterManager {
    pub fn new() -> Self {
        let mut providers: HashMap<LLMProvider, Arc<dyn LLMAdapter>> = HashMap::new();

        for provider in LLMProvider::iter() {
            match provider {
                LLMProvider::OpenAI => {
                    providers.insert(provider, Arc::new(OpenAiAdapter));
                }
            }
        }

        Self {
            providers: Arc::new(Mutex::new(providers)),
        }
    }

    pub fn get_provider(&self, provider: &LLMProvider) -> Option<Arc<dyn LLMAdapter>> {
        self.providers.lock().unwrap().get(&provider).cloned()
    }
}
