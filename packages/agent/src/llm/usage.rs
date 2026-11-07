use crate::llm::models::{ChatRequest, ChatUsage, LLMAdapter, LLMStream, LLMStreamEvent};
use async_stream::stream;
use futures::StreamExt;
use std::sync::Arc;

type UsageCallback = Arc<dyn Fn(UsageTrackingEvent) + Send + Sync>;

#[derive(Clone, Debug, PartialEq)]
pub enum UsageTrackingEvent {
    Started,
    Reported {
        previous: Option<ChatUsage>,
        usage: ChatUsage,
    },
}

pub struct UsageTrackingAdapter {
    adapter: Arc<dyn LLMAdapter>,
    callback: UsageCallback,
}

impl UsageTrackingAdapter {
    pub fn new(adapter: Arc<dyn LLMAdapter>, callback: UsageCallback) -> Self {
        Self { adapter, callback }
    }
}

impl LLMAdapter for UsageTrackingAdapter {
    fn stream<'a>(&'a self, request: &'a ChatRequest) -> LLMStream<'a> {
        Box::pin(stream! {
            // 先记录再驱动模型，关闭时不依赖流析构晚于持久化任务的时序。
            (self.callback)(UsageTrackingEvent::Started);
            let mut previous = None;
            let mut stream = self.adapter.stream(request);
            while let Some(event) = stream.next().await {
                if let Ok(LLMStreamEvent::Usage(usage)) = &event {
                    // 标准 usage 是整次请求的全量快照，不能按 chunk 累加。
                    (self.callback)(UsageTrackingEvent::Reported {
                        previous: previous.take(),
                        usage: usage.clone(),
                    });
                    previous = Some(usage.clone());
                }
                yield event;
            }
        })
    }
}
