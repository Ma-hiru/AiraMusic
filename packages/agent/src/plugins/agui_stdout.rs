use crate::agui::AguiPlugin;
use crate::ctx::Ctx;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use anyhow::Result;
use std::sync::Arc;

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

        tokio::spawn(async move {
            while let Ok(event) = rx.recv().await {
                let json = serde_json::to_string(&event).unwrap_or_default();
                println!("\nAGUI Event: {json}\n");
            }
        });

        Ok(PluginApplyResult {
            service: None,
            emit_disposers: None,
        })
    }
}
