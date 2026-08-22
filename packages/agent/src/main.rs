use agent::agent::{AgentConfig, build_agent};
use agent::cancel::Signal;
use agent::llm::models::{ChatMessage, LLMConfig, LLMContextSize, LLMProvider};
use agent::llm::plugins::{LLMCompactorConfig, LLMConfigPlugin};
use agent::r#loop::{LoopConfig, LoopPlugin};
use agent::plugins::max_turns::MaxTurnsConfig;
use agent::plugins::models::PluginMeta;
use agent::session::SessionPlugin;
use agent::store::StoreConfig;
use agent::utils::generate_id;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv()?;
    dotenvy::from_filename(".env.local")?;
    tracing::subscriber::set_global_default(
        tracing_subscriber::FmtSubscriber::builder()
            .with_max_level(tracing::Level::INFO)
            .finish(),
    )?;

    let ctx = build_agent(AgentConfig {
        store_config: StoreConfig {
            path: "./data".into(),
            secret: "aaa".to_string(),
        },
        llm_compactor_config: LLMCompactorConfig {
            keep: 10,
            threshold: 0.75,
        },
        max_turns_config: MaxTurnsConfig { max_turns: 100000 },
        loop_config: LoopConfig {
            max_steps_per_turn: 100,
        },
    })
    .await?;

    let loop_service = LoopPlugin::get_service(&ctx)?;
    let session_manager = SessionPlugin::get_service(&ctx)?;
    let config_manager = LLMConfigPlugin::get_service(&ctx)?;

    config_manager.add_global_config(LLMConfig {
        default: true,
        id: generate_id("llm-config"),
        name: "default".to_string(),
        provider: LLMProvider::OpenAI,
        base_url: std::env::var("OPENAI_BASE_URL").ok(),
        api_key: std::env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY not found"),
        model: std::env::var("OPENAI_MODEL").expect("OPENAI_MODEL not found"),
        context_size: LLMContextSize::_1M,
        other: None,
        headers: None,
    })?;
    // 两个会话并行: A 跑工具链路, B 只做一次简单计算, 互不阻塞
    let session_a = session_manager.create_session();
    let session_b = session_manager.create_session();
    let handle_a = loop_service.send(
        session_a.clone(),
        ChatMessage::user("调用工具计算12345+6789+今天的年份"),
        Signal::new(),
    );
    let handle_b = loop_service.send(
        session_b.clone(),
        ChatMessage::user("用计算器工具计算 3*4+5 并返回结果"),
        Signal::new(),
    );
    futures::join!(handle_a.completed(), handle_b.completed());

    loop_service.stop();
    ctx.dispose();
    Ok(())
}
