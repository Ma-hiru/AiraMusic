use super::models::Plugin;
use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::r#loop::models::{
    LoopEvent, LoopPayloadError, LoopPayloadStepStart, LoopPayloadToolCallEnd,
    LoopPayloadToolCallStart, LoopPayloadToolExecStart, LoopPayloadTurnEnd, LoopPayloadTurnStart,
};
// 三个事件的载荷(循环的专属语言)
use anyhow::Result;
use serde_json::Value;
use std::sync::Arc;

pub struct TelemetryPlugin;
impl Plugin for TelemetryPlugin {
    fn name(&self) -> &'static str {
        "telemetry"
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: Value) -> Result<Option<Disposer>> {
        // 观察者一: 每轮开始时打印(带上会话 id, 多会话时才能分清是谁的轮次)。
        let watch_start = ctx.on::<LoopPayloadTurnStart>(LoopEvent::TurnStart, |p| {
            println!(
                "▶ [{}] turn {} 开始: {}",
                p.session_id,
                p.turn,
                serde_json::to_string(&p.user_message_snapshot.content).unwrap_or_default()
            );
        });
        // 观察者二: 每一步开始时打印(工具往返时一轮会有多步)。
        let watch_step = ctx.on::<LoopPayloadStepStart>(LoopEvent::StepStart, |p| {
            println!(
                "  · [{}] turn {} step {} 开始",
                p.session_id, p.turn, p.step
            );
        });
        // 观察者三: 每轮结束时打印原因。
        let watch_end = ctx.on::<LoopPayloadTurnEnd>(LoopEvent::TurnEnd, |p| {
            println!(
                "■ [{}] turn {} 结束: {}",
                p.session_id, p.turn, p.cause.reason
            );
        });
        // 观察者四: 模型点名调用工具时打印(模型侧)。
        let watch_call = ctx.on::<LoopPayloadToolCallStart>(LoopEvent::ToolCallStart, |p| {
            println!(
                "    📞 [{}] t{}s{} 模型要调用 {} ({})",
                p.session_id, p.turn, p.step, p.name, p.call_id
            );
        });
        // 观察者五: 工具真正开始执行时打印(执行侧)。
        let watch_exec = ctx.on::<LoopPayloadToolExecStart>(LoopEvent::ToolExecStart, |p| {
            println!(
                "    ⚙ [{}] t{}s{} 执行 {} ({})",
                p.session_id, p.turn, p.step, p.name, p.call_id
            );
        });
        // 观察者六: 工具调用参数收齐时打印。
        let watch_call_end = ctx.on::<LoopPayloadToolCallEnd>(LoopEvent::ToolCallEnd, |p| {
            println!(
                "    ✓ [{}] t{}s{} 工具参数收齐 ({})",
                p.session_id, p.turn, p.step, p.call_id
            );
        });
        // 观察者七: 循环出错时打印。
        let watch_error = ctx.on::<LoopPayloadError>(LoopEvent::Error, |p| {
            println!("✖ [{}] 循环出错: {}", p.session_id, p.error);
        });
        // 七个收据合成一张: 卸载 = 七个一起撤。
        Ok(Some(Box::new(move || {
            watch_start(); // 撤观察者一
            watch_step(); // 撤观察者二
            watch_end(); // 撤观察者三
            watch_call(); // 撤观察者四
            watch_exec(); // 撤观察者五
            watch_call_end(); // 撤观察者六
            watch_error(); // 撤观察者七
        })))
    }
}
