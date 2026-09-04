pub mod agui;
pub mod constants;
pub mod ctx;
pub mod llm;
pub mod r#loop;
pub mod mcp;
pub mod plugins;
pub mod prompt;
pub mod server;
pub mod session;
pub mod store;
pub mod tools;
pub mod utils;

use agui::AguiPlugin;
use ctx::Ctx;
use ctx::boot::boot;
use llm::persistence::LLMConfigPersistencePlugin;
use llm::plugins::{LLMCompactorConfig, LLMCompactorPlugin, LLMConfigPlugin, LLMPlugin};
use r#loop::{LoopConfig, LoopPlugin};
use mcp::MCPPlugin;
use plugins::max_turns::{MaxTurnsConfig, MaxTurnsPlugin};
use plugins::models::{Plugin, PluginMeta};
use plugins::persona::PersonaPlugin;
use prompt::PromptPlugin;
use session::SessionPlugin;
use session::persistence::SessionPersistencePlugin;
use std::sync::Arc;
use store::{StoreConfig, StorePlugin};
use tools::ToolsPlugin;
use tools::inner::InnerToolsPlugin;

pub struct AgentConfig {
    pub store_config: StoreConfig,
    pub llm_compactor_config: LLMCompactorConfig,
    pub max_turns_config: MaxTurnsConfig,
    pub loop_config: LoopConfig,
}

pub async fn build_agent(config: AgentConfig) -> anyhow::Result<Arc<Ctx>> {
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
            LoopPlugin.boot(&ctx, config.loop_config)?,
        ],
    )?;
    let store_manager = StorePlugin::get_service(&ctx)?;
    let session_manager = SessionPlugin::get_service(&ctx)?;
    let config_manager = LLMConfigPlugin::get_service(&ctx)?;
    SessionPersistencePlugin::restore(&session_manager, &store_manager).await?;
    LLMConfigPersistencePlugin::restore(&config_manager, &store_manager).await?;
    Ok(ctx)
}
