//! 角色: 提供者 —— 把两个"收纳箱"挂上公告板:
//!   ctx.tools  —— 工具注册表(calculator 往里塞 add, 循环每轮取清单)
//!   ctx.prompt —— 提示词注册表(persona 往里塞段落, 循环每轮拼系统提示)
//!
//! 注意它自己不认识任何具体工具/段落 —— 只提供"收纳"能力。
//! 它存在的意义: 让"提供能力"和"收纳能力"成为两件可以分开演化的事。

use std::sync::Arc;

use anyhow::Result;
use serde_json::Value;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use crate::shared::services::{PromptRegistry, ToolRegistry};
// 公告板 // 两个注册表

/// 插件本体。
pub struct RegistriesPlugin;

impl Plugin for RegistriesPlugin {
    /// 我是谁。
    fn name(&self) -> &'static str {
        "registries"
    }

    /// 我要干什么: 挂两个注册表。
    fn apply(&self, ctx: &Arc<Ctx>, _config: Value) -> Result<Option<Disposer>> {
        // 挂工具注册表, 拿到"摘下它"的收据。
        let remove_tools = ctx.provide("tools", ToolRegistry::new())?;
        // 挂提示词注册表, 同样拿收据。
        let remove_prompt = ctx.provide("prompt", PromptRegistry::new())?;
        // 一个插件挂了两样东西 → 收据合成一张: 撕毁 = 两样一起收回。
        Ok(Some(Box::new(move || {
            remove_tools(); // 摘下工具注册表
            remove_prompt(); // 摘下提示词注册表
        })))
    }
}
