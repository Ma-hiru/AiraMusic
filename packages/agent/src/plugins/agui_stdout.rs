//! 角色: 提供者(传输层示例) —— 把 AGUI 事件以 SSE 线格式打到 stdout。
//!
//! 订阅 "agui_emitter" 广播, 每条事件打印成 SSE 帧:
//!   data: <camelCase JSON>
//!
//! (真实产品里换成 WebSocket/HTTP 推送 = 新写一个传输插件,
//!   订阅同一个广播, 事件流一字不改。)

use std::sync::Arc;

use anyhow::Result;
use serde_json::Value;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::agui::AguiEmitter;
use crate::plugins::models::Plugin;

/// 插件本体。
pub struct AguiStdoutPlugin;

impl Plugin for AguiStdoutPlugin {
    fn name(&self) -> &'static str {
        "agui-stdout"
    }

    /// 我要什么: 事件广播服务。
    fn inject(&self) -> Vec<&'static str> {
        vec!["agui_emitter"]
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: Value) -> Result<Option<Disposer>> {
        let emitter = ctx.get::<AguiEmitter>("agui_emitter")?;
        let mut rx = emitter.subscribe();

        // 后台任务: 收到一条打印一条(SSE 帧)。
        // demo 里任务跟进程同寿命; 生产传输应把它挂到插件收据上可停。
        tokio::spawn(async move {
            while let Ok(event) = rx.recv().await {
                let json = serde_json::to_string(&event).unwrap_or_default();
                println!("\ndata: {json}\n");
            }
        });

        Ok(None)
    }
}
