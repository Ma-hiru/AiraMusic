use super::*;
use crate::llm::models::{ChatToolCall, LLMContextSize, LLMStream};
use futures::stream;
use serde_json::json;
use std::sync::Mutex;

enum Response {
    Reply(String),
    Events(Vec<LLMStreamEvent>),
    ErrorAfterText,
    Pending,
}

struct TestAdapter {
    response: Response,
    requests: Mutex<Vec<ChatRequest>>,
}

impl TestAdapter {
    fn new(response: Response) -> Arc<Self> {
        Arc::new(Self {
            response,
            requests: Mutex::new(Vec::new()),
        })
    }
}

impl LLMAdapter for TestAdapter {
    fn stream<'a>(&'a self, request: &'a ChatRequest) -> LLMStream<'a> {
        self.requests.lock().unwrap().push(request.clone());
        match &self.response {
            Response::Reply(text) => Box::pin(stream::iter([
                Ok(LLMStreamEvent::TextDelta { text: text.clone() }),
                Ok(LLMStreamEvent::Done {
                    finish_reason: Some("stop".into()),
                }),
            ])),
            Response::Events(events) => Box::pin(stream::iter(events.clone().into_iter().map(Ok))),
            Response::ErrorAfterText => Box::pin(stream::iter([
                Ok(LLMStreamEvent::TextDelta {
                    text: "partial summary".into(),
                }),
                Err(anyhow::anyhow!("provider disconnected")),
            ])),
            Response::Pending => Box::pin(stream::pending()),
        }
    }
}

fn config() -> LLMConfig {
    LLMConfig {
        model: "compaction-model".into(),
        context_size: LLMContextSize::Custom(8_192),
        thinking: true,
        ..LLMConfig::default()
    }
}

fn compactor(keep: usize) -> LLMCompactor {
    LLMCompactor::new(LLMCompactorConfig {
        keep,
        threshold: 0.8,
    })
}

fn history() -> Vec<ChatMessage> {
    vec![
        ChatMessage::user("old goals and constraints ".repeat(120)),
        ChatMessage::assistant_with_tool_calls(
            "",
            vec![ChatToolCall {
                id: "old-call".into(),
                name: "read_page".into(),
                args: json!({ "page": "old" }),
            }],
        ),
        ChatMessage::tool("old successful page result ".repeat(120), "old-call"),
        ChatMessage::assistant("old answer ".repeat(120)),
        ChatMessage::user("recent user"),
        ChatMessage::assistant_with_tool_calls(
            "",
            vec![ChatToolCall {
                id: "recent-call".into(),
                name: "read_page".into(),
                args: json!({ "page": "recent" }),
            }],
        ),
        ChatMessage::tool("recent tool result", "recent-call"),
        ChatMessage::assistant("recent answer"),
        ChatMessage::user("current question"),
    ]
}

fn reserved_to_trigger(messages: &[ChatMessage]) -> usize {
    let tokens = messages.iter().map(ChatMessage::token_count).sum::<usize>();
    (8_192_f64 * 0.8).floor() as usize - tokens + 1
}

#[tokio::test]
async fn reasoning_does_not_consume_the_summary_text_budget() {
    let messages = history();
    let adapter = TestAdapter::new(Response::Events(vec![
        LLMStreamEvent::ReasoningDelta {
            delta: "思".repeat(SUMMARY_OUTPUT_LIMIT * 2),
        },
        LLMStreamEvent::TextDelta {
            text: "用户正在比较方案；旧页面已读取。".into(),
        },
        LLMStreamEvent::Done {
            finish_reason: Some("stop".into()),
        },
    ]));
    let result = compactor(3)
        .compact_with_budget(
            adapter.clone(),
            messages.clone(),
            config(),
            Signal::default(),
            reserved_to_trigger(&messages),
        )
        .await
        .unwrap();
    assert_eq!(
        result.summary.as_deref(),
        Some("用户正在比较方案；旧页面已读取。")
    );
    assert!(result.messages[0].content.contains("用户正在比较方案"));
    assert!(!result.messages[0].content.contains('思'));
    assert!(adapter.requests.lock().unwrap()[0].cancel.is_aborted());
}

#[tokio::test]
async fn compaction_counts_reserved_payload_and_preserves_whole_tool_turns() {
    let messages = history();
    let adapter = TestAdapter::new(Response::Reply("用户正在比较方案；旧页面已读取。".into()));
    let service = compactor(3);
    let uncompressed = service
        .compact(
            adapter.clone(),
            messages.clone(),
            config(),
            Signal::default(),
        )
        .await
        .unwrap();
    assert!(uncompressed.summary.is_none());
    assert_eq!(uncompressed.messages, messages);
    assert!(adapter.requests.lock().unwrap().is_empty());

    let cancel = Signal::default();
    let result = service
        .compact_with_budget(
            adapter.clone(),
            messages.clone(),
            config(),
            cancel.clone(),
            reserved_to_trigger(&messages),
        )
        .await
        .unwrap();
    assert_eq!(
        result.summary.as_deref(),
        Some("用户正在比较方案；旧页面已读取。")
    );
    assert_eq!(result.messages[0].role, ChatRole::System);
    assert_eq!(&result.messages[1..], &messages[4..]);
    assert!(!cancel.is_aborted());
    let requests = adapter.requests.lock().unwrap();
    assert_eq!(requests.len(), 1);
    let request = &requests[0];
    assert!(!request.config.thinking);
    assert!(request.tools.is_empty());
    assert_eq!(request.messages.len(), 1);
    assert_eq!(request.messages[0].role, ChatRole::User);
    assert!(request.messages[0].tool_calls.is_empty());
    let serialized: Vec<ChatMessage> = serde_json::from_str(&request.messages[0].content).unwrap();
    assert_eq!(serialized, messages[..4]);
    assert!(request.cancel.is_aborted());
}

#[tokio::test]
async fn compaction_keeps_page_context_with_its_user_and_tool_turn() {
    let mut messages = history();
    messages.insert(8, ChatMessage::context_snapshot("current playlist page"));
    messages.insert(4, ChatMessage::context_snapshot("recent album page"));
    messages.insert(0, ChatMessage::context_snapshot("old artist page"));
    let adapter = TestAdapter::new(Response::Reply("旧歌手资料已读取。".into()));
    let result = compactor(3)
        .compact_with_budget(
            adapter.clone(),
            messages.clone(),
            config(),
            Signal::default(),
            reserved_to_trigger(&messages),
        )
        .await
        .unwrap();
    assert_eq!(&result.messages[1..], &messages[5..]);
    assert!(result.messages[1].is_context_snapshot());
    assert_eq!(result.messages[2].role, ChatRole::User);
    assert!(result.messages[result.messages.len() - 2].is_context_snapshot());
    assert_eq!(result.messages.last().unwrap().role, ChatRole::User);
    let requests = adapter.requests.lock().unwrap();
    let old: Vec<ChatMessage> = serde_json::from_str(&requests[0].messages[0].content).unwrap();
    assert_eq!(old, messages[..5]);
    assert!(old[0].is_context_snapshot());
    assert_eq!(old[1].role, ChatRole::User);
    assert!(
        old.iter()
            .any(|message| message.tool_call_id.as_deref() == Some("old-call"))
    );
    assert!(
        result
            .messages
            .iter()
            .any(|message| message.tool_call_id.as_deref() == Some("recent-call"))
    );
}

#[tokio::test]
async fn a_keep_boundary_on_page_context_retains_that_context_and_the_following_user() {
    let mut messages = history();
    messages.insert(8, ChatMessage::context_snapshot("current playlist page"));
    let adapter = TestAdapter::new(Response::Reply("此前各轮已完成。".into()));
    let result = compactor(2)
        .compact_with_budget(
            adapter.clone(),
            messages.clone(),
            config(),
            Signal::default(),
            reserved_to_trigger(&messages),
        )
        .await
        .unwrap();
    assert_eq!(&result.messages[1..], &messages[8..]);
    let requests = adapter.requests.lock().unwrap();
    let old: Vec<ChatMessage> = serde_json::from_str(&requests[0].messages[0].content).unwrap();
    assert_eq!(old, messages[..8]);
}

#[tokio::test]
async fn ordinary_system_messages_are_not_mistaken_for_page_context() {
    let mut messages = history();
    messages.insert(8, ChatMessage::system("[summary] ordinary system message"));
    let adapter = TestAdapter::new(Response::Reply("旧对话已总结。".into()));
    let result = compactor(1)
        .compact_with_budget(
            adapter.clone(),
            messages.clone(),
            config(),
            Signal::default(),
            reserved_to_trigger(&messages),
        )
        .await
        .unwrap();
    assert_eq!(&result.messages[1..], &messages[9..]);
    let requests = adapter.requests.lock().unwrap();
    let old: Vec<ChatMessage> = serde_json::from_str(&requests[0].messages[0].content).unwrap();
    assert_eq!(old, messages[..9]);
    assert!(!old.last().unwrap().is_context_snapshot());
}

#[tokio::test]
async fn empty_history_or_a_single_context_user_pair_cannot_be_split() {
    let adapter = TestAdapter::new(Response::Pending);
    for messages in [
        Vec::new(),
        vec![
            ChatMessage::context_snapshot("current playlist page"),
            ChatMessage::user("current user"),
        ],
    ] {
        let reserved = reserved_to_trigger(&messages);
        let error = compactor(1)
            .compact_with_budget(
                adapter.clone(),
                messages,
                config(),
                Signal::default(),
                reserved,
            )
            .await
            .err()
            .unwrap();
        assert!(error.to_string().contains("不足两个用户轮次"));
    }
    assert!(adapter.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn long_single_turn_and_protected_history_fail_without_underflow_or_request() {
    let adapter = TestAdapter::new(Response::Pending);
    let messages = history();
    let error = compactor(usize::MAX)
        .compact_with_budget(
            adapter.clone(),
            messages.clone(),
            config(),
            Signal::default(),
            reserved_to_trigger(&messages),
        )
        .await
        .err()
        .unwrap();
    assert!(error.to_string().contains("所有完整轮次均需保留"));
    let error = compactor(10)
        .compact(
            adapter.clone(),
            vec![ChatMessage::user("long current prompt ".repeat(5_000))],
            config(),
            Signal::default(),
        )
        .await
        .err()
        .unwrap();
    assert!(error.to_string().contains("不足两个用户轮次"));
    assert!(adapter.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn errors_incomplete_empty_and_expanded_summaries_do_not_replace_history() {
    let messages = history();
    for response in [
        Response::ErrorAfterText,
        Response::Events(vec![LLMStreamEvent::TextDelta {
            text: "cut off".into(),
        }]),
        Response::Events(vec![LLMStreamEvent::Done {
            finish_reason: Some("length".into()),
        }]),
        Response::Events(vec![LLMStreamEvent::Done {
            finish_reason: None,
        }]),
        Response::Reply("   ".into()),
        Response::Reply("expanded summary ".repeat(800)),
        Response::Reply("长".repeat(SUMMARY_OUTPUT_LIMIT + 1)),
        Response::Events(vec![LLMStreamEvent::ToolCallStart {
            id: "call".into(),
            name: "forbidden".into(),
        }]),
    ] {
        let adapter = TestAdapter::new(response);
        assert!(
            compactor(3)
                .compact_with_budget(
                    adapter.clone(),
                    messages.clone(),
                    config(),
                    Signal::default(),
                    reserved_to_trigger(&messages),
                )
                .await
                .is_err()
        );
        let requests = adapter.requests.lock().unwrap();
        assert_eq!(requests.len(), 1);
        assert!(requests[0].cancel.is_aborted());
    }
}

#[tokio::test]
async fn a_shorter_summary_that_still_exceeds_payload_budget_is_rejected() {
    let messages = history();
    let adapter = TestAdapter::new(Response::Reply("short summary".into()));
    let retained_tokens = messages[4..]
        .iter()
        .map(ChatMessage::token_count)
        .sum::<usize>();
    let reserved = (8_192_f64 * 0.8).floor() as usize - retained_tokens - 1;
    let error = compactor(3)
        .compact_with_budget(adapter, messages, config(), Signal::default(), reserved)
        .await
        .err()
        .unwrap();
    assert!(error.to_string().contains("压缩后仍超过上下文预算"));
}

#[tokio::test]
async fn an_expanded_summary_and_oversized_protected_payload_have_clear_errors() {
    let messages = history();
    let adapter = TestAdapter::new(Response::Reply("expanded summary ".repeat(800)));
    let error = compactor(3)
        .compact_with_budget(
            adapter.clone(),
            messages.clone(),
            config(),
            Signal::default(),
            reserved_to_trigger(&messages),
        )
        .await
        .err()
        .unwrap();
    assert!(error.to_string().contains("未缩短"), "{error}");
    assert_eq!(adapter.requests.lock().unwrap().len(), 1);

    let adapter = TestAdapter::new(Response::Pending);
    let error = compactor(3)
        .compact_with_budget(
            adapter.clone(),
            messages,
            config(),
            Signal::default(),
            7_000,
        )
        .await
        .err()
        .unwrap();
    assert!(
        error
            .to_string()
            .contains("保留轮次与请求配置已超过上下文预算")
    );
    assert!(adapter.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn compaction_timeout_and_cancellation_abort_only_the_summary_request() {
    let adapter = TestAdapter::new(Response::Pending);
    let request = ChatRequest {
        config: config(),
        system: Vec::new(),
        messages: Vec::new(),
        tools: Vec::new(),
        cancel: Signal::default(),
    };
    let cancel = Signal::default();
    let error = LLMCompactor::summarize(
        adapter.as_ref(),
        &request,
        &cancel,
        Duration::from_millis(5),
    )
    .await
    .unwrap_err();
    assert!(error.to_string().contains("超时"));
    assert!(request.cancel.is_aborted());
    assert!(!cancel.is_aborted());

    let messages = history();
    let adapter = TestAdapter::new(Response::Pending);
    let cancel = Signal::default();
    let service = compactor(3);
    let (result, ()) = tokio::join!(
        service.compact_with_budget(
            adapter.clone(),
            messages.clone(),
            config(),
            cancel.clone(),
            reserved_to_trigger(&messages)
        ),
        async {
            while adapter.requests.lock().unwrap().is_empty() {
                tokio::task::yield_now().await;
            }
            cancel.abort();
        }
    );
    assert!(result.err().unwrap().to_string().contains("取消"));
    assert!(adapter.requests.lock().unwrap()[0].cancel.is_aborted());
}
