use agent::ctx::Ctx;
use agent::llm::models::{
    ChatMessage, ChatRequest, ChatRole, ChatRoleInnerType, ChatTurnUsage, ChatUsage, LLMAdapter,
    LLMConfig, LLMProvider, LLMStream, LLMStreamEvent,
};
use agent::llm::plugins::{
    LLMAdapterManager, LLMCompactor, LLMCompactorConfig, LLMCompactorPlugin, LLMConfigManager,
    LLMConfigPlugin, LLMPlugin,
};
use agent::r#loop::models::{
    LoopDecision, LoopEvent, LoopPayloadError, LoopPayloadRequest, LoopPayloadToolResult,
    LoopPayloadTurnEnd, LoopPhase,
};
use agent::r#loop::{LoopConfig, LoopService};
use agent::mcp::{MCPPlugin, MCPService};
use agent::plugins::models::PluginMeta;
use agent::prompt::{PromptPlugin, PromptRegistry};
use agent::session::models::SessionId;
use agent::session::{SessionManager, SessionPlugin};
use agent::tools::models::{Tool, ToolRunContext};
use agent::tools::{ToolRegistry, ToolsPlugin};
use agent::utils::Signal;
use futures::stream;
use serde_json::{Value, json};
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::Notify;

struct ScriptAdapter {
    steps: Mutex<VecDeque<Vec<LLMStreamEvent>>>,
    requests: Arc<Mutex<Vec<ChatRequest>>>,
}

impl LLMAdapter for ScriptAdapter {
    fn stream<'a>(&'a self, request: &'a ChatRequest) -> LLMStream<'a> {
        self.requests.lock().unwrap().push(request.clone());
        let events = self.steps.lock().unwrap().pop_front();
        Box::pin(stream::iter(match events {
            Some(events) => events.into_iter().map(Ok).collect(),
            None => vec![Err(anyhow::anyhow!("unexpected model request"))],
        }))
    }
}

#[derive(Default)]
struct TestTool {
    calls: AtomicUsize,
    waiting: Notify,
    dropped: Arc<AtomicBool>,
}

struct PendingCall(Arc<AtomicBool>);

impl Drop for PendingCall {
    fn drop(&mut self) {
        self.0.store(true, Ordering::SeqCst);
    }
}

#[async_trait::async_trait]
impl Tool for TestTool {
    fn name(&self) -> &str {
        "query"
    }

    fn description(&self) -> &str {
        "test query"
    }

    fn parameters(&self) -> Value {
        json!({"type": "object"})
    }

    async fn run(&self, args: Value, _ctx: &ToolRunContext) -> anyhow::Result<Value> {
        let count = self.calls.fetch_add(1, Ordering::SeqCst) + 1;
        if args["wait"] == true {
            let _pending = PendingCall(self.dropped.clone());
            self.waiting.notify_one();
            return std::future::pending().await;
        }
        if args["fail"] == true {
            anyhow::bail!("validation: id must be a positive integer");
        }
        if args["changing"] == true {
            return Ok(json!({"progress": count}));
        }
        Ok(json!({"id": 1, "name": "相同资源"}))
    }
}

struct LoopFixture {
    ctx: Arc<Ctx>,
    service: Arc<LoopService>,
    session: SessionId,
    sessions: Arc<SessionManager>,
    requests: Arc<Mutex<Vec<ChatRequest>>>,
    results: Arc<Mutex<Vec<LoopPayloadToolResult>>>,
    errors: Arc<Mutex<Vec<LoopPayloadError>>>,
    ends: Arc<Mutex<Vec<LoopPayloadTurnEnd>>>,
    tool: Arc<TestTool>,
}

impl LoopFixture {
    fn new(steps: Vec<Vec<LLMStreamEvent>>) -> Self {
        let ctx = Arc::new(Ctx::new());
        ctx.effect(SessionPlugin::register_service(&ctx, SessionManager::new()).unwrap());
        ctx.effect(ToolsPlugin::register_service(&ctx, ToolRegistry::new()).unwrap());
        ctx.effect(PromptPlugin::register_service(&ctx, PromptRegistry::new()).unwrap());
        ctx.effect(LLMConfigPlugin::register_service(&ctx, LLMConfigManager::new()).unwrap());
        ctx.effect(
            LLMCompactorPlugin::register_service(
                &ctx,
                LLMCompactor::new(LLMCompactorConfig {
                    keep: 10,
                    threshold: 0.9,
                }),
            )
            .unwrap(),
        );
        let tools = ToolsPlugin::get_service(&ctx).unwrap();
        ctx.effect(MCPPlugin::register_service(&ctx, MCPService::new(tools.clone())).unwrap());
        let requests = Arc::new(Mutex::new(Vec::new()));
        let adapters = LLMAdapterManager::new();
        adapters.providers.lock().unwrap().insert(
            LLMProvider::OpenAI,
            Arc::new(ScriptAdapter {
                steps: Mutex::new(steps.into()),
                requests: requests.clone(),
            }),
        );
        ctx.effect(LLMPlugin::register_service(&ctx, adapters).unwrap());
        let tool = Arc::new(TestTool::default());
        ctx.effect(tools.register(tool.clone()).unwrap());
        let sessions = SessionPlugin::get_service(&ctx).unwrap();
        let session = sessions.create_session();
        LLMConfigPlugin::get_service(&ctx)
            .unwrap()
            .set_session_config(
                &session,
                LLMConfig {
                    model: "script-model".to_string(),
                    ..LLMConfig::default()
                },
            )
            .unwrap();
        let results = Arc::new(Mutex::new(Vec::new()));
        let captured = results.clone();
        ctx.effect(
            ctx.on::<LoopPayloadToolResult>(LoopEvent::ToolResult, move |payload| {
                captured.lock().unwrap().push(payload.clone());
            }),
        );
        let errors = Arc::new(Mutex::new(Vec::new()));
        let captured = errors.clone();
        ctx.effect(
            ctx.on::<LoopPayloadError>(LoopEvent::Error, move |payload| {
                captured.lock().unwrap().push(payload.clone());
            }),
        );
        let ends = Arc::new(Mutex::new(Vec::new()));
        let captured = ends.clone();
        ctx.effect(
            ctx.on::<LoopPayloadTurnEnd>(LoopEvent::TurnEnd, move |payload| {
                captured.lock().unwrap().push(payload.clone());
            }),
        );
        let service = Arc::new(LoopService::new(
            &ctx,
            LoopConfig {
                max_steps_per_turn: 100,
            },
        ));
        Self {
            ctx,
            service,
            session,
            sessions,
            requests,
            results,
            errors,
            ends,
            tool,
        }
    }

    async fn run(&self) {
        let handle = self.service.send(
            self.session.clone(),
            "run-progress".to_string(),
            ChatMessage::user("处理当前资源"),
            Signal::default(),
        );
        tokio::time::timeout(Duration::from_secs(5), handle.completed())
            .await
            .expect("tool loop did not stop");
    }

    fn messages(&self) -> Vec<ChatMessage> {
        self.sessions.real_messages(&self.session)
    }
}

impl Drop for LoopFixture {
    fn drop(&mut self) {
        self.service.stop();
        self.ctx.dispose();
    }
}

fn tool_step(calls: Vec<(&str, Value)>, step: usize) -> Vec<LLMStreamEvent> {
    let mut events = vec![];
    for (index, (name, args)) in calls.into_iter().enumerate() {
        let id = format!("call-{step}-{index}");
        events.extend([
            LLMStreamEvent::ToolCallStart {
                id: id.clone(),
                name: name.to_string(),
            },
            LLMStreamEvent::ToolCallArgs {
                id: id.clone(),
                delta: args.to_string(),
            },
            LLMStreamEvent::ToolCallEnd { id },
        ]);
    }
    events.push(LLMStreamEvent::Usage(ChatUsage {
        prompt_tokens: 13,
        completion_tokens: 7,
        ..ChatUsage::default()
    }));
    events.push(LLMStreamEvent::Done {
        finish_reason: Some("tool_calls".to_string()),
    });
    events
}

fn final_step() -> Vec<LLMStreamEvent> {
    vec![
        LLMStreamEvent::TextDelta {
            text: "已完成".to_string(),
        },
        LLMStreamEvent::Done {
            finish_reason: Some("stop".to_string()),
        },
    ]
}

#[tokio::test]
async fn requests_without_usage_are_counted_and_the_last_request_step_is_preserved() {
    let fixture = LoopFixture::new(vec![
        tool_step(vec![("test-tool", json!({}))], 1),
        final_step(),
    ]);
    fixture.run().await;
    let ends = fixture.ends.lock().unwrap();
    let usage = serde_json::to_value(&ends[0].usages).unwrap();
    assert_eq!(usage["requests"], 2);
    assert_eq!(usage["last_step"], 2);
    assert_eq!(usage["records"].as_array().unwrap().len(), 1);
    assert_eq!(usage["records"][0]["step"], 1);
    assert_eq!(fixture.requests.lock().unwrap().len(), 2);
    let stored = fixture
        .messages()
        .into_iter()
        .find(|message| message.inner_type == Some(ChatRoleInnerType::Usage))
        .unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&stored.content).unwrap(),
        usage
    );
}

#[tokio::test]
async fn a_request_denied_before_the_adapter_is_not_counted() {
    let fixture = LoopFixture::new(vec![]);
    fixture
        .ctx
        .effect(fixture.ctx.on_veto::<LoopPayloadRequest, LoopDecision>(
            LoopEvent::Request,
            |_| {
                Some(LoopDecision::Deny {
                    reason: "denied".into(),
                })
            },
        ));
    fixture.run().await;
    assert!(fixture.requests.lock().unwrap().is_empty());
    let ends = fixture.ends.lock().unwrap();
    let usage = serde_json::to_value(&ends[0].usages).unwrap();
    assert_eq!(usage["requests"], 0);
    assert!(usage.get("last_step").is_none());
    assert_eq!(usage["records"], json!([]));
}

#[tokio::test]
async fn failed_setup_or_compaction_preserves_one_context_user_pair() {
    for missing_provider in [true, false] {
        let fixture = LoopFixture::new(vec![]);
        if missing_provider {
            LLMPlugin::get_service(&fixture.ctx)
                .unwrap()
                .providers
                .lock()
                .unwrap()
                .remove(&LLMProvider::OpenAI);
        } else {
            LLMConfigPlugin::get_service(&fixture.ctx)
                .unwrap()
                .set_session_config(
                    &fixture.session,
                    LLMConfig {
                        model: "script-model".into(),
                        context_size: agent::llm::models::LLMContextSize::Custom(16),
                        ..LLMConfig::default()
                    },
                )
                .unwrap();
        }
        let context = r#"{"page":"album","id":123}"#;
        let handle = fixture.service.send_with_context(
            fixture.session.clone(),
            "context-error-run".into(),
            ChatMessage::user("介绍这个专辑"),
            Signal::default(),
            Some(context.into()),
        );
        tokio::time::timeout(Duration::from_secs(2), handle.completed())
            .await
            .unwrap();
        let messages = fixture.messages();
        assert_eq!(messages[0], ChatMessage::context_snapshot(context));
        assert_eq!(messages[1], ChatMessage::user("介绍这个专辑"));
        assert_eq!(
            messages
                .iter()
                .filter(|message| message.is_context_snapshot())
                .count(),
            1
        );
        assert_eq!(
            messages
                .iter()
                .filter(|message| message.role == ChatRole::User)
                .count(),
            1
        );
        assert!(
            messages
                .iter()
                .any(|message| message.inner_type == Some(ChatRoleInnerType::Error))
        );
        assert!(fixture.requests.lock().unwrap().is_empty());
    }
}

#[tokio::test]
async fn abnormal_model_endings_preserve_partial_reply_and_report_a_persisted_reason() {
    for (reason, expected) in [
        (Some("length"), "输出长度上限"),
        (Some("content_filter"), "内容过滤"),
        (Some("unexpected"), "未预期的原因"),
        (Some("tool_calls"), "未返回有效工具调用"),
        (None, "未提供结束原因"),
    ] {
        let fixture = LoopFixture::new(vec![vec![
            LLMStreamEvent::TextDelta {
                text: "《雪之舞》的旋律".into(),
            },
            LLMStreamEvent::Usage(ChatUsage {
                prompt_tokens: 101,
                completion_tokens: 17,
                ..ChatUsage::default()
            }),
            LLMStreamEvent::Done {
                finish_reason: reason.map(str::to_string),
            },
        ]]);
        fixture.run().await;
        let messages = fixture.messages();
        assert!(
            messages
                .iter()
                .any(|message| message.content == "《雪之舞》的旋律")
        );
        assert!(messages.iter().any(|message| message.inner_type
            == Some(ChatRoleInnerType::Error)
            && message.content.contains(expected)));
        assert_eq!(fixture.errors.lock().unwrap().len(), 1);
        let ends = fixture.ends.lock().unwrap();
        assert_eq!(ends.len(), 1);
        assert_eq!(ends[0].cause.phase, LoopPhase::Error);
        assert!(ends[0].cause.reason.contains(expected));
        let mut usage = ChatTurnUsage::tracked();
        usage.request_started(1);
        usage.add((
            1,
            ChatUsage {
                prompt_tokens: 101,
                completion_tokens: 17,
                ..ChatUsage::default()
            },
        ));
        assert_eq!(ends[0].usages, usage);
    }
}

#[tokio::test]
async fn empty_or_reasoning_only_responses_do_not_complete_a_turn_successfully() {
    for reasoning in ["", "需要说明没有找到歌词，不能编造原文"] {
        let fixture = LoopFixture::new(vec![
            tool_step(
                vec![(
                    "aira-music__tool-album-lyrics",
                    json!({"id": "5.1103689e+07"}),
                )],
                1,
            ),
            vec![
                LLMStreamEvent::ReasoningDelta {
                    delta: reasoning.into(),
                },
                LLMStreamEvent::Usage(ChatUsage {
                    prompt_tokens: 25540,
                    completion_tokens: 116,
                    ..ChatUsage::default()
                }),
                LLMStreamEvent::Done {
                    finish_reason: Some("stop".into()),
                },
            ],
        ]);
        fixture.run().await;
        let messages = fixture.messages();
        assert_eq!(fixture.requests.lock().unwrap().len(), 2);
        assert!(messages.iter().any(|message| message.inner_type
            == Some(ChatRoleInnerType::Error)
            && message.content.contains("未返回")));
        if !reasoning.is_empty() {
            assert!(
                messages
                    .iter()
                    .any(|message| message.reasoning_content.as_deref() == Some(reasoning))
            );
            assert!(
                fixture.errors.lock().unwrap()[0]
                    .error
                    .contains("仅返回思考内容")
            );
        }
        assert_eq!(
            fixture.ends.lock().unwrap()[0].cause.phase,
            LoopPhase::Error
        );
        assert_eq!(
            messages.last().unwrap().inner_type,
            Some(ChatRoleInnerType::Usage)
        );
    }
}

#[tokio::test]
async fn premature_model_eof_does_not_hide_a_partial_answer() {
    let fixture = LoopFixture::new(vec![vec![LLMStreamEvent::TextDelta {
        text: "尚未写完的回答".into(),
    }]]);
    fixture.run().await;
    assert!(
        fixture
            .messages()
            .iter()
            .any(|message| message.content == "尚未写完的回答")
    );
    assert!(
        fixture.errors.lock().unwrap()[0]
            .error
            .contains("未收到完成信号")
    );
    assert_eq!(
        fixture.ends.lock().unwrap()[0].cause.phase,
        LoopPhase::Error
    );
}

#[tokio::test]
async fn a_stream_error_preserves_received_text_and_reported_usage() {
    struct FailingAdapter;
    impl LLMAdapter for FailingAdapter {
        fn stream<'a>(&'a self, _request: &'a ChatRequest) -> LLMStream<'a> {
            Box::pin(stream::iter(vec![
                Ok(LLMStreamEvent::TextDelta {
                    text: "这段已经显示的回答".into(),
                }),
                Ok(LLMStreamEvent::Usage(ChatUsage {
                    prompt_tokens: 123,
                    completion_tokens: 45,
                    ..ChatUsage::default()
                })),
                Err(anyhow::anyhow!("connection reset")),
            ]))
        }
    }
    let fixture = LoopFixture::new(Vec::new());
    LLMPlugin::get_service(&fixture.ctx)
        .unwrap()
        .providers
        .lock()
        .unwrap()
        .insert(LLMProvider::OpenAI, Arc::new(FailingAdapter));
    fixture.run().await;
    assert!(
        fixture
            .messages()
            .iter()
            .any(|message| message.content == "这段已经显示的回答")
    );
    assert!(
        fixture.errors.lock().unwrap()[0]
            .error
            .contains("connection reset")
    );
    let mut expected = ChatTurnUsage::tracked();
    expected.request_started(1);
    expected.add((
        1,
        ChatUsage {
            prompt_tokens: 123,
            completion_tokens: 45,
            ..ChatUsage::default()
        },
    ));
    assert_eq!(fixture.ends.lock().unwrap()[0].usages, expected);
}

#[tokio::test]
async fn cancelling_during_generation_preserves_partial_text_reasoning_and_usage() {
    struct PendingAdapter(Arc<Notify>);
    impl LLMAdapter for PendingAdapter {
        fn stream<'a>(&'a self, _request: &'a ChatRequest) -> LLMStream<'a> {
            Box::pin(async_stream::stream! {
                yield Ok(LLMStreamEvent::TextDelta { text: "已经显示的末次回复".into() });
                yield Ok(LLMStreamEvent::ReasoningDelta { delta: "已经产生的思考".into() });
                yield Ok(LLMStreamEvent::Usage(ChatUsage { prompt_tokens: 123, completion_tokens: 45, ..ChatUsage::default() }));
                self.0.notify_one();
                std::future::pending::<()>().await;
            })
        }
    }
    let fixture = LoopFixture::new(Vec::new());
    let ready = Arc::new(Notify::new());
    LLMPlugin::get_service(&fixture.ctx)
        .unwrap()
        .providers
        .lock()
        .unwrap()
        .insert(LLMProvider::OpenAI, Arc::new(PendingAdapter(ready.clone())));
    let cancel = Signal::default();
    let handle = fixture.service.send(
        fixture.session.clone(),
        "run-cancel-partial".into(),
        ChatMessage::user("继续"),
        cancel.clone(),
    );
    tokio::time::timeout(Duration::from_secs(1), ready.notified())
        .await
        .unwrap();
    cancel.abort();
    tokio::time::timeout(Duration::from_secs(1), handle.completed())
        .await
        .unwrap();
    let messages = fixture.messages();
    assert!(
        messages
            .iter()
            .any(|message| message.content == "已经显示的末次回复"
                && message.reasoning_content.as_deref() == Some("已经产生的思考"))
    );
    assert!(
        messages.iter().any(
            |message| message.role == ChatRole::System && message.content == "[cancel]: 已取消"
        )
    );
    assert!(fixture.errors.lock().unwrap().is_empty());
    let ends = fixture.ends.lock().unwrap();
    assert_eq!(ends[0].cause.phase, LoopPhase::Cancel);
    let mut expected = ChatTurnUsage::tracked();
    expected.request_started(1);
    expected.add((
        1,
        ChatUsage {
            prompt_tokens: 123,
            completion_tokens: 45,
            ..ChatUsage::default()
        },
    ));
    assert_eq!(ends[0].usages, expected);
}

#[tokio::test]
async fn an_incomplete_tool_fragment_does_not_execute_a_tool_or_report_success() {
    let fixture = LoopFixture::new(vec![vec![
        LLMStreamEvent::TextDelta {
            text: "准备查询".into(),
        },
        LLMStreamEvent::ToolCallStart {
            id: "partial-call".into(),
            name: "query".into(),
        },
        LLMStreamEvent::ToolCallArgs {
            id: "partial-call".into(),
            delta: "{\"id\":".into(),
        },
        LLMStreamEvent::Done {
            finish_reason: Some("tool_calls".into()),
        },
    ]]);
    fixture.run().await;
    assert_eq!(fixture.tool.calls.load(Ordering::SeqCst), 0);
    assert!(
        fixture.errors.lock().unwrap()[0]
            .error
            .contains("工具调用输出不完整")
    );
    assert!(
        fixture
            .messages()
            .iter()
            .any(|message| message.content == "准备查询" && message.tool_calls.is_empty())
    );
}

#[tokio::test]
async fn truncated_tool_calls_are_not_executed_and_have_matching_failure_results() {
    let mut events = tool_step(vec![("query", json!({"id": 1}))], 1);
    events.pop();
    events.push(LLMStreamEvent::Done {
        finish_reason: Some("length".into()),
    });
    let fixture = LoopFixture::new(vec![events]);
    fixture.run().await;
    assert_eq!(fixture.tool.calls.load(Ordering::SeqCst), 0);
    let messages = fixture.messages();
    assert!(
        messages
            .iter()
            .any(|message| message.role == ChatRole::Assistant && message.tool_calls.len() == 1)
    );
    assert!(messages.iter().any(|message| message.role == ChatRole::Tool
        && message.tool_call_id.as_deref() == Some("call-1-0")
        && message.content.contains("未执行")));
    assert!(
        fixture.errors.lock().unwrap()[0]
            .error
            .contains("输出长度上限")
    );
}

#[tokio::test]
async fn stops_after_three_all_failed_steps_and_preserves_every_tool_result() {
    let fixture = LoopFixture::new(
        (0..4)
            .map(|step| {
                tool_step(
                    vec![
                        ("aira-music__agent-album-star", json!({"id": step})),
                        ("query", json!({"fail": true, "id": step})),
                    ],
                    step,
                )
            })
            .collect(),
    );
    fixture.run().await;

    assert_eq!(fixture.requests.lock().unwrap().len(), 3);
    let results = fixture.results.lock().unwrap();
    assert_eq!(results.len(), 6);
    assert!(results[0].result.contains("不存在"));
    assert!(results[1].result.contains("validation"));
    let messages = fixture.messages();
    for result in results.iter() {
        assert!(messages.iter().any(|message| {
            message.role == ChatRole::Tool
                && message.tool_call_id.as_deref() == Some(&result.call.id)
                && message.content == result.result
        }));
    }
    let errors = fixture.errors.lock().unwrap();
    assert_eq!(errors.len(), 1);
    assert!(errors[0].error.contains("连续 3 步全部失败"));
    let ends = fixture.ends.lock().unwrap();
    assert_eq!(ends.len(), 1);
    assert_eq!(ends[0].cause.phase, LoopPhase::Error);
    assert_eq!(ends[0].step, 3);
    let mut expected_usage = ChatTurnUsage::tracked();
    for step in 1..=3 {
        expected_usage.request_started(step);
        expected_usage.add((
            step,
            ChatUsage {
                prompt_tokens: 13,
                completion_tokens: 7,
                ..ChatUsage::default()
            },
        ));
    }
    assert_eq!(ends[0].usages, expected_usage);
    assert!(
        messages
            .iter()
            .any(|message| message.inner_type == Some(ChatRoleInnerType::Error))
    );
    assert_eq!(
        messages.last().unwrap().inner_type,
        Some(ChatRoleInnerType::Usage)
    );
}

#[tokio::test]
async fn a_successful_tool_resets_failed_steps_and_allows_correction_to_finish() {
    let steps = vec![
        tool_step(vec![("query", json!({"fail": true}))], 0),
        tool_step(vec![("query", json!({"fail": true}))], 1),
        tool_step(vec![("missing", json!({})), ("query", json!({"id": 1}))], 2),
        tool_step(vec![("query", json!({"fail": true}))], 3),
        tool_step(vec![("query", json!({"fail": true}))], 4),
        final_step(),
    ];
    let fixture = LoopFixture::new(steps);
    fixture.run().await;

    assert_eq!(fixture.requests.lock().unwrap().len(), 6);
    assert!(fixture.errors.lock().unwrap().is_empty());
    assert_eq!(
        fixture.ends.lock().unwrap()[0].cause.phase,
        LoopPhase::Success
    );
    assert!(
        fixture.messages().iter().any(|message| {
            message.role == ChatRole::Assistant && message.content == "已完成"
        })
    );
}

#[tokio::test]
async fn repeated_successful_queries_without_new_results_stop_despite_new_call_ids() {
    let fixture = LoopFixture::new(
        (0..4)
            .map(|step| {
                let mut calls = vec![("query", json!({"id": 1})), ("query", json!({"id": 2}))];
                if step % 2 == 1 {
                    calls.reverse();
                }
                tool_step(calls, step)
            })
            .collect(),
    );
    fixture.run().await;

    assert_eq!(fixture.requests.lock().unwrap().len(), 3);
    assert_eq!(fixture.tool.calls.load(Ordering::SeqCst), 6);
    assert_eq!(fixture.results.lock().unwrap().len(), 6);
    assert!(
        fixture.errors.lock().unwrap()[0]
            .error
            .contains("未取得进展")
    );
    assert_eq!(
        fixture.ends.lock().unwrap()[0].cause.phase,
        LoopPhase::Error
    );
}

#[tokio::test]
async fn repeated_queries_with_changing_results_are_allowed_to_continue() {
    let mut steps: Vec<_> = (0..4)
        .map(|step| tool_step(vec![("query", json!({"changing": true}))], step))
        .collect();
    steps.push(final_step());
    let fixture = LoopFixture::new(steps);
    fixture.run().await;

    assert_eq!(fixture.requests.lock().unwrap().len(), 5);
    assert_eq!(fixture.tool.calls.load(Ordering::SeqCst), 4);
    assert!(fixture.errors.lock().unwrap().is_empty());
    assert_eq!(
        fixture.ends.lock().unwrap()[0].cause.phase,
        LoopPhase::Success
    );
}

#[tokio::test]
async fn distinct_tool_arguments_are_not_treated_as_repeated_queries() {
    let mut steps: Vec<_> = (0..4)
        .map(|step| tool_step(vec![("query", json!({"id": step + 1}))], step))
        .collect();
    steps.push(final_step());
    let fixture = LoopFixture::new(steps);
    fixture.run().await;

    assert_eq!(fixture.requests.lock().unwrap().len(), 5);
    assert_eq!(fixture.tool.calls.load(Ordering::SeqCst), 4);
    assert!(fixture.errors.lock().unwrap().is_empty());
    assert_eq!(
        fixture.ends.lock().unwrap()[0].cause.phase,
        LoopPhase::Success
    );
}

#[tokio::test]
async fn cancellation_interrupts_a_tool_that_ignores_its_signal_and_completes_the_batch_history() {
    let fixture = LoopFixture::new(vec![tool_step(
        vec![
            ("query", json!({"wait": true})),
            ("query", json!({"id": 2})),
        ],
        0,
    )]);
    let cancel = Signal::default();
    let handle = fixture.service.send(
        fixture.session.clone(),
        "run-cancel".to_string(),
        ChatMessage::user("执行后停止"),
        cancel.clone(),
    );
    tokio::time::timeout(Duration::from_secs(5), fixture.tool.waiting.notified())
        .await
        .expect("tool did not start");
    cancel.abort();
    tokio::time::timeout(Duration::from_secs(1), handle.completed())
        .await
        .expect("cancellation kept waiting for the tool");

    assert!(fixture.tool.dropped.load(Ordering::SeqCst));
    assert_eq!(fixture.tool.calls.load(Ordering::SeqCst), 1);
    assert_eq!(fixture.requests.lock().unwrap().len(), 1);
    assert!(fixture.errors.lock().unwrap().is_empty());
    assert_eq!(
        fixture.ends.lock().unwrap()[0].cause.phase,
        LoopPhase::Cancel
    );
    let messages = fixture.messages();
    let results: Vec<_> = messages
        .iter()
        .filter(|message| message.role == ChatRole::Tool)
        .collect();
    assert_eq!(results.len(), 2);
    assert!(
        results
            .iter()
            .all(|message| message.content.contains("取消"))
    );
    assert_eq!(
        messages.last().unwrap().inner_type,
        Some(ChatRoleInnerType::Usage)
    );
}
