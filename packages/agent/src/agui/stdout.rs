use crate::agui::AguiPlugin;
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
                            // AGUI over SSE: 每条事件一行 data + 空行分隔
                            let json = serde_json::to_string(&event).unwrap_or_default();
                            tracing::info!("AGUI: {json}\n");
                        }
                        Err(RecvError::Lagged(skipped)) => {
                            tracing::warn!(skipped, "agui 事件积压, 丢弃 {skipped} 条");
                        }
                        Err(RecvError::Closed) => break,
                    },
                }
            }
            // 收摊: 把积压的事件打印完再退
            while let Ok(event) = rx.try_recv() {
                let json = serde_json::to_string(&event).unwrap_or_default();
                tracing::info!("AGUI: {json}\n");
            }
        });

        let disposer: Disposer = Box::new(move || cancel_signal.cancel());
        Ok(PluginApplyResult {
            service: None,
            emit_disposers: disposer.to_option_disposers(),
        })
    }
}
