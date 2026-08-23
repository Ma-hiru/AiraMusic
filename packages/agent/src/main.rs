use agent::agent::{AgentConfig, build_agent};
use agent::cancel::Signal;
use agent::llm::models::{ChatMessage, LLMConfig, LLMContextSize, LLMProvider};
use agent::llm::plugins::{LLMCompactorConfig, LLMConfigPlugin};
use agent::r#loop::{LoopConfig, LoopPlugin};
use agent::mcp::MCPPlugin;
use agent::plugins::max_turns::MaxTurnsConfig;
use agent::plugins::models::PluginMeta;
use agent::session::SessionPlugin;
use agent::store::StoreConfig;
use agent::utils::generate_id;
use std::io::BufRead;

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
    let mcp_service = MCPPlugin::get_service(&ctx)?;

    mcp_service.register_json(
        r#"{
          "mcpServers": {
            "aira-music": {
              "url": "http://127.0.0.1:32123/mcp"
            }
          }
        }"#,
    )?;

    if config_manager.get_default_config()?.is_none() {
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
            thinking: true,
        })?;
    }

    let cancel_signal = Signal::new();
    let mut session = session_manager.create_session();

    let args = std::env::args();
    let mut last_arg = String::new();
    for arg in args.into_iter().skip(1) {
        if last_arg == "--session" {
            tracing::info!("resume session: {}", arg);
            session = arg.into();
        } else {
            last_arg = arg;
        }
    }

    tracing::info!("current session: {}", session);
    let mut buffer: Vec<u8> = Vec::new();
    loop {
        print!("input >> ");
        std::io::Write::flush(&mut std::io::stdout())?;

        buffer.clear();
        let stdin = std::io::stdin();
        let mut handle = stdin.lock();
        if handle.read_until(b'\n', &mut buffer)? == 0 {
            break; // stdin EOF
        }

        // 交互输入不做严格 utf-8 校验: 非法字节替换成 �,
        // 不因一次坏输入(输入法/粘贴的脏字节)把整个进程带崩
        let content = String::from_utf8_lossy(&buffer).trim().to_string();
        if content == "quit" {
            break;
        }
        let handle = loop_service.send(
            session.clone(),
            ChatMessage::user(content),
            cancel_signal.clone(),
        );

        tokio::join!(handle.completed());
    }

    loop_service.stop();
    ctx.dispose();
    Ok(())
}
