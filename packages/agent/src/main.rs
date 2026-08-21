use agent::agui::AguiPlugin;
use agent::boot::boot;
use agent::ctx::Ctx;
use agent::llm::models::ChatMessage;
use agent::llm::plugins::{LLMCompactorPlugin, LLMConfigPlugin, LLMPlugin, LlmCompactorConfig};
use agent::r#loop::{LoopConfig, LoopPlugin};
use agent::plugins::agui_stdout::AguiStdoutPlugin;
use agent::plugins::history_search::HistorySearchPlugin;
use agent::plugins::max_turns::{MaxTurnsConfig, MaxTurnsPlugin};
use agent::plugins::models::{Plugin, PluginMeta};
use agent::plugins::persona::PersonaPlugin;
use agent::plugins::session_loader::{SessionLoaderConfig, SessionLoaderPlugin};
use agent::plugins::session_persistence::{SessionPersistenceConfig, SessionPersistencePlugin};
use agent::prompt::PromptPlugin;
use agent::session::SessionPlugin;
use agent::tools::ToolsPlugin;
use agent::tools::inner::InnerToolsPlugin;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv()?;
    dotenvy::from_filename(".env.local")?;

    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    let ctx = Arc::new(Ctx::new());

    boot(
        &ctx,
        vec![
            SessionPlugin.boot(&ctx, ())?,
            SessionLoaderPlugin.boot(
                &ctx,
                SessionLoaderConfig {
                    greeting: "历史已加载: 这是第 1 次会话。".to_string(),
                },
            )?,
            ToolsPlugin.boot(&ctx, ())?,
            PromptPlugin.boot(&ctx, ())?,
            PersonaPlugin.boot(&ctx, ())?,
            LLMPlugin.boot(&ctx, ())?,
            LLMConfigPlugin.boot(&ctx, ())?,
            LLMCompactorPlugin.boot(&ctx, LlmCompactorConfig { keep: 20 })?,
            InnerToolsPlugin.boot(&ctx, ())?,
            HistorySearchPlugin.boot(&ctx, ())?,
            MaxTurnsPlugin.boot(&ctx, MaxTurnsConfig { max_turns: 1000 })?,
            AguiPlugin.boot(&ctx, ())?,
            AguiStdoutPlugin.boot(&ctx, ())?,
            SessionPersistencePlugin.boot(
                &ctx,
                SessionPersistenceConfig {
                    dir: "./sessions".to_string(),
                },
            )?,
            LoopPlugin.boot(
                &ctx,
                LoopConfig {
                    max_steps_per_turn: 100,
                },
            )?,
        ],
    )?;

    let session_manager = SessionPlugin::get_service(&ctx)?;
    let session = session_manager.create_session();
    session_manager.seed(
        &session,
        SessionLoaderPlugin::get_service(&ctx)?
            .initial_messages
            .clone(),
    )?;
    let loop_service = LoopPlugin::get_service(&ctx)?;
    loop_service.send(
        session.clone(),
        ChatMessage::user("调用工具计算12345+6789+今天的年份，并返回结果，然后在bing上搜索，查询参数为前面的结果，返回html文本"),
    );
    loop_service.wait_idle().await;
    loop_service.stop();

    Ok(())
}
