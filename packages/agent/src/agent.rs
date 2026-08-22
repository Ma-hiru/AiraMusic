use crate::agui::AguiPlugin;
use crate::agui::stdout::AguiStdoutPlugin;
use crate::ctx::Ctx;
use crate::ctx::boot::boot;
use crate::llm::persistence::LLMConfigPersistencePlugin;
use crate::llm::plugins::{LLMCompactorConfig, LLMCompactorPlugin, LLMConfigPlugin, LLMPlugin};
use crate::r#loop::{LoopConfig, LoopPlugin};
use crate::mcp::MCPPlugin;
use crate::plugins::max_turns::{MaxTurnsConfig, MaxTurnsPlugin};
use crate::plugins::models::Plugin;
use crate::plugins::persona::PersonaPlugin;
use crate::prompt::PromptPlugin;
use crate::session::SessionPlugin;
use crate::session::persistence::SessionPersistencePlugin;
use crate::store::{StoreConfig, StorePlugin};
use crate::tools::ToolsPlugin;
use crate::tools::inner::InnerToolsPlugin;
use std::sync::Arc;

pub struct AgentConfig {
    pub store_config: StoreConfig,
    pub llm_compactor_config: LLMCompactorConfig,
    pub max_turns_config: MaxTurnsConfig,
    pub loop_config: LoopConfig,
}

pub async fn build_agent(config: AgentConfig) -> anyhow::Result<Arc<Ctx>> {
    tracing::info!("agent booting...");
    let ctx = Arc::new(Ctx::new());
    boot(
        &ctx,
        vec![
            StorePlugin.boot(&ctx, config.store_config)?,
            SessionPlugin.boot(&ctx, ())?,
            SessionPersistencePlugin.boot(&ctx, ())?,
            ToolsPlugin.boot(&ctx, ())?,
            PromptPlugin.boot(&ctx, ())?,
            PersonaPlugin.boot(&ctx, ())?,
            LLMPlugin.boot(&ctx, ())?,
            LLMConfigPlugin.boot(&ctx, ())?,
            LLMConfigPersistencePlugin.boot(&ctx, ())?,
            LLMCompactorPlugin.boot(&ctx, config.llm_compactor_config)?,
            MCPPlugin.boot(&ctx, ())?,
            InnerToolsPlugin.boot(&ctx, ())?,
            MaxTurnsPlugin.boot(&ctx, config.max_turns_config)?,
            AguiPlugin.boot(&ctx, ())?,
            AguiStdoutPlugin.boot(&ctx, ())?,
            LoopPlugin.boot(&ctx, config.loop_config)?,
        ],
    )?;
    tracing::info!("agent booted");
    Ok(ctx)
}
