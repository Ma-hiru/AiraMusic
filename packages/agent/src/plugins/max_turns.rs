use crate::ctx::Ctx;
use crate::ctx::models::DisposerLike;
use crate::r#loop::models::{LoopDecision, LoopEvent, LoopPayloadAfterReply};
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MaxTurnsConfig {
    pub max_turns: u32,
}

pub struct MaxTurnsPlugin;

impl PluginMeta<()> for MaxTurnsPlugin {
    fn name() -> &'static str {
        "max-turns"
    }
}
impl Plugin<MaxTurnsConfig, ()> for MaxTurnsPlugin {
    fn apply(&self, ctx: &Arc<Ctx>, config: MaxTurnsConfig) -> Result<PluginApplyResult<()>> {
        let max = config.max_turns;
        let receipt = ctx.on_veto::<LoopPayloadAfterReply, LoopDecision>(
            LoopEvent::AfterReply,
            move |payload: &mut LoopPayloadAfterReply| {
                if payload.turn >= max {
                    Some(LoopDecision::Deny {
                        reason: format!("达到轮数上限 {max}，请开启新对话"),
                    })
                } else {
                    None
                }
            },
        );
        Ok(PluginApplyResult {
            service: None,
            emit_disposers: receipt.to_option_disposers(),
        })
    }
}
