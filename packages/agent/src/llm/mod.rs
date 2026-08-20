pub mod compactor;
pub mod models;
pub mod openai;

use crate::ctx::models::Disposer;
use crate::ctx::Ctx;
use crate::llm::models::{LLMProvider, LLMAdapter};
use crate::llm::openai::OpenAiAdapter;
use crate::plugins::models::Plugin;
use serde_json::Value;
use std::sync::Arc;

pub struct LLMPlugin;
impl LLMPlugin {
    pub fn name() -> &'static str {
        "llm-openai"
    }

    pub fn service_name(provider: LLMProvider) -> &'static str {
        match provider {
            LLMProvider::OpenAI => "llm:openai",
        }
    }

    fn register_service(ctx: &Arc<Ctx>) -> anyhow::Result<Disposer> {
        let mut disposers = Vec::new();

        for provider in LLMProvider::iter() {
            let name = Self::service_name(provider);
            match provider {
                LLMProvider::OpenAI => {
                    disposers.push(ctx.provide(name, OpenAiAdapter)?);
                }
            }
        }

        Ok(Box::new(move || {
            for disposer in disposers {
                disposer()
            }
        }))
    }

    pub fn get_service(
        ctx: &Arc<Ctx>,
        provider: LLMProvider,
    ) -> anyhow::Result<Arc<dyn LLMAdapter>> {
        ctx.get::<dyn LLMAdapter>(Self::service_name(provider))
    }
}
impl Plugin for LLMPlugin {
    fn name(&self) -> &'static str {
        Self::name()
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: Value) -> anyhow::Result<Option<Disposer>> {
        Ok(Some(Self::register_service(ctx)?))
    }
}
