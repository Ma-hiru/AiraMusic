use agent::boot::{ConfigRow, boot};
use agent::constants;
use agent::r#loop::{LoopPlugin, LoopService};
use agent::plugins::agui::AguiPlugin;
use agent::plugins::agui_stdout::AguiStdoutPlugin;
use agent::plugins::calculator::CalculatorPlugin;
use agent::plugins::context_compactor::ContextCompactorPlugin;
use agent::plugins::history_search::HistorySearchPlugin;
use agent::plugins::llm_fake::LlmFakePlugin;
use agent::plugins::llm_openai::LlmOpenAiPlugin;
use agent::plugins::max_turns::MaxTurnsPlugin;
use agent::plugins::model_router::ModelRouterPlugin;
use agent::plugins::persona::PersonaPlugin;
use agent::plugins::prompt::PromptPlugin;
use agent::plugins::session::SessionPlugin;
use agent::plugins::session_loader::SessionLoaderPlugin;
use agent::plugins::session_persistence::SessionPersistencePlugin;
use agent::plugins::telemetry::TelemetryPlugin;
use agent::plugins::tools::ToolsPlugin;
use agent::shared::message::ChatMessage;
use agent::shared::services::SessionSeed;
use serde_json::json;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // ── 环境变量(.env)+ 日志(与 rust-agent demo 同款) ──
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    // ── 选模型适配器: AGENT_LLM=openai 用真模型(需要 DEEPSEEK_API_KEY),
    //    默认 fake(离线可用)。其余清单完全一样 —— 换模型 = 换这一行。 ──
    let llm_row: ConfigRow = match std::env::var("AGENT_LLM").as_deref() {
        Ok("openai") => ConfigRow {
            id: "llm-openai".to_string(),
            plugin: Arc::new(LlmOpenAiPlugin),
            config: json!({}),
        },
        _ => ConfigRow {
            id: "llm-fake".to_string(),
            plugin: Arc::new(LlmFakePlugin),
            config: json!({ "modelName": constants::DEEPSEEK_V4_FLASH }),
        },
    };

    // ── 装配: 清单 → 公告板 ──
    let ctx = boot(vec![
        ConfigRow {
            id: "session".to_string(),       // 行的唯一编号
            plugin: Arc::new(SessionPlugin), // 插件对象
            config: json!({}),               // 无配置
        },
        ConfigRow {
            id: "session-loader".to_string(),      // 行的唯一编号
            plugin: Arc::new(SessionLoaderPlugin), // 插件对象
            config: json!({ "greeting": "历史已加载: 这是第 1 次会话。" }), // 它的配置
        },
        ConfigRow {
            id: ToolsPlugin::name().into(),
            plugin: Arc::new(ToolsPlugin),
            config: json!({}),
        },
        ConfigRow {
            id: PromptPlugin::name().into(),
            plugin: Arc::new(PromptPlugin),
            config: json!({}),
        },
        llm_row,
        ConfigRow {
            id: "persona".to_string(),
            plugin: Arc::new(PersonaPlugin),
            config: json!({}),
        },
        // 上下文压缩(截断策略)。想换成 LLM 压缩: 把这一行换成 LlmCompactorPlugin。
        ConfigRow {
            id: "context-compactor".to_string(),
            plugin: Arc::new(ContextCompactorPlugin),
            config: json!({ "maxMessages": 100 }),
        },
        ConfigRow {
            id: "calculator".to_string(),
            plugin: Arc::new(CalculatorPlugin),
            config: json!({}),
        },
        // 历史搜索工具: 演示"工具与会话绑定"(用 ToolRunContext 定位会话)。
        ConfigRow {
            id: "history-search".to_string(),
            plugin: Arc::new(HistorySearchPlugin),
            config: json!({}),
        },
        ConfigRow {
            id: "max-turns".to_string(),
            plugin: Arc::new(MaxTurnsPlugin),
            config: json!({ "maxTurns": 2 }), // 每个会话各自的第 2 轮结束时会被它否决
        },
        ConfigRow {
            id: "telemetry".to_string(),
            plugin: Arc::new(TelemetryPlugin),
            config: json!({}),
        },
        // AGUI 翻译器: 循环事件 → AGUI 协议事件(广播给传输层)。
        ConfigRow {
            id: "agui".to_string(),
            plugin: Arc::new(AguiPlugin),
            config: json!({}),
        },
        // AGUI 传输示例: 把事件以 SSE 线格式打到 stdout。
        ConfigRow {
            id: "agui-stdout".to_string(),
            plugin: Arc::new(AguiStdoutPlugin),
            config: json!({}),
        },
        // 路由演示: 消息里出现关键词就换模型(改写 loop:request 里的 Request.model)。
        ConfigRow {
            id: "model-router".to_string(),
            plugin: Arc::new(ModelRouterPlugin),
            config: json!({ "keyword": "简单", "model": constants::MIMO_V2_5_PRO }),
        },
        // 会话落库 + 启动恢复(每个会话一个 <dir>/<session_id>.jsonl)。
        ConfigRow {
            id: "session-persistence".to_string(),
            plugin: Arc::new(SessionPersistencePlugin),
            config: json!({ "dir": "./sessions" }),
        },
        ConfigRow {
            id: "loop".to_string(),
            plugin: Arc::new(LoopPlugin),
            config: json!({
                "maxStepsPerTurn": 8, // 一轮最多 8 步(防死循环)
                "model": constants::DEEPSEEK_V4_FLASH // 默认模型(路由插件可改写)
            }),
        },
    ])?; // 装配失败会在这里直接返回错误

    // ── 拿会话管理器: 会话不再是一份全局日志, 而是按 id 存的多份日志 ──
    let sessions = SessionPlugin::get_service(&ctx)?;

    // ── 创建两个会话(每个会话一把 id, 各有一条只追加的日志) ──
    let session_a = sessions.create_session();
    let session_b = sessions.create_session();

    // ── 播种: 把 session-loader 提供的初始历史模板, 给每个会话各播一次 ──
    let seed = ctx.get::<SessionSeed>("session-seed")?;
    sessions.seed(&session_a, seed.initial_messages.clone())?;
    sessions.seed(&session_b, seed.initial_messages.clone())?;

    // ── 拿水泵: 连"循环"也是按名字从公告板取来的, 和其他服务没有区别 ──
    let loop_service = ctx.get::<Arc<LoopService>>(LoopPlugin::service_name())?;

    // ── 三条用户输入(驱动一切), 交错发往两个会话 ──
    // 会话 A 第 1 轮: 假模型会调 add 工具, 拿到 3 后作答。
    loop_service.send(session_a.clone(), ChatMessage::user("1 + 2 等于几?"));
    // 会话 B 第 1 轮: 同样走一遍工具往返(和 A 各算各的, 互不干扰)。
    loop_service.send(session_b.clone(), ChatMessage::user("3 + 4 等于几?"));
    // 会话 A 第 2 轮: 这是 A 自己的第 2 轮, 结束时被 max-turns 否决;
    // B 只跑了 1 轮, 不受影响(轮次是"会话内"的概念)。
    loop_service.send(session_a.clone(), ChatMessage::user("再算一次"));
    // 会话 A 第 3 轮: 含关键词"简单" → model-router 在 loop:request 决裁点
    // 把模型换成 MIMO_V2_5_PRO, 假模型的回复里会回显新模型名。
    loop_service.send(session_a.clone(), ChatMessage::user("简单算一下 5 + 6"));

    // ── 恢复演示: 上次运行留下的历史会话(若有), 挑最新一个接着聊 ──
    // 轮次会从它日志里的用户消息数推导续号(见 loop 的轮次推导),
    // 而不是重新从 1 开始 —— 这就是"落库再恢复, 接着上次继续"。
    let resumed: Option<agent::plugins::session::SessionId> = sessions
        .session_ids()
        .into_iter()
        .filter(|id| *id != session_a && *id != session_b)
        .max_by_key(|id| id.to_string());
    if let Some(resumed) = &resumed {
        tracing::info!(session = %resumed, "恢复会话, 接着上次继续");
        loop_service.send(resumed.clone(), ChatMessage::user("接着上次继续算: 9 + 1"));
    }

    // ── 等它干完所有活 ──
    loop_service.wait_idle().await;

    // ── 停泵 ──
    loop_service.stop();

    // ── 分别打印会话日志: 验证"模型见过的每一行都来自它自己那条日志" ──
    let mut logs: Vec<(String, agent::plugins::session::SessionId)> = vec![
        ("A".into(), session_a.clone()),
        ("B".into(), session_b.clone()),
    ];
    if let Some(resumed) = &resumed {
        logs.push(("恢复".into(), resumed.clone()));
    }
    for (label, id) in &logs {
        println!("\n=== 会话 {label}({id}) ===");
        for message in sessions.messages(id) {
            // 工具消息额外打印调用编号, 方便和模型的调用对齐。
            let tag = message
                .tool_call_id
                .map(|id| format!(" #{id}"))
                .unwrap_or_default();
            // [角色 编号] 内容
            println!("[{:?}{}] {}", message.role, tag, message.content);
        }
    }
    Ok(())
}
