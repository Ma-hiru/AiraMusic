//! 角色: 提供者 —— LLM 压缩器(演示"压缩可以 await 且调模型")。
//!
//! 策略: 旧历史(保留最近 keep 条之外的部分)交给模型总结成摘要;
//!       摘要作为 system 消息放回历史头部 + 保留最近 keep 条。
//! 不放进 main.rs 默认清单; 想用就把 context-compactor 行换成它。
//!
//! 关键点: 压缩器是一个服务(不是事件) —— 循环 await 它, 这正是
//! "上下文管理插件要 await"的答案: 事件是拦截用, 能力调用是服务用。

use std::sync::Arc;

use anyhow::Result;
use futures::StreamExt;
use futures::future::BoxFuture;
use serde::Deserialize;
use serde_json::Value;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use crate::shared::llm::{LlmAdapter, StreamEvent};
use crate::shared::message::{ChatMessage, Request};
use crate::shared::services::{Compaction, ContextCompactor};

/// 本插件的配置。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmCompactorConfig {
    /// 压缩摘要用哪个模型。
    pub model: String,
    /// 最近多少条不压缩(触发阈值 = keep * 2)。
    pub keep: usize,
}

/// 插件本体。
pub struct LlmCompactorPlugin;

impl Plugin for LlmCompactorPlugin {
    fn name(&self) -> &'static str {
        "llm-compactor"
    }

    /// 我要什么: 压缩要调模型。
    fn inject(&self) -> Vec<&'static str> {
        vec!["llm"]
    }

    /// 我要干什么: 把 LLM 压缩器挂成 "compactor" 服务。
    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> Result<Option<Disposer>> {
        let config: LlmCompactorConfig = serde_json::from_value(config)?;
        // ctx.get 返回 Arc<T>; T 本身是 Arc<dyn LlmAdapter>, 剥一层再存。
        let llm: Arc<dyn LlmAdapter> = (*ctx.get::<Arc<dyn LlmAdapter>>("llm")?).clone();
        let compactor: Arc<dyn ContextCompactor> = Arc::new(LlmCompactor {
            llm,
            keep: config.keep,
            model: config.model,
        });
        let receipt = ctx.provide("compactor", compactor)?;
        Ok(Some(receipt))
    }
}

/// LLM 压缩器本体。
struct LlmCompactor {
    llm: Arc<dyn LlmAdapter>,
    keep: usize,
    model: String,
}

impl ContextCompactor for LlmCompactor {
    fn compact<'a>(&'a self, messages: &'a [ChatMessage]) -> BoxFuture<'a, Result<Compaction>> {
        Box::pin(async move {
            // 太少就不压缩
            if messages.len() <= self.keep * 2 {
                return Ok(Compaction {
                    messages: messages.to_vec(),
                    summary: None,
                });
            }
            // 旧历史拿去总结, 最近 keep 条保留
            let old = messages[..messages.len() - self.keep].to_vec();
            let keep = messages[messages.len() - self.keep..].to_vec();

            // 组装一个"总结请求"(不挂工具, 只要求输出摘要文本)
            let request = Request {
                model: self.model.clone(),
                system: vec![
                    "你是会话压缩器: 把以下对话历史压缩成要点摘要, 只输出摘要本身。".into(),
                ],
                messages: old,
                tools: Vec::new(),
            };
            // 流式消费, 拼出摘要
            let mut summary = String::new();
            let mut stream = self.llm.stream(&request);
            while let Some(event) = stream.next().await {
                if let Ok(StreamEvent::TextDelta { text }) = event {
                    summary.push_str(&text);
                }
            }
            // 摘要作为 system 消息放回历史头部 + 保留最近 keep 条。
            // summary 同时返回给循环落会话日志(留痕)。
            let mut result = vec![ChatMessage::system(format!("[摘要] {summary}"))];
            result.extend(keep);
            Ok(Compaction {
                messages: result,
                summary: Some(summary),
            })
        })
    }
}
