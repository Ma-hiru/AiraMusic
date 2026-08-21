use crate::ctx::Ctx;
use crate::llm::models::{ChatMessage, LLMAdapter, LLMConfig, Request, StreamEvent};
use crate::llm::plugins::LLMPlugin;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use futures::StreamExt;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmCompactorConfig {
    pub keep: usize,
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
impl Plugin<LlmCompactorConfig, LLMCompactor> for LLMCompactorPlugin {
    fn inject(&self) -> Vec<&'static str> {
        vec![LLMPlugin::service_name()]
    }

    fn apply(
        &self,
        _ctx: &Arc<Ctx>,
        config: LlmCompactorConfig,
    ) -> anyhow::Result<PluginApplyResult<LLMCompactor>> {
        Ok(PluginApplyResult {
            service: Some(LLMCompactor { keep: config.keep }),
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
    keep: usize,
}
impl LLMCompactor {
    pub async fn compact(
        &self,
        llm: Arc<dyn LLMAdapter>,
        messages: Vec<ChatMessage>,
        config: LLMConfig,
    ) -> anyhow::Result<Compaction> {
        // 太少就不压缩
        if messages.len() <= self.keep * 2 {
            return Ok(Compaction {
                messages,
                summary: None,
            });
        }

        // 旧历史拿去总结, 最近 keep 条保留
        let old = messages[..messages.len() - self.keep].to_vec();
        let keep = messages[messages.len() - self.keep..].to_vec();

        // 组装一个"总结请求"(不挂工具, 只要求输出摘要文本)
        let request = Request {
            config,
            system: vec!["你是会话压缩器: 把以下对话历史压缩成要点摘要, 只输出摘要本身。".into()],
            messages: old,
            tools: Vec::new(),
        };

        // 流式消费, 拼出摘要
        let mut summary = String::new();
        let mut stream = llm.stream(&request);
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
    }
}
