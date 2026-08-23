use crate::agui::AguiPlugin;
use crate::agui::models::AguiEvent;
use crate::cancel::Signal;
use crate::ctx::Ctx;
use crate::ctx::models::{Disposer, DisposerLike};
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::broadcast::error::RecvError;

pub struct AguiStdoutPlugin;
impl PluginMeta<()> for AguiStdoutPlugin {
    fn name() -> &'static str {
        "agui-stdout"
    }
}
impl Plugin<(), ()> for AguiStdoutPlugin {
    fn inject(&self) -> Vec<&'static str> {
        vec![AguiPlugin::service_name()]
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: ()) -> Result<PluginApplyResult<()>> {
        let emitter = AguiPlugin::get_service(ctx)?;
        let mut rx = emitter.subscribe();

        let cancel_signal = Signal::new();
        let task_signal = cancel_signal.clone();
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    biased;
                    _ = task_signal.cancelled() => break,
                    event = rx.recv() => match event {
                        Ok(event) => {
                            match &event {
                                AguiEvent::TextMessageStart {..} => print!("\nreply: \n"),
                                AguiEvent::TextMessageContent { delta, .. } => print!("{delta}"),
                                AguiEvent::TextMessageEnd {..} => println!(),
                                AguiEvent::ReasoningMessageStart {..} => print!("\nreasoning: \n"),
                                AguiEvent::ReasoningMessageContent { delta, .. } => print!("{delta}"),
                                AguiEvent::ReasoningMessageEnd {..} => println!(),
                                AguiEvent::ToolCallStart {tool_call_name, ..} => print!("\ntool_call({tool_call_name}): \n"),
                                AguiEvent::ToolCallArgs { delta, .. } => print!("{delta}"),
                                AguiEvent::ToolCallEnd {..} => println!(),
                                _ => tracing::info!("\n{event}"),
                            }
                        }
                        Err(RecvError::Lagged(skipped)) => {
                            tracing::warn!(skipped, "agui 事件积压, 丢弃 {skipped} 条");
                        }
                        Err(RecvError::Closed) => break,
                    },
                }
            }
            // 收摊: 把积压的事件打印完再退(与主循环同款分发)
            while let Ok(event) = rx.try_recv() {
                match &event {
                    AguiEvent::TextMessageStart { .. } => print!("\nreply: \n"),
                    AguiEvent::TextMessageContent { delta, .. } => print!("{delta}"),
                    AguiEvent::TextMessageEnd { .. } => println!(),
                    AguiEvent::ToolCallStart { tool_call_name, .. } => {
                        print!("\ntool_call({tool_call_name}): \n")
                    }
                    AguiEvent::ToolCallArgs { delta, .. } => print!("{delta}"),
                    AguiEvent::ToolCallEnd { .. } => println!(),
                    _ => tracing::info!("{event}"),
                }
            }
        });

        let disposer: Disposer = Box::new(move || cancel_signal.cancel());
        Ok(PluginApplyResult {
            service: None,
            emit_disposers: disposer.to_option_disposers(),
        })
    }
}
