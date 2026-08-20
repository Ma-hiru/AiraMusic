//! 角色: 监听者(否决链) —— 路由演示: 命中关键词就换模型。
//!
//! 体现 loop:request 决裁点的意义: "用哪个模型"是策略, 不是循环配置。
//! 只改写 payload.request.model, 返回 None(放行, 不拦截)。
//! 将来接入多模型/多供应商, 就是把这里换成真正的路由表。

use std::sync::Arc;

use anyhow::Result;
use serde::Deserialize;
use serde_json::Value;

use crate::ctx::models::Disposer;
use crate::ctx::Ctx;
use crate::plugins::models::Plugin;
use crate::r#loop::models::{LoopDecision, LoopEvent, LoopPayloadRequest};

/// 本插件的配置。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRouterConfig {
    /// 触发关键词(出现在任意历史消息里就切换)。
    pub keyword: String,
    /// 切换到哪个模型。
    pub model: String,
}

/// 插件本体。
pub struct ModelRouterPlugin;

impl Plugin for ModelRouterPlugin {
    fn name(&self) -> &'static str {
        "model-router"
    }

    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> Result<Option<Disposer>> {
        let config: ModelRouterConfig = serde_json::from_value(config)?;
        let keyword = config.keyword;
        let model = config.model;
        let receipt = ctx.on_veto::<LoopPayloadRequest, LoopDecision>(
            LoopEvent::Request,
            move |payload: &mut LoopPayloadRequest| {
                // 命中关键词 → 改写请求里的模型名(放行, 让循环用改后的值)
                let hit = payload
                    .request
                    .messages
                    .iter()
                    .any(|m| m.content.contains(&keyword));
                if hit {
                    tracing::info!(model = %model, keyword = %keyword, "路由切换模型");
                    payload.request.config.model = model.clone();
                }
                None
            },
        );
        Ok(Some(receipt))
    }
}
