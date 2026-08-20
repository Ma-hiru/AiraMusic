//! 角色: 提供者 —— 上下文压缩(截断策略)。
//!
//! 策略: 系统消息全留 + 最近 maxMessages 条。
//! 接口是异步的(ContextCompactor), 因为压缩可能调 LLM(见 llm_compactor);
//! 本实现内部是同步逻辑, 只是披上异步接口。
//! 换策略 = 把 main.rs 里这一行换成 llm-compactor。

use std::sync::Arc;

use anyhow::Result;
use futures::future::BoxFuture;
use serde::Deserialize;
use serde_json::Value;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use crate::shared::message::{ChatMessage, Role};
use crate::shared::services::{Compaction, ContextCompactor};

/// 本插件的配置。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextCompactorConfig {
    /// 最近保留多少条(超出才压缩)。
    pub max_messages: usize,
}

/// 插件本体。
pub struct ContextCompactorPlugin;

impl Plugin for ContextCompactorPlugin {
    fn name(&self) -> &'static str {
        "context-compactor"
    }

    /// 我要干什么: 把压缩器挂成 "compactor" 服务。
    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> Result<Option<Disposer>> {
        let config: ContextCompactorConfig = serde_json::from_value(config)?;
        let compactor: Arc<dyn ContextCompactor> = Arc::new(TruncationCompactor {
            max_messages: config.max_messages,
        });
        let receipt = ctx.provide("compactor", compactor)?;
        Ok(Some(receipt))
    }
}

/// 截断压缩器本体。
struct TruncationCompactor {
    max_messages: usize,
}

impl ContextCompactor for TruncationCompactor {
    fn compact<'a>(&'a self, messages: &'a [ChatMessage]) -> BoxFuture<'a, Result<Compaction>> {
        Box::pin(async move {
            // 没超上限: 原样返回, 不留摘要。
            if messages.len() <= self.max_messages {
                return Ok(Compaction {
                    messages: messages.to_vec(),
                    summary: None,
                });
            }
            // 超了: 系统消息(seed 的初始历史)永远保留……
            let head: Vec<ChatMessage> = messages
                .iter()
                .filter(|m| m.role == Role::System)
                .cloned()
                .collect();
            // ……其余只留最近的 maxMessages 条。
            let start = messages.len() - self.max_messages;
            let tail = messages[start..].to_vec();
            // 摘要会由循环落会话日志(压缩结果留痕)。
            let summary = Some(format!(
                "历史过长: {} 条压缩为最近 {} 条",
                messages.len(),
                self.max_messages
            ));
            Ok(Compaction {
                messages: [head, tail].concat(),
                summary,
            })
        })
    }
}
