//! 角色: 监听者(否决链)。挂在 loop:after-reply 上:
//!   轮数到上限 → 返回 Some(停) = 否决, 循环立刻采纳;
//!   没到       → 返回 None    = 放行, 循环继续问下一个/用默认值。
//!
//! 闭包就能当监听者(Voter 对闭包有现成实现), 不需要专门的结构体。
//! 它是"循环判读"策略的典型: 默认值由循环算, 插件只否决。

use std::sync::Arc;

use anyhow::Result;
use serde::Deserialize;
// 解析 JSON 配置
use serde_json::Value;

use crate::ctx::models::Disposer;
use crate::ctx::Ctx;
use crate::r#loop::models::{LoopDecision, LoopEvent, LoopPayloadAfterReply};
// 载荷 + 裁决类型(循环的专属语言)
use crate::plugins::models::Plugin;
// 公告板(on_veto 在它上面) // 合同

/// 本插件的配置。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaxTurnsConfig {
    /// 最多允许几轮。
    pub max_turns: u32,
}

/// 插件本体。
pub struct MaxTurnsPlugin;

impl Plugin for MaxTurnsPlugin {
    /// 我是谁。
    fn name(&self) -> &'static str {
        "max-turns"
    }

    /// 我要干什么: 在 after-reply 否决链上挂一个检查。
    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> Result<Option<Disposer>> {
        // 解析配置。
        let config: MaxTurnsConfig = serde_json::from_value(config)?;
        // 把上限值拷进闭包(闭包要 'static, 只能带走自己的东西)。
        let max = config.max_turns;
        // 订阅否决链。泛型参数 = (载荷类型, 裁决类型)。
        let receipt = ctx.on_veto::<LoopPayloadAfterReply, LoopDecision>(
            LoopEvent::AfterReply,
            // 监听者就是一个闭包: 看载荷, 表态。
            move |payload: &mut LoopPayloadAfterReply| {
                if payload.turn >= max {
                    // 到上限: 否决 —— 链立刻停, 这个裁决就是最终答案。
                    Some(LoopDecision {
                        should_continue: false,
                        reason: format!("达到轮数上限 {max}"),
                    })
                } else {
                    None // 没到: 放行
                }
            },
        );
        Ok(Some(receipt))
    }
}
