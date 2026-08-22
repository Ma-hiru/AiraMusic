use crate::cancel::Signal;
use crate::ctx::Ctx;
use crate::llm::models::{ChatMessage, LLMAdapter, LLMConfig, Request, StreamEvent};
use crate::llm::plugins::LLMPlugin;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use futures::StreamExt;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMCompactorConfig {
    /// 保留最近 keep 条消息
    pub keep: usize,
    /// 0-1 上下文长度阈值
    pub threshold: f64,
}

pub struct LLMCompactorPlugin;
impl PluginMeta<LLMCompactor> for LLMCompactorPlugin {
    fn name() -> &'static str {
        "llm-compactor"
    }

    fn service_name() -> &'static str {
        "llm-compactor-service"
    }
}
impl Plugin<LLMCompactorConfig, LLMCompactor> for LLMCompactorPlugin {
    fn inject(&self) -> Vec<&'static str> {
        vec![LLMPlugin::service_name()]
    }

    fn apply(
        &self,
        _ctx: &Arc<Ctx>,
        config: LLMCompactorConfig,
    ) -> anyhow::Result<PluginApplyResult<LLMCompactor>> {
        Ok(PluginApplyResult {
            service: Some(LLMCompactor::new(config)),
            emit_disposers: None,
        })
    }
}

#[derive(Clone)]
pub struct Compaction {
    /// 压缩后的历史
    pub messages: Vec<ChatMessage>,
    /// 压缩摘要(进会话日志)
    pub summary: Option<String>,
}

pub struct LLMCompactor {
    /// 0-1 上下文长度阈值
    threshold: f64,
    /// 保留最近 keep 条消息
    keep: usize,
}
impl LLMCompactor {
    pub fn new(config: LLMCompactorConfig) -> Self {
        Self {
            threshold: config.threshold,
            keep: config.keep,
        }
    }

    pub async fn compact(
        &self,
        llm: Arc<dyn LLMAdapter>,
        messages: Vec<ChatMessage>,
        config: LLMConfig,
        cancel: Signal,
    ) -> anyhow::Result<Compaction> {
        // 太少就不压缩
        let tokens = self.token_count(&messages).await as f64;
        let ctx_len: usize = config.context_size.into();
        let threshold = self.threshold * ctx_len as f64;
        if tokens < threshold {
            return Ok(Compaction {
                messages,
                summary: None,
            });
        }

        // 旧历史拿去总结, 最近 keep 条保留
        let old = messages[..messages.len() - self.keep].to_vec();
        let keep = messages[messages.len() - self.keep..].to_vec();
        let request = Request {
            config,
            system: vec!["你是会话压缩器: 把以下对话历史压缩成要点摘要, 只输出摘要本身。".into()],
            messages: old,
            tools: Vec::new(),
            cancel: cancel.clone(),
        };

        // 流式消费, 拼出摘要(可被 stop 打断)
        let mut summary = String::new();
        let mut stream = llm.stream(&request);
        loop {
            let event = tokio::select! {
                biased;
                _ = cancel.cancelled() => {
                    anyhow::bail!("压缩被取消");
                }
                event = stream.next() => event,
            };
            let Some(event) = event else { break };
            if let Ok(StreamEvent::TextDelta { text }) = event {
                summary.push_str(&text);
            }
        }

        // 摘要作为 system 消息放回历史头部 + 保留最近 keep 条。
        let mut result = vec![ChatMessage::system(format!("[summary] {summary}"))];
        result.extend(keep);
        Ok(Compaction {
            messages: result,
            summary: Some(summary),
        })
    }

    pub async fn token_count(&self, messages: &[ChatMessage]) -> usize {
        let mut count = 0;
        for message in messages {
            count += message.token_count();
        }
        count
    }
}
