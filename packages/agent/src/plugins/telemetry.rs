use super::models::Plugin;
use crate::ctx::models::Disposer;
use crate::ctx::Ctx;
use crate::r#loop::models::{
    LoopEvent, LoopPayloadError, LoopPayloadTurnEnd, LoopPayloadTurnStart,
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
        // 观察者一: 每轮开始时打印。
        let watch_start = ctx.on::<LoopPayloadTurnStart>(LoopEvent::TurnStart, |p| {
            println!(
                "▶ turn {} 开始: {}",
                p.turn,
                serde_json::to_string(&p.message.content).unwrap_or_default()
            );
        });
        // 观察者二: 每轮结束时打印原因。
        let watch_end = ctx.on::<LoopPayloadTurnEnd>(LoopEvent::TurnEnd, |p| {
            println!("■ turn {} 结束: {}", p.turn, p.reason);
        });
        // 观察者三: 循环出错时打印。
        let watch_error = ctx.on::<LoopPayloadError>(LoopEvent::Error, |p| {
            println!("✖ 循环出错: {}", p.error);
        });
        // 三个收据合成一张: 卸载 = 三个一起撤。
        Ok(Some(Box::new(move || {
            watch_start(); // 撤观察者一
            watch_end(); // 撤观察者二
            watch_error(); // 撤观察者三
        })))
    }
}
