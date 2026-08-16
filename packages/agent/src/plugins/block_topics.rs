//! 角色: 监听者(否决链)。挂在 loop:before-request 上:
//!   用户消息命中敏感词 → 返回 Some(否决) = 这一轮根本不发给模型;
//!   没命中             → 返回 None = 放行。

use std::sync::Arc;

use anyhow::Result;
use serde::Deserialize; // 解析 JSON 配置
use serde_json::Value;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::r#loop::models::{BeforeRequestPayload, PreRequestDecision}; // 载荷 + 裁决(循环的专属语言)
use crate::plugins::models::Plugin;
use crate::shared::message::Role; // 消息角色(共享词汇)
// 公告板(on_veto 在它上面) // 合同

/// 本插件的配置。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockTopicsConfig {
    /// 敏感词列表。
    pub words: Vec<String>,
}

/// 插件本体。
pub struct BlockTopicsPlugin;

impl Plugin for BlockTopicsPlugin {
    /// 我是谁。
    fn name(&self) -> &'static str {
        "block-topics"
    }

    /// 我要干什么: 在 before-request 否决链上挂一个检查。
    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> Result<Option<Disposer>> {
        // 解析配置。
        let config: BlockTopicsConfig = serde_json::from_value(config)?;
        // 把敏感词拷进闭包(闭包要 'static)。
        let words = config.words;
        // 订阅否决链。泛型参数 = (载荷类型, 裁决类型)。
        let receipt = ctx.on_veto::<BeforeRequestPayload, PreRequestDecision>(
            "loop:before-request",
            // 监听者闭包: 在即将发出的历史里找命中敏感词的用户消息。
            move |payload: &mut BeforeRequestPayload| {
                let hit = payload.request.messages.iter().find(|m| {
                    // 只看用户说的话, 且包含任意一个敏感词。
                    m.role == Role::User && words.iter().any(|word| m.content.contains(word))
                });
                // 命中 → 否决; 没命中 → 放行(None)。
                hit.map(|hit| PreRequestDecision::Veto {
                    reason: format!("命中敏感词: {}", hit.content),
                })
            },
        );
        Ok(Some(receipt))
    }
}
