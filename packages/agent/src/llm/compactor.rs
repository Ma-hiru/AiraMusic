use crate::ctx::models::Disposer;
use crate::ctx::Ctx;
use crate::llm::models::{ChatMessage, LLMAdapter, Request, StreamEvent};
use crate::plugins::models::Plugin;
use crate::shared::services::{Compaction, ContextCompactor};
use futures::future::BoxFuture;
use futures::StreamExt;
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmCompactorConfig {
    pub model: String,
    pub keep: usize,
    pub context_size: usize,
}

pub struct LlmCompactorPlugin;
impl LlmCompactorPlugin {
    pub fn name() -> &'static str {
        "llm-compactor"
    }

    pub fn service_name() -> &'static str {
        "compactor"
    }

    fn register_service(
        ctx: &Arc<Ctx>,
        llm: Arc<dyn LLMAdapter>,
        config: LlmCompactorConfig,
    ) -> anyhow::Result<Disposer> {
        ctx.provide(
            Self::service_name(),
            LlmCompactor {
                llm,
                keep: config.keep,
                model: config.model,
            },
        )
    }

    pub fn get_service(ctx: &Arc<Ctx>) -> anyhow::Result<Arc<dyn ContextCompactor>> {
        ctx.get::<Arc<dyn ContextCompactor>>(Self::service_name())
    }
}
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
        let llm: Arc<dyn LLMAdapter> = (*ctx.get::<Arc<dyn LLMAdapter>>("llm")?).clone();

        Ok(Some(Self::register_service(ctx, llm, config)?))
    }
}

/// LLM 压缩器本体。
struct LlmCompactor {
    llm: Arc<dyn LLMAdapter>,
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
