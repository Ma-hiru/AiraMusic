use agent::agent::{AgentConfig, build_agent};
use agent::agui::AguiPlugin;
use agent::api::models::AgentReady;
use agent::llm::plugins::LLMCompactorConfig;
use agent::r#loop::{LoopConfig, LoopPlugin};
use agent::mcp::MCPPlugin;
use agent::plugins::max_turns::MaxTurnsConfig;
use agent::plugins::models::PluginMeta;
use agent::runtime::AgentRuntimeService;
use agent::server::bootstrap::AgentBootstrap;
use agent::server::{AGENT_PROTOCOL_VERSION, AgentServerState, build_router};
use agent::store::StoreConfig;
use serde_json::json;
use std::io::Write;
use std::net::{Ipv4Addr, SocketAddr};
use std::time::Duration;
use tokio::io::AsyncReadExt;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let bootstrap = AgentBootstrap::from_process()?;
    tracing::subscriber::set_global_default(
        tracing_subscriber::FmtSubscriber::builder()
            .json()
            .with_max_level(bootstrap.log_level.as_level_filter())
            .with_ansi(false)
            .with_writer(std::io::stderr)
            .finish(),
    )?;

    let ctx = build_agent(AgentConfig {
        store_config: StoreConfig {
            path: bootstrap.data_dir,
            secret: bootstrap.secrets.store_secret().to_string(),
        },
        llm_compactor_config: LLMCompactorConfig {
            keep: 10,
            threshold: 0.75,
        },
        max_turns_config: MaxTurnsConfig { max_turns: 100_000 },
        loop_config: LoopConfig {
            max_steps_per_turn: 100,
        },
    })
    .await?;

    let mcp_service = MCPPlugin::get_service(&ctx)?;
    let mcp_config = json!({
        "mcpServers": {
            "aira-music": {
                "url": bootstrap.mcp_url,
                "headers": {
                    "Authorization": format!("Bearer {}", bootstrap.secrets.mcp_token())
                }
            }
        }
    });
    for disposer in mcp_service.register_json(&serde_json::to_string(&mcp_config)?)? {
        ctx.effect(disposer);
    }
    mcp_service
        .wait_until_ready(Duration::from_secs(10))
        .await?;

    let runtime = AgentRuntimeService::from_ctx(&ctx)?;
    let emitter = AguiPlugin::get_service(&ctx)?;
    let state = AgentServerState::new(
        runtime,
        bootstrap.secrets.control_token(),
        emitter.tx.clone(),
    );
    let shutdown = state.shutdown_signal();
    monitor_parent(shutdown.clone());
    monitor_interrupt(shutdown.clone());

    let listener =
        tokio::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, bootstrap.port)))
            .await?;
    let port = listener.local_addr()?.port();
    let ready = AgentReady {
        event_type: "ready".to_string(),
        port,
        protocol_version: AGENT_PROTOCOL_VERSION,
    };
    println!("{}", serde_json::to_string(&ready)?);
    std::io::stdout().flush()?;

    let server_shutdown = shutdown.clone();
    let serve_result = axum::serve(listener, build_router(state))
        .with_graceful_shutdown(async move { server_shutdown.cancelled().await })
        .await;

    LoopPlugin::get_service(&ctx)?.stop();
    ctx.dispose();
    serve_result?;
    Ok(())
}

fn monitor_parent(shutdown: agent::cancel::Signal) {
    tokio::spawn(async move {
        let mut stdin = tokio::io::stdin();
        let mut buffer = [0u8; 1];
        loop {
            match stdin.read(&mut buffer).await {
                Ok(0) | Err(_) => {
                    shutdown.cancel();
                    return;
                }
                Ok(_) => {}
            }
        }
    });
}

fn monitor_interrupt(shutdown: agent::cancel::Signal) {
    tokio::spawn(async move {
        if tokio::signal::ctrl_c().await.is_ok() {
            shutdown.cancel();
        }
    });
}
