use agent::agui::AguiPlugin;
use agent::constants::AGENT_PROTOCOL_VERSION;
use agent::ctx::Ctx;
use agent::llm::plugins::LLMCompactorConfig;
use agent::r#loop::{LoopConfig, LoopPlugin};
use agent::mcp::MCPPlugin;
use agent::plugins::max_turns::MaxTurnsConfig;
use agent::plugins::models::PluginMeta;
use agent::server::bootstrap::AgentBootstrap;
use agent::server::models::AgentReady;
use agent::server::router::build_router;
use agent::server::runtime::AgentLoopRuntimeService;
use agent::server::service::AgentServerState;
use agent::store::StoreConfig;
use agent::utils::{monitor_interrupt, monitor_parent};
use agent::{AgentConfig, build_agent};
use serde_json::json;
use std::io::Write;
use std::net::{Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let bootstrap = get_bootstrap_from_process().await?; // 获取参数
    let ctx = boot_agent(&bootstrap).await?; // 启动agent
    let serve_result = run_server(&ctx, bootstrap).await; // 启动server
    LoopPlugin::get_service(&ctx)?.stop(); // 停止正在运行的agent loop
    ctx.dispose(); // 调用ctx所有的disposer

    serve_result
}

async fn get_bootstrap_from_process() -> anyhow::Result<AgentBootstrap> {
    let bootstrap = AgentBootstrap::from_process()?;

    tracing::subscriber::set_global_default(
        tracing_subscriber::FmtSubscriber::builder()
            .json()
            .with_max_level(bootstrap.log_level)
            .with_ansi(false)
            .with_writer(std::io::stderr) // 输出到 stderr
            .finish(),
    )?;

    Ok(bootstrap)
}

async fn boot_agent(bootstrap: &AgentBootstrap) -> anyhow::Result<Arc<Ctx>> {
    // 暂时先写死配置
    let ctx = build_agent(AgentConfig {
        store_config: StoreConfig {
            path: bootstrap.data_dir.clone(),
            secret: bootstrap.secrets.store_secret.clone(),
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
                    "Authorization": format!("Bearer {}", bootstrap.secrets.mcp_token.clone())
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

    Ok(ctx)
}

async fn run_server(ctx: &Arc<Ctx>, bootstrap: AgentBootstrap) -> anyhow::Result<()> {
    let runtime = AgentLoopRuntimeService::from_ctx(ctx)?;
    let event_channel = AguiPlugin::get_service(ctx)?;
    let state = AgentServerState::new(
        runtime,
        bootstrap.secrets.control_token.clone(),
        event_channel.sender(),
    );
    let shutdown = state.shutdown_signal();
    monitor_parent(shutdown.clone());
    monitor_interrupt(shutdown.clone());

    let listener =
        tokio::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, bootstrap.port)))
            .await?;

    println!(
        "{}",
        serde_json::to_string(&AgentReady {
            event_type: "ready".to_string(),
            port: listener.local_addr()?.port(),
            protocol_version: AGENT_PROTOCOL_VERSION,
        })?
    );
    std::io::stdout().flush()?;

    Ok(axum::serve(listener, build_router(state))
        .with_graceful_shutdown(async move { shutdown.wait_aborted().await })
        .await?)
}
