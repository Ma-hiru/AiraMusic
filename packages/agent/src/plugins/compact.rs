//! 角色: 提供者 —— 上下文压缩 = 对会话日志历史做一次纯投影(不删、不改会话日志本身)。
//!
//! 想换策略: 换掉这一行配置(或整个插件); 循环只知道"有个 compactor"。
//! 本实现是最笨的策略: 系统消息全留 + 最近的 maxMessages 条。

use std::sync::Arc;

use anyhow::Result;
use serde::Deserialize; // 解析 JSON 配置
use serde_json::Value;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use crate::shared::message::{ChatMessage, Role}; // 消息 + 角色
use crate::shared::services::Compactor;
// 公告板 // 压缩器类型(本质是一个函数)

/// 本插件的配置。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactConfig {
    /// 最近保留多少条(超出才压缩)。
    pub max_messages: usize,
}

/// 插件本体。
pub struct CompactPlugin;

impl Plugin for CompactPlugin {
    /// 我是谁。
    fn name(&self) -> &'static str {
        "compact"
    }

    /// 我要干什么: 挂一个压缩函数。
    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> Result<Option<Disposer>> {
        // 解析配置。
        let config: CompactConfig = serde_json::from_value(config)?;
        // 压缩函数 = 一个闭包。吃完整历史, 吐精简历史。
        let compactor: Compactor = Arc::new(move |messages: &[ChatMessage]| {
            // 没超上限: 原样返回(不压缩)。
            if messages.len() <= config.max_messages {
                return messages.to_vec();
            }
            // 超了: 系统消息(seed 的初始历史)永远保留……
            let head: Vec<ChatMessage> = messages
                .iter()
                .filter(|m| m.role == Role::System)
                .cloned()
                .collect();
            // ……其余只留最近的 maxMessages 条。
            let start = messages.len() - config.max_messages;
            let tail = messages[start..].to_vec();
            // 头 + 尾拼成新的历史(会话日志本身没动, 只是投影变短了)。
            [head, tail].concat()
        });
        // 挂上公告板。
        let receipt = ctx.provide("compactor", compactor)?;
        Ok(Some(receipt))
    }
}
