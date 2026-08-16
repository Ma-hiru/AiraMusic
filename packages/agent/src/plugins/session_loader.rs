//! 角色: 提供者 —— 会话加载 = 提供初始历史。
//!
//! 它不直接写会话日志 —— 遵守"唯一写点"纪律:
//!   会话日志只有两个写入口: boot 的 seed(本插件提供的数据)和循环的 append。
//! 将来做"从磁盘恢复会话", 就是把这个插件的 initial_messages 换成读文件的结果。

use std::sync::Arc;

use anyhow::Result;
use serde::Deserialize; // 解析 JSON 配置
use serde_json::Value;

use crate::ctx::Ctx; // 公告板
use crate::ctx::models::Disposer; // 收据
use crate::plugins::models::Plugin;
use crate::shared::message::ChatMessage; // 消息类型
use crate::shared::services::SessionSeed; // 会话种子类型(初始历史) // 合同

/// 本插件的配置。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLoaderConfig {
    /// 打招呼的文案(会成为会话日志里的第一条系统消息)。
    pub greeting: String,
}

/// 插件本体。
pub struct SessionLoaderPlugin;

impl Plugin for SessionLoaderPlugin {
    /// 我是谁。
    fn name(&self) -> &'static str {
        "session-loader"
    }

    /// 我要干什么: 提供初始历史。
    /// 服务名是 "session-seed" —— 避免和会话日志本体的 "session" 服务重名:
    /// 本插件提供的是"种子数据", 会话日志本体由 session 插件提供。
    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> Result<Option<Disposer>> {
        // 解析配置。
        let config: SessionLoaderConfig = serde_json::from_value(config)?;
        // 初始历史 = 一条系统消息。
        let seed = SessionSeed {
            initial_messages: vec![ChatMessage::system(config.greeting)],
        };
        // 挂上公告板。真正的"写日志"发生在 boot 的 seed 阶段(见 boot)。
        let receipt = ctx.provide("session-seed", seed)?;
        Ok(Some(receipt))
    }
}
