use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use crate::plugins::prompt::{PromptPlugin, PromptSection};
use anyhow::Result;
use serde_json::Value;
use std::sync::Arc;

/// 插件本体。
pub struct PersonaPlugin;

impl Plugin for PersonaPlugin {
    /// 我是谁。
    fn name(&self) -> &'static str {
        "persona"
    }

    /// 我要什么: 注册表先就绪。
    fn inject(&self) -> Vec<&'static str> {
        vec![PromptPlugin::service_name()]
    }

    /// 我要干什么: 注册一段人设提示词。
    fn apply(&self, ctx: &Arc<Ctx>, _config: Value) -> Result<Option<Disposer>> {
        // 从公告板取提示词注册表, 塞一段话, 把"移除它"的收据交给装配器。
        let receipt = PromptPlugin::get_service(ctx)?.register(PromptSection {
            name: "persona".to_string(), // 段落名(重名会报错)
            order: 0,                    // 排序号: 越小越靠前; 和插件装载顺序无关
            text: "你是 AiraMusic 的音乐助手, 回答要简短。".to_string(), // 正文
        })?;
        Ok(Some(receipt))
    }
}
