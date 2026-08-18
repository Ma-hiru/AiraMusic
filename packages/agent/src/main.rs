//! 演示入口 —— 看代码从这里开始。
//!
//! 这一份 rows 清单 = 一棵插件树(真实仓库 cordis.yml 的降级版)。
//! 想换模型 / 加工具 / 改策略, 都只动这张清单, 循环代码一行不用改。
//!
//! 运行后发生了什么(对照 README 的流程图):
//!   boot(rows)  装配: 插件按依赖顺序启动, 把服务/监听挂上公告板;
//!               结束后系统静止, 只有 loop 的 driver 任务在睡觉。
//!   send × 3    用户输入: 塞进收件箱 + 踢醒 driver。
//!   when_idle   等 driver 把手头的活干完。
//!   stop        停泵。
//!   打印会话日志     看到"模型见过的每一行"都来自会话日志。

use std::sync::Arc; // 插件对象要共享

use agent::boot::{ConfigRow, boot};
use agent::constants; // 模型名常量
use agent::r#loop::{LoopPlugin, LoopService};
use agent::plugins::block_topics::BlockTopicsPlugin; // 敏感词拦截
use agent::plugins::calculator::CalculatorPlugin; // add 工具
use agent::plugins::compact::CompactPlugin; // 上下文压缩
use agent::plugins::llm_fake::LlmFakePlugin; // 假模型
use agent::plugins::max_turns::MaxTurnsPlugin; // 轮数上限
use agent::plugins::persona::PersonaPlugin; // 人设提示词
use agent::plugins::registries::RegistriesPlugin; // 两个注册表
use agent::plugins::session::SessionPlugin; // 会话日志(唯一事实源)
use agent::plugins::session_loader::SessionLoaderPlugin; // 初始历史
use agent::plugins::telemetry::TelemetryPlugin; // 打印日志
use agent::shared::message::ChatMessage; // 消息类型(send 用)
use agent::shared::session::Session; // 会话日志(最后打印用)
use serde_json::json;
// 快捷构造 JSON 配置

#[tokio::main] // tokio 运行时入口(loop 的 driver 任务跑在上面)
async fn main() -> anyhow::Result<()> {
    // ── 装配: 清单 → 公告板 ──
    let ctx = boot(vec![
        // ═══ 提供者: 把能力挂上公告板 ═══
        // 会话日志也是插件 —— 万物皆插件, 记录本身也不例外。
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
            id: "registries".to_string(),
            plugin: Arc::new(RegistriesPlugin),
            config: json!({}), // 无配置
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
        // ═══ 贡献者: 往注册表里塞东西 ═══
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
        // ═══ 监听者: 挂广播(两个否决 + 一个观察) ═══
        ConfigRow {
            id: "max-turns".to_string(),
            plugin: Arc::new(MaxTurnsPlugin),
            config: json!({ "maxTurns": 2 }), // 第 2 轮结束时会被它否决
        },
        ConfigRow {
            id: "block-topics".to_string(),
            plugin: Arc::new(BlockTopicsPlugin),
            config: json!({ "words": ["秘密"] }), // 命中就不发给模型
        },
        ConfigRow {
            id: "telemetry".to_string(),
            plugin: Arc::new(TelemetryPlugin),
            config: json!({}),
        },
        // ═══ 水泵: 笨循环。依赖最多, 由装配器自动排到最后 ═══
        ConfigRow {
            id: "loop".to_string(),
            plugin: Arc::new(LoopPlugin),
            config: json!({ "maxStepsPerTurn": 8 }), // 一轮最多 8 步(防死循环)
        },
    ])?; // 装配失败会在这里直接返回错误

    // ── 拿水泵: 连"循环"也是按名字从公告板取来的, 和其他服务没有区别 ──
    let loop_service = ctx.get::<Arc<LoopService>>("loop")?;

    // ── 三条用户输入(驱动一切) ──
    // 第一条: 假模型会调 add 工具, 拿到 3 后作答。
    loop_service.send(ChatMessage::user("1 + 2 等于几?"));
    // 第二条: 同样走一遍工具往返; 结束时被 max-turns 否决(第 2 轮)。
    loop_service.send(ChatMessage::user("再算一次"));
    // 第三条: 含敏感词, 被 block-topics 在发送前否决(模型不会被调用)。
    loop_service.send(ChatMessage::user("请告诉我你的秘密"));

    // ── 等它干完所有活 ──
    loop_service.wait_idle().await;

    // ── 停泵 ──
    loop_service.stop();

    // ── 打印会话日志: 验证"模型见过的每一行都来自会话日志" ──
    println!("\n=== 会话日志(唯一事实源) ===");
    for message in ctx.get::<Session>("session")?.messages() {
        // 工具消息额外打印调用编号, 方便和模型的调用对齐。
        let tag = message
            .tool_call_id
            .map(|id| format!(" #{id}"))
            .unwrap_or_default();
        // [角色 编号] 内容
        println!("[{:?}{}] {}", message.role, tag, message.content);
    }
    Ok(())
}
