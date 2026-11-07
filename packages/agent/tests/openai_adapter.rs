use agent::llm::adapter::openai::OpenAiAdapter;
use agent::llm::models::{
    ChatMessage, ChatRequest, ChatToolCall, ChatUsage, LLMAdapter, LLMConfig, LLMProvider,
    LLMStreamEvent,
};
use agent::tools::inner::calculator::CalculatorTool;
use agent::utils::{LLMSSEDecoder, Signal};
use axum::body::Body;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::Response;
use axum::routing::post;
use axum::{Json, Router};
use futures::{StreamExt, stream};
use serde_json::{Value, json};
use std::collections::VecDeque;
use std::convert::Infallible;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

struct CapturedRequest {
    headers: HeaderMap,
    body: Value,
}

#[derive(Clone)]
struct FixtureState {
    sender: mpsc::UnboundedSender<CapturedRequest>,
    frames: Arc<Vec<String>>,
    errors: Arc<Mutex<VecDeque<Value>>>,
}

struct OpenAiFixture {
    base_url: String,
    requests: mpsc::UnboundedReceiver<CapturedRequest>,
    server: JoinHandle<()>,
}

impl OpenAiFixture {
    async fn new(reasoning_field: &str) -> Self {
        Self::with_frames(completion_frames(reasoning_field)).await
    }

    async fn with_frames(frames: Vec<String>) -> Self {
        Self::with_errors(Vec::new(), frames).await
    }

    async fn with_errors(errors: Vec<Value>, frames: Vec<String>) -> Self {
        let (sender, requests) = mpsc::unbounded_channel();
        let state = FixtureState {
            sender,
            frames: Arc::new(frames),
            errors: Arc::new(Mutex::new(errors.into())),
        };
        let app = Router::new()
            .route("/v1/chat/completions", post(capture_completion))
            .with_state(state);
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let base_url = format!("http://{}/v1", listener.local_addr().unwrap());
        let server = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        Self {
            base_url,
            requests,
            server,
        }
    }

    async fn request(&mut self) -> CapturedRequest {
        tokio::time::timeout(Duration::from_secs(5), self.requests.recv())
            .await
            .expect("adapter did not send a request")
            .expect("fixture stopped before receiving the request")
    }
}

impl Drop for OpenAiFixture {
    fn drop(&mut self) {
        self.server.abort();
    }
}

async fn capture_completion(
    State(state): State<FixtureState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    state
        .sender
        .send(CapturedRequest { headers, body })
        .unwrap();
    if let Some(error) = state.errors.lock().unwrap().pop_front() {
        return Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(error.to_string()))
            .unwrap();
    }
    let frames = state.frames.as_ref().clone();
    Response::builder()
        .header(header::CONTENT_TYPE, "text/event-stream")
        .body(Body::from_stream(stream::iter(
            frames.into_iter().map(Ok::<_, Infallible>),
        )))
        .unwrap()
}

fn completion_frames(reasoning_field: &str) -> Vec<String> {
    let mut reasoning = json!({"role": "assistant"});
    reasoning[reasoning_field] = json!("先分析");
    let mut more_reasoning = json!({"content": "计算结果"});
    more_reasoning[reasoning_field] = json!("再计算");
    let deltas = [
        reasoning,
        more_reasoning,
        json!({"tool_calls": [{
            "index": 0,
            "id": "call-result",
            "type": "function",
            "function": {
                "name": "calculator",
                "arguments": "{\"first_number\":"
            }
        }]}),
        json!({"tool_calls": [{
            "index": 0,
            "function": {
                "arguments": "1,\"second_number\":2,\"operator\":\"Add\"}"
            }
        }]}),
    ];
    let mut frames: Vec<String> = deltas
        .into_iter()
        .map(|delta| completion_frame(delta, Value::Null))
        .collect();
    frames.push(completion_frame(json!({}), json!("tool_calls")));
    frames.push(usage_frame());
    frames.push("data: [DONE]\n\n".to_string());
    frames
}

fn usage_frame() -> String {
    usage_frame_with(json!({
        "prompt_tokens": 13,
        "completion_tokens": 7,
        "total_tokens": 20
    }))
}

fn usage_frame_with(usage: Value) -> String {
    format!(
        "data: {}\n\n",
        json!({
            "id": "chatcmpl-fixture",
            "object": "chat.completion.chunk",
            "created": 0,
            "model": "fixture-model",
            "choices": [],
            "usage": usage
        })
    )
}

fn completion_frame(delta: Value, finish_reason: Value) -> String {
    format!(
        "data: {}\n\n",
        json!({
            "id": "chatcmpl-fixture",
            "object": "chat.completion.chunk",
            "created": 0,
            "model": "fixture-model",
            "choices": [{
                "index": 0,
                "delta": delta,
                "finish_reason": finish_reason
            }]
        })
    )
}

fn chat_request(
    fixture: &OpenAiFixture,
    provider: LLMProvider,
    thinking: bool,
    api_key: &str,
) -> ChatRequest {
    ChatRequest {
        system: vec!["回答用户的问题".to_string()],
        messages: vec![
            ChatMessage::user("先算 2 + 3"),
            ChatMessage::assistant_with_tool_calls_and_reasoning(
                "调用计算器",
                vec![ChatToolCall {
                    id: "call-history".to_string(),
                    name: "calculator".to_string(),
                    args: json!({"first_number": 2, "second_number": 3, "operator": "Add"}),
                }],
                Some("历史思考".to_string()),
            ),
            ChatMessage::tool("5", "call-history"),
            ChatMessage::user("再算 1 + 2"),
        ],
        tools: vec![Arc::new(CalculatorTool)],
        config: LLMConfig {
            provider,
            model: "fixture-model".to_string(),
            api_key: api_key.to_string(),
            base_url: Some(fixture.base_url.clone()),
            thinking,
            ..LLMConfig::default()
        },
        cancel: Signal::default(),
    }
}

async fn collect_events(request: &ChatRequest) -> Vec<LLMStreamEvent> {
    collect_results(request)
        .await
        .into_iter()
        .map(|event| event.expect("adapter rejected the fixture completion"))
        .collect()
}

async fn collect_results(request: &ChatRequest) -> Vec<anyhow::Result<LLMStreamEvent>> {
    let adapter = OpenAiAdapter;
    tokio::time::timeout(Duration::from_secs(5), async {
        adapter.stream(request).collect().await
    })
    .await
    .expect("adapter did not finish reading the SSE response")
}

#[tokio::test]
async fn page_snapshots_stay_before_their_users_without_rewriting_the_request_prefix() {
    for (provider, reasoning_field) in [
        (LLMProvider::OpenAI, "reasoning_content"),
        (LLMProvider::Ollama, "reasoning"),
    ] {
        let mut fixture = OpenAiFixture::new(reasoning_field).await;
        let mut request = chat_request(&fixture, provider, false, "fixture-secret");
        request.system = vec!["固定系统提示词".into(), "固定工具说明".into()];
        let old_context = r#"{"page":"playlist","id":100}"#;
        let new_context = r#"{"page":"album","id":200}"#;
        request.messages = vec![
            ChatMessage::context_snapshot(old_context),
            ChatMessage::user("介绍这个歌单"),
        ];
        collect_events(&request).await;
        let first = fixture.request().await.body;
        request.messages.extend([
            ChatMessage::assistant("第一轮回答"),
            ChatMessage::context_snapshot(new_context),
            ChatMessage::user("再介绍这个专辑"),
        ]);
        collect_events(&request).await;
        let second = fixture.request().await.body;

        let first_messages = first["messages"].as_array().unwrap();
        let messages = second["messages"].as_array().unwrap();
        assert_eq!(first_messages.len(), 3);
        assert_eq!(messages.len(), 6);
        assert_eq!(&messages[..first_messages.len()], first_messages.as_slice());
        assert_eq!(
            messages
                .iter()
                .map(|message| message["role"].as_str().unwrap())
                .collect::<Vec<_>>(),
            vec!["system", "system", "user", "assistant", "system", "user"]
        );
        assert_eq!(
            messages[0],
            json!({"role": "system", "content": "固定系统提示词\n\n固定工具说明"})
        );
        assert!(
            messages[1]["content"]
                .as_str()
                .unwrap()
                .contains(old_context)
        );
        assert_eq!(messages[2]["content"], "介绍这个歌单");
        assert_eq!(messages[3]["content"], "第一轮回答");
        assert!(
            messages[4]["content"]
                .as_str()
                .unwrap()
                .contains(new_context)
        );
        assert!(
            !messages[4]["content"]
                .as_str()
                .unwrap()
                .contains(old_context)
        );
        assert_eq!(messages[5]["content"], "再介绍这个专辑");
        assert_eq!(second["tools"], first["tools"]);
    }
}

fn assert_history(body: &Value, reasoning_field: &str) {
    assert_eq!(body["model"], "fixture-model");
    assert_eq!(body["stream"], true);
    assert_eq!(body["stream_options"]["include_usage"], true);
    assert_eq!(body["messages"][0]["role"], "system");
    assert_eq!(body["messages"][0]["content"], "回答用户的问题");
    let assistant = &body["messages"][2];
    assert_eq!(assistant["role"], "assistant");
    assert_eq!(assistant[reasoning_field], "历史思考");
    assert!(assistant.get("thinking").is_none());
    let call = &assistant["tool_calls"][0];
    assert_eq!(call["id"], "call-history");
    assert_eq!(call["type"], "function");
    assert_eq!(call["function"]["name"], "calculator");
    assert_eq!(
        serde_json::from_str::<Value>(call["function"]["arguments"].as_str().unwrap()).unwrap(),
        json!({"first_number": 2, "second_number": 3, "operator": "Add"})
    );
    let tool = &body["messages"][3];
    assert_eq!(tool["role"], "tool");
    assert_eq!(tool["tool_call_id"], "call-history");
    assert_eq!(tool["content"], "5");
    assert_eq!(body["tools"][0]["type"], "function");
    assert_eq!(body["tools"][0]["function"]["name"], "calculator");
    assert_eq!(body["tools"][0]["function"]["parameters"]["type"], "object");
}

fn assert_completion(events: &[LLMStreamEvent]) {
    let reasoning: String = events
        .iter()
        .filter_map(|event| match event {
            LLMStreamEvent::ReasoningDelta { delta } => Some(delta.as_str()),
            _ => None,
        })
        .collect();
    let text: String = events
        .iter()
        .filter_map(|event| match event {
            LLMStreamEvent::TextDelta { text } => Some(text.as_str()),
            _ => None,
        })
        .collect();
    let args: String = events
        .iter()
        .filter_map(|event| match event {
            LLMStreamEvent::ToolCallArgs { id, delta } if id == "call-result" => {
                Some(delta.as_str())
            }
            _ => None,
        })
        .collect();
    assert_eq!(reasoning, "先分析再计算");
    assert_eq!(text, "计算结果");
    assert_eq!(
        serde_json::from_str::<Value>(&args).unwrap(),
        json!({"first_number": 1, "second_number": 2, "operator": "Add"})
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| matches!(event, LLMStreamEvent::ReasoningStart))
            .count(),
        1
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| matches!(event, LLMStreamEvent::ReasoningEnd))
            .count(),
        1
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| matches!(event, LLMStreamEvent::TextStart))
            .count(),
        1
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| matches!(event, LLMStreamEvent::TextEnd))
            .count(),
        1
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| matches!(event, LLMStreamEvent::ToolCallStart { id, name } if id == "call-result" && name == "calculator"))
            .count(),
        1
    );
    assert_eq!(
        events
            .iter()
            .filter(
                |event| matches!(event, LLMStreamEvent::ToolCallEnd { id } if id == "call-result")
            )
            .count(),
        1
    );
    let usage: Vec<_> = events
        .iter()
        .filter_map(|event| match event {
            LLMStreamEvent::Usage(usage) => Some(usage),
            _ => None,
        })
        .collect();
    assert_eq!(
        usage,
        vec![&ChatUsage {
            prompt_tokens: 13,
            completion_tokens: 7,
            total_tokens: Some(20),
            ..ChatUsage::default()
        }]
    );
    assert!(matches!(
        events.last(),
        Some(LLMStreamEvent::Done { finish_reason: Some(reason) }) if reason == "tool_calls"
    ));
}

#[tokio::test]
async fn ollama_thinking_uses_compatible_fields_and_preserves_tool_history_without_a_key() {
    let mut fixture = OpenAiFixture::new("reasoning").await;
    let request = chat_request(&fixture, LLMProvider::Ollama, true, "");

    assert_completion(&collect_events(&request).await);
    let captured = fixture.request().await;
    assert!(!captured.headers.contains_key(header::AUTHORIZATION));
    assert_eq!(captured.body["reasoning_effort"], "medium");
    assert_eq!(captured.body["stream_options"]["include_usage"], true);
    assert!(captured.body.get("thinking").is_none());
    assert!(captured.body.get("think").is_none());
    assert_history(&captured.body, "reasoning");
    assert!(
        captured.body["messages"][2]
            .get("reasoning_content")
            .is_none()
    );
}

#[tokio::test]
async fn ollama_thinking_off_is_explicit_and_proxy_keys_still_use_bearer_authentication() {
    let mut fixture = OpenAiFixture::new("reasoning_content").await;
    let request = chat_request(&fixture, LLMProvider::Ollama, false, "proxy-secret");

    assert_completion(&collect_events(&request).await);
    let captured = fixture.request().await;
    assert_eq!(
        captured.headers.get(header::AUTHORIZATION).unwrap(),
        "Bearer proxy-secret"
    );
    assert_eq!(captured.body["reasoning_effort"], "none");
    assert!(captured.body.get("thinking").is_none());
    assert!(captured.body.get("think").is_none());
    assert_history(&captured.body, "reasoning");
}

#[tokio::test]
async fn openai_keeps_its_existing_thinking_and_reasoning_content_protocol() {
    for thinking in [true, false] {
        let mut fixture = OpenAiFixture::new("reasoning_content").await;
        let request = chat_request(&fixture, LLMProvider::OpenAI, thinking, "openai-secret");

        assert_completion(&collect_events(&request).await);
        let captured = fixture.request().await;
        assert_eq!(
            captured.headers.get(header::AUTHORIZATION).unwrap(),
            "Bearer openai-secret"
        );
        if thinking {
            assert_eq!(captured.body["thinking"], json!({"type": "enabled"}));
        } else {
            assert!(captured.body.get("thinking").is_none());
        }
        assert!(captured.body.get("reasoning_effort").is_none());
        assert!(captured.body.get("think").is_none());
        assert_history(&captured.body, "reasoning_content");
        assert!(captured.body["messages"][2].get("reasoning").is_none());
    }
}

#[tokio::test]
async fn preserves_standard_usage_details_and_nested_cache_write_tokens() {
    let fixture = OpenAiFixture::with_frames(vec![
        completion_frame(json!({"content": "回复"}), json!("stop")),
        usage_frame_with(json!({
            "prompt_tokens": 13,
            "completion_tokens": 7,
            "total_tokens": 20,
            "prompt_tokens_details": {"cached_tokens": 5, "cache_write_tokens": 2},
            "completion_tokens_details": {"reasoning_tokens": 3},
            "cache_write_tokens": 9
        })),
        "data: [DONE]\n\n".to_string(),
    ])
    .await;
    let request = chat_request(&fixture, LLMProvider::OpenAI, true, "");

    let events = collect_events(&request).await;
    let usage = events.iter().find_map(|event| match event {
        LLMStreamEvent::Usage(usage) => Some(usage),
        _ => None,
    });
    assert_eq!(
        usage,
        Some(&ChatUsage {
            prompt_tokens: 13,
            completion_tokens: 7,
            total_tokens: Some(20),
            cached_tokens: Some(5),
            cache_write_tokens: Some(2),
            reasoning_tokens: Some(3),
        })
    );
}

#[tokio::test]
async fn preserves_zero_and_unknown_details_and_prefers_standard_cache_counts() {
    for (details, cached_tokens, cache_write_tokens, reasoning_tokens) in [
        (
            json!({
                "prompt_tokens_details": {"cached_tokens": 5},
                "prompt_cache_hit_tokens": 9
            }),
            Some(5),
            None,
            None,
        ),
        (
            json!({
                "prompt_tokens_details": {"cached_tokens": 0, "cache_write_tokens": 0},
                "completion_tokens_details": {"reasoning_tokens": 0},
                "prompt_cache_hit_tokens": 9,
                "cache_write_tokens": 9
            }),
            Some(0),
            Some(0),
            Some(0),
        ),
        (
            json!({
                "prompt_tokens_details": {"cached_tokens": null},
                "prompt_cache_hit_tokens": 8,
                "prompt_cache_miss_tokens": 5
            }),
            Some(8),
            None,
            None,
        ),
        (
            json!({"prompt_cache_hit_tokens": 0, "prompt_cache_miss_tokens": 13}),
            Some(0),
            None,
            None,
        ),
        (json!({"prompt_cache_miss_tokens": 13}), None, None, None),
        (json!({"cache_write_tokens": 4}), None, Some(4), None),
        (
            json!({
                "prompt_tokens_details": {"cache_write_tokens": null},
                "cache_write_tokens": 3
            }),
            None,
            Some(3),
            None,
        ),
        (
            json!({
                "prompt_tokens_details": null,
                "completion_tokens_details": null,
                "prompt_cache_hit_tokens": null,
                "cache_write_tokens": null
            }),
            None,
            None,
            None,
        ),
        (
            json!({"prompt_cache_hit_tokens": -1, "cache_write_tokens": 4294967296_u64}),
            None,
            None,
            None,
        ),
    ] {
        let mut usage = json!({
            "prompt_tokens": 13,
            "completion_tokens": 7,
            "total_tokens": 20
        });
        usage
            .as_object_mut()
            .unwrap()
            .extend(details.as_object().unwrap().clone());
        let fixture = OpenAiFixture::with_frames(vec![
            completion_frame(json!({"content": "回复"}), json!("stop")),
            usage_frame_with(usage),
            "data: [DONE]\n\n".to_string(),
        ])
        .await;
        let request = chat_request(&fixture, LLMProvider::OpenAI, false, "");

        let events = collect_events(&request).await;
        let reported = events.iter().find_map(|event| match event {
            LLMStreamEvent::Usage(usage) => Some(usage),
            _ => None,
        });
        assert_eq!(
            reported,
            Some(&ChatUsage {
                prompt_tokens: 13,
                completion_tokens: 7,
                total_tokens: Some(20),
                cached_tokens,
                cache_write_tokens,
                reasoning_tokens,
            }),
            "usage details: {details}"
        );
    }
}

#[tokio::test]
async fn forwards_reported_usage_snapshots_without_adding_them_together() {
    let fixture = OpenAiFixture::with_frames(vec![
        completion_frame(json!({"content": "回复"}), Value::Null),
        usage_frame_with(json!({
            "prompt_tokens": 13,
            "completion_tokens": 3,
            "total_tokens": 16
        })),
        completion_frame(json!({}), json!("stop")),
        usage_frame(),
        usage_frame(),
        "data: [DONE]\n\n".to_string(),
    ])
    .await;
    let request = chat_request(&fixture, LLMProvider::OpenAI, false, "");

    let events = collect_events(&request).await;
    let usage: Vec<_> = events
        .iter()
        .filter_map(|event| match event {
            LLMStreamEvent::Usage(usage) => Some(usage.clone()),
            _ => None,
        })
        .collect();
    let expected = ChatUsage {
        prompt_tokens: 13,
        completion_tokens: 7,
        total_tokens: Some(20),
        ..ChatUsage::default()
    };
    assert_eq!(
        usage,
        vec![
            ChatUsage {
                prompt_tokens: 13,
                completion_tokens: 3,
                total_tokens: Some(16),
                ..ChatUsage::default()
            },
            expected.clone(),
            expected
        ]
    );
}

fn assert_rejected(events: &[anyhow::Result<LLMStreamEvent>], reason: &str) {
    assert!(
        events
            .last()
            .unwrap()
            .as_ref()
            .unwrap_err()
            .to_string()
            .contains(reason)
    );
    assert_eq!(events.iter().filter(|event| event.is_err()).count(), 1);
    assert!(
        !events
            .iter()
            .any(|event| matches!(event, Ok(LLMStreamEvent::Done { .. })))
    );
}

#[tokio::test]
async fn explicitly_unsupported_stream_options_retry_once_without_changing_the_chat_request() {
    for error in [
        json!({"error": {
            "param": "stream_options", "code": "unsupported_parameter",
            "message": "This parameter is unavailable"
        }}),
        json!({"error": {
            "message": "Unrecognized request argument supplied: stream_options"
        }}),
        json!({"error": {
            "message": "unknown field `stream_options`, expected `model` or `messages`"
        }}),
    ] {
        let mut fixture = OpenAiFixture::with_errors(
            vec![error],
            vec![
                completion_frame(json!({"content": "兼容回复"}), json!("stop")),
                "data: [DONE]\n\n".into(),
            ],
        )
        .await;
        let request = chat_request(&fixture, LLMProvider::OpenAI, false, "secret");
        let events = collect_events(&request).await;
        let first = fixture.request().await;
        let second = fixture.request().await;
        assert_eq!(first.body["stream_options"]["include_usage"], true);
        let mut expected = first.body;
        expected.as_object_mut().unwrap().remove("stream_options");
        assert_eq!(second.body, expected);
        assert_eq!(
            second.headers.get(header::AUTHORIZATION),
            first.headers.get(header::AUTHORIZATION)
        );
        assert_eq!(
            second.headers.get(header::CONTENT_TYPE),
            first.headers.get(header::CONTENT_TYPE)
        );
        assert!(fixture.requests.try_recv().is_err());
        assert!(events.iter().any(|event| matches!(
            event, LLMStreamEvent::TextDelta { text } if text == "兼容回复"
        )));
        assert!(matches!(events.last(), Some(LLMStreamEvent::Done { .. })));
        assert!(
            !events
                .iter()
                .any(|event| matches!(event, LLMStreamEvent::Usage(_)))
        );
    }
}

#[tokio::test]
async fn unrelated_bad_requests_are_not_retried_or_rewritten() {
    for error in [
        json!({"error": {"param": "model", "code": "unsupported_parameter", "message": "model unavailable"}}),
        json!({"error": {"param": "stream_options", "code": "invalid_value", "message": "invalid configuration"}}),
        json!({"error": {"message": "request validation failed"}}),
    ] {
        let mut fixture = OpenAiFixture::with_errors(vec![error], Vec::new()).await;
        let request = chat_request(&fixture, LLMProvider::OpenAI, false, "");
        let events = collect_results(&request).await;
        assert_rejected(&events, "400");
        assert_eq!(
            fixture.request().await.body["stream_options"]["include_usage"],
            true
        );
        assert!(fixture.requests.try_recv().is_err());
    }
}

#[tokio::test]
async fn a_failed_usage_fallback_stops_after_the_second_http_request() {
    let error = json!({"error": {
        "param": "stream_options", "code": "unsupported_parameter", "message": "unsupported"
    }});
    let mut fixture = OpenAiFixture::with_errors(vec![error.clone(), error], Vec::new()).await;
    let request = chat_request(&fixture, LLMProvider::OpenAI, false, "");
    let events = collect_results(&request).await;
    assert_rejected(&events, "400");
    assert!(fixture.request().await.body.get("stream_options").is_some());
    assert!(fixture.request().await.body.get("stream_options").is_none());
    assert!(fixture.requests.try_recv().is_err());
}

#[tokio::test]
async fn rejects_invalid_json_instead_of_skipping_to_a_later_terminal_event() {
    let fixture = OpenAiFixture::with_frames(vec![
        "data: {not json}\n\n".to_string(),
        completion_frame(json!({"content": "不应收到"}), json!("stop")),
        "data: [DONE]\n\n".to_string(),
    ])
    .await;
    let request = chat_request(&fixture, LLMProvider::OpenAI, false, "");

    let events = collect_results(&request).await;
    assert_rejected(&events, "SSE 解析失败");
    assert!(
        !events
            .iter()
            .any(|event| matches!(event, Ok(LLMStreamEvent::TextDelta { .. })))
    );
}

#[tokio::test]
async fn rejects_invalid_typed_chunks_instead_of_skipping_them() {
    let fixture = OpenAiFixture::with_frames(vec![
        completion_frame(json!({"content": 123}), Value::Null),
        completion_frame(json!({"content": "不应收到"}), json!("stop")),
        "data: [DONE]\n\n".to_string(),
    ])
    .await;
    let request = chat_request(&fixture, LLMProvider::OpenAI, false, "");

    let events = collect_results(&request).await;
    assert_rejected(&events, "无效的流事件");
    assert!(
        !events
            .iter()
            .any(|event| matches!(event, Ok(LLMStreamEvent::TextDelta { .. })))
    );
}

#[tokio::test]
async fn rejects_eof_and_done_markers_without_an_explicit_finish_reason() {
    for frames in [
        vec![],
        vec![completion_frame(
            json!({"content": "半截回复"}),
            Value::Null,
        )],
        vec!["data: [DONE]\n\n".to_string()],
        vec![
            completion_frame(json!({"reasoning_content": "还在分析"}), Value::Null),
            usage_frame(),
            "data: [DONE]\n\n".to_string(),
        ],
    ] {
        let fixture = OpenAiFixture::with_frames(frames).await;
        let request = chat_request(&fixture, LLMProvider::OpenAI, false, "");

        assert_rejected(&collect_results(&request).await, "缺少 finish_reason");
    }
}

#[tokio::test]
async fn rejects_incomplete_sse_events_even_after_a_finish_reason() {
    for initial_frames in [
        vec![],
        vec![completion_frame(json!({"content": "回复"}), json!("stop"))],
    ] {
        let mut frames = initial_frames;
        frames.push("data: {\"choices\":".to_string());
        let fixture = OpenAiFixture::with_frames(frames).await;
        let request = chat_request(&fixture, LLMProvider::OpenAI, false, "");

        assert_rejected(&collect_results(&request).await, "SSE 事件未完整结束");
    }
}

#[tokio::test]
async fn preserves_explicit_finish_reasons_and_trailing_usage_without_a_done_marker() {
    for reason in [
        "stop",
        "tool_calls",
        "function_call",
        "length",
        "content_filter",
    ] {
        let fixture = OpenAiFixture::with_frames(vec![
            completion_frame(json!({"content": "已输出的内容"}), Value::Null),
            completion_frame(json!({}), json!(reason)),
            usage_frame(),
        ])
        .await;
        let request = chat_request(&fixture, LLMProvider::OpenAI, false, "");

        let events = collect_events(&request).await;
        assert!(events.iter().any(|event| matches!(
            event, LLMStreamEvent::TextDelta { text } if text == "已输出的内容"
        )));
        assert!(events.iter().any(|event| matches!(
            event, LLMStreamEvent::Usage(usage)
                if usage.prompt_tokens == 13 && usage.completion_tokens == 7
        )));
        assert!(matches!(
            events.last(), Some(LLMStreamEvent::Done { finish_reason: Some(actual) })
                if actual == reason
        ));
    }
}

#[tokio::test]
async fn allows_trailing_comments_and_metadata_without_data_at_eof() {
    for tail in [": heartbeat\n", "event: message\nid: last\nretry: 1000\n"] {
        let fixture = OpenAiFixture::with_frames(vec![
            completion_frame(json!({"content": "完整回复"}), json!("stop")),
            tail.to_string(),
        ])
        .await;
        let request = chat_request(&fixture, LLMProvider::OpenAI, false, "");

        let events = collect_events(&request).await;
        assert!(matches!(
            events.last(), Some(LLMStreamEvent::Done { finish_reason: Some(reason) })
                if reason == "stop"
        ));
    }
}

#[test]
fn rejects_incomplete_data_and_invalid_utf8_after_metadata() {
    for tail in [
        b": heartbeat\ndata".as_slice(),
        b"event: message\ndata: {".as_slice(),
        b": heartbeat \xff".as_slice(),
    ] {
        let mut decoder = LLMSSEDecoder::open_ai();
        assert!(decoder.feed(tail).unwrap().is_empty());
        assert!(decoder.finish().is_err());
    }
}
