use crate::ctx::Ctx;
use crate::llm::models::ChatMessage;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use anyhow::Result;
use serde::Deserialize;
use std::sync::Arc;

/// 会话加载插件提供的初始历史(种子)。boot 用它 seed 会话日志。
/// 服务名 "session-seed" —— 和会话日志本体的 "session_manager" 区分开。
#[derive(Clone)]
pub struct SessionSeed {
    /// 会话开始前就该在会话日志里的消息(例如"历史已加载"的系统消息)。
    pub initial_messages: Vec<ChatMessage>,
}

/// 本插件的配置。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLoaderConfig {
    /// 打招呼的文案(会成为会话日志里的第一条系统消息)。
    pub greeting: String,
}

/// 插件本体。
pub struct SessionLoaderPlugin;
impl PluginMeta<SessionSeed> for SessionLoaderPlugin {
    fn name() -> &'static str {
        "session-loader"
    }

    fn service_name() -> &'static str {
        "session-seed"
    }
}
impl Plugin<SessionLoaderConfig, SessionSeed> for SessionLoaderPlugin {
    fn apply(
        &self,
        _ctx: &Arc<Ctx>,
        config: SessionLoaderConfig,
    ) -> Result<PluginApplyResult<SessionSeed>> {
        Ok(PluginApplyResult {
            service: Some(SessionSeed {
                initial_messages: vec![ChatMessage::system(config.greeting)],
            }),
            emit_disposers: None,
        })
    }
}
