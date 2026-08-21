use crate::ctx::Ctx;
use crate::ctx::models::DisposerLike;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::prompt::{PromptPlugin, PromptSection};
use anyhow::Result;
use std::sync::Arc;

pub struct PersonaPlugin;
impl PluginMeta<()> for PersonaPlugin {
    fn name() -> &'static str {
        "persona"
    }
}
impl Plugin<(), ()> for PersonaPlugin {
    fn inject(&self) -> Vec<&'static str> {
        vec![PromptPlugin::service_name()]
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: ()) -> Result<PluginApplyResult<()>> {
        let disposer = PromptPlugin::get_service(ctx)?.register(PromptSection {
            order: 0,
            name: "persona".to_string(),
            text: "你是 AiraMusic 的音乐助手, 回答要简短。".to_string(),
        })?;
        Ok(PluginApplyResult {
            service: None,
            emit_disposers: disposer.to_option_disposers(),
        })
    }
}
