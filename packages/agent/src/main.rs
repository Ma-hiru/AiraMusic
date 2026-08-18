//! 演示入口 —— 看代码从这里开始。
//!
//! 这一份 rows 清单 = 一棵插件树(真实仓库 cordis.yml 的降级版)。
//! 想换模型 / 加工具 / 改策略, 都只动这张清单, 循环代码一行不用改。
//!
//! 运行后发生了什么(对照 README 的流程图):
//!   boot(rows)      装配: 插件按依赖顺序启动, 把服务/监听挂上公告板;
//!                   结束后系统静止, 只有 loop 的 driver 任务在睡觉。
//!   创建两个会话     每个会话一把 id, 各自有一条会话日志(多会话演示)。
//!   seed × 2        给两个会话分别播种初始历史(每个会话只能 seed 一次)。
//!   send × 3        用户输入: 塞进收件箱(带会话 id)+ 踢醒 driver。
//!   when_idle       等 driver 把手头的活干完。
//!   stop            停泵。
//!   打印两条会话日志  验证"模型见过的每一行都来自它自己那条会话日志"。

use std::sync::Arc;
// 插件对象要共享

use agent::boot::{boot, ConfigRow};
use agent::constants;
use agent::plugins::calculator::CalculatorPlugin;
// 模型名常量
use agent::r#loop::{LoopPlugin, LoopService};
// add 工具
use agent::plugins::compact::CompactPlugin;
// 上下文压缩
use agent::plugins::llm_fake::LlmFakePlugin;
// 假模型
use agent::plugins::max_turns::MaxTurnsPlugin;
// 轮数上限
use agent::plugins::persona::PersonaPlugin;
// 人设提示词
use agent::plugins::prompt::PromptPlugin;
use agent::plugins::session::SessionPlugin;
// 会话日志(唯一事实源)
use agent::plugins::session_loader::SessionLoaderPlugin;
// 初始历史模板
use agent::plugins::telemetry::TelemetryPlugin;
// 打印日志
use agent::plugins::tools::ToolsPlugin;
use agent::shared::message::ChatMessage;
// 消息类型(send 用)
use agent::shared::services::SessionSeed;
// 初始历史模板(session-loader 提供)
use serde_json::json;
// 快捷构造 JSON 配置

#[tokio::main] // tokio 运行时入口(loop 的 driver 任务跑在上面)
async fn main() -> anyhow::Result<()> {
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
        ConfigRow {
            id: "llm-fake".to_string(),
            plugin: Arc::new(LlmFakePlugin),
            // 模型名来自 constants —— 换真模型时, 这里换成真适配器的配置。
            config: json!({ "modelName": constants::DEEPSEEK_V4_FLASH }),
        },
        ConfigRow {
            id: "compact".to_string(),
            plugin: Arc::new(CompactPlugin),
            config: json!({ "maxMessages": 20 }), // 超过 20 条才压缩
        },
        ConfigRow {
            id: "persona".to_string(),
            plugin: Arc::new(PersonaPlugin),
            config: json!({}),
        },
        ConfigRow {
            id: "calculator".to_string(),
            plugin: Arc::new(CalculatorPlugin),
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
        ConfigRow {
            id: "loop".to_string(),
            plugin: Arc::new(LoopPlugin),
            config: json!({ "maxStepsPerTurn": 8 }), // 一轮最多 8 步(防死循环)
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

    // ── 等它干完所有活 ──
    loop_service.wait_idle().await;

    // ── 停泵 ──
    loop_service.stop();

    // ── 分别打印两条会话日志: 验证"模型见过的每一行都来自它自己那条日志" ──
    for (label, id) in [("A", &session_a), ("B", &session_b)] {
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
