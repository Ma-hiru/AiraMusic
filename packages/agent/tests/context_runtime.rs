use agent::context::compactor::LLMCompactor;
use agent::context::manager::LLMContextManager;
use agent::context::models::{Checkpoint, ContextPolicy};
use agent::llm::models::*;
use agent::llm::plugins::{LLMConfigPlugin, LLMPlugin};
use agent::r#loop::{LoopConfig, LoopPlugin};
use agent::plugins::max_turns::MaxTurnsConfig;
use agent::plugins::models::PluginMeta;
use agent::session::{SessionPlugin, models::SessionId};
use agent::store::local::LocalStore;
use agent::store::models::Store;
use agent::store::{StoreConfig, StorePlugin};
use agent::tools::ToolsPlugin;
use agent::tools::models::{Tool, ToolRunContext};
use agent::utils::Signal;
use agent::{AgentConfig, build_agent};
use async_trait::async_trait;
use serde_json::{Value, json};
use std::path::PathBuf;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicUsize, Ordering},
};

struct TestDirectory(PathBuf);
impl TestDirectory {
    fn new() -> Self {
        let path = std::env::temp_dir().join(agent::utils::generate_id("aira-context-test"));
        std::fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}
impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn config(directory: &TestDirectory) -> AgentConfig {
    AgentConfig {
        store_config: StoreConfig {
            path: directory.0.clone(),
            secret: "context-test-only".into(),
        },
        context_policy: ContextPolicy {
            recent_token_budget: 256,
            summary_output_tokens: 256,
            ..ContextPolicy::default()
        },
        max_turns_config: MaxTurnsConfig { max_turns: 100 },
        loop_config: LoopConfig {
            max_steps_per_turn: 5,
        },
    }
}
fn model_config() -> LLMConfig {
    LLMConfig {
        id: "test-model".into(),
        model: "test".into(),
        context_size: LLMContextSize::_128K,
        default: true,
        max_output_tokens: Some(512),
        ..LLMConfig::default()
    }
}

#[tokio::test]
async fn checkpoint_and_raw_history_survive_restart_without_broadcast_loss() {
    let directory = TestDirectory::new();
    let ctx = build_agent(config(&directory)).await.unwrap();
    let sessions = SessionPlugin::get_service(&ctx).unwrap();
    let id = sessions.create_session_named("durable");
    // More than the old broadcast capacity, without yielding to the writer.
    for index in 0..300 {
        sessions
            .append(&id, ChatMessage::user(format!("message {index}")))
            .unwrap();
    }
    let checkpoint = Checkpoint {
        through_seq: 200,
        summary: "## Objective\n继续任务".into(),
    };
    sessions
        .commit_checkpoint(&id, 300, None, checkpoint.clone())
        .await
        .unwrap();
    let expected = sessions.context_snapshot(&id).unwrap();
    sessions.flush().await.unwrap();
    ctx.dispose();
    let restored = build_agent(config(&directory)).await.unwrap();
    let actual = SessionPlugin::get_service(&restored)
        .unwrap()
        .context_snapshot(&id)
        .unwrap();
    assert_eq!(actual, expected);
    restored.dispose();
}

#[tokio::test]
async fn failed_checkpoint_write_does_not_install_the_draft() {
    let directory = TestDirectory::new();
    let ctx = build_agent(config(&directory)).await.unwrap();
    let sessions = SessionPlugin::get_service(&ctx).unwrap();
    let id = sessions.create_session();
    sessions.append(&id, ChatMessage::user("original")).unwrap();
    sessions.flush().await.unwrap();
    let store = StorePlugin::get_service(&ctx)
        .unwrap()
        .get_or_create(&id.to_string().into())
        .await
        .unwrap();
    // Force rename to fail using only this test's temporary directory.
    let key = store.dir.join("context-v1");
    std::fs::remove_file(&key).unwrap();
    std::fs::create_dir(&key).unwrap();
    let result = sessions
        .commit_checkpoint(
            &id,
            1,
            None,
            Checkpoint {
                through_seq: 1,
                summary: "## Objective\nDraft".into(),
            },
        )
        .await;
    assert!(result.is_err());
    assert!(sessions.context_snapshot(&id).unwrap().checkpoint.is_none());
    ctx.dispose();
}

#[tokio::test]
async fn legacy_sessions_rebuild_from_raw_not_the_broken_compaction_array() {
    let directory = TestDirectory::new();
    let id = SessionId::from("legacy-session");
    let path = directory.0.join(id.to_string());
    std::fs::create_dir_all(&path).unwrap();
    let store = LocalStore {
        name: id.to_string(),
        dir: path,
        secret: "context-test-only".into(),
    };
    let raw = vec![
        ChatMessage::user("完整的用户原文"),
        ChatMessage::assistant("完整的回复"),
    ];
    store
        .set("real", serde_json::to_string(&raw).unwrap())
        .await
        .unwrap();
    store
        .set(
            "compaction",
            serde_json::to_string(&vec![ChatMessage::tool("orphan", "missing")]).unwrap(),
        )
        .await
        .unwrap();
    let ctx = build_agent(config(&directory)).await.unwrap();
    let sessions = SessionPlugin::get_service(&ctx).unwrap();
    assert_eq!(sessions.real_messages(&id), raw);
    assert!(sessions.context_snapshot(&id).unwrap().checkpoint.is_none());
    ctx.dispose();
}

struct CountTool(Arc<AtomicUsize>);
#[async_trait]
impl Tool for CountTool {
    fn name(&self) -> &str {
        "count-tool"
    }
    fn description(&self) -> &str {
        "Counts an execution"
    }
    fn parameters(&self) -> Value {
        json!({"type": "object", "properties": {}})
    }
    async fn run(&self, _: Value, _: &ToolRunContext) -> anyhow::Result<Value> {
        self.0.fetch_add(1, Ordering::SeqCst);
        Ok(json!({"track_id": "track-123", "added": true}))
    }
}

#[derive(Clone, Copy)]
enum FailureMode {
    OverflowOnce,
    OverflowTwice,
    InvalidToolHistory,
    AfterPartialOutput,
}
struct LoopModel {
    mode: FailureMode,
    requests: Mutex<Vec<ChatRequest>>,
    summaries: AtomicUsize,
}
impl LLMAdapter for LoopModel {
    fn stream<'a>(&'a self, request: &'a ChatRequest) -> LLMStream<'a> {
        if request
            .system
            .first()
            .is_some_and(|system| system.starts_with("Create a historical checkpoint"))
        {
            self.summaries.fetch_add(1, Ordering::SeqCst);
            return Box::pin(futures::stream::iter(vec![
                Ok(LLMStreamEvent::TextDelta {
                    text: "## Objective\n继续添加用户选择的歌曲。\n## Constraints\n只能添加一次。"
                        .into(),
                }),
                Ok(LLMStreamEvent::Done {
                    finish_reason: Some("stop".into()),
                }),
            ]));
        }
        agent::context::messages::validate_messages(&request.messages).unwrap();
        let index = {
            let mut requests = self.requests.lock().unwrap();
            requests.push(request.clone());
            requests.len()
        };
        let events = if index == 1 {
            vec![
                Ok(LLMStreamEvent::ToolCallStart {
                    id: "call-once".into(),
                    name: "count-tool".into(),
                }),
                Ok(LLMStreamEvent::ToolCallArgs {
                    id: "call-once".into(),
                    delta: "{}".into(),
                }),
                Ok(LLMStreamEvent::ToolCallEnd {
                    id: "call-once".into(),
                }),
                Ok(LLMStreamEvent::Done {
                    finish_reason: Some("tool_calls".into()),
                }),
            ]
        } else if index == 2 || matches!(self.mode, FailureMode::OverflowTwice) {
            match self.mode {
                FailureMode::InvalidToolHistory => vec![Err(anyhow::anyhow!(
                    "Messages with role 'tool' must be a response to a pending message with 'tool_calls'"
                ))],
                FailureMode::AfterPartialOutput => vec![
                    Ok(LLMStreamEvent::TextDelta {
                        text: "partial".into(),
                    }),
                    Err(ContextOverflow("overflow after partial response".into()).into()),
                ],
                _ => vec![Err(ContextOverflow("context length exceeded".into()).into())],
            }
        } else {
            vec![
                Ok(LLMStreamEvent::TextDelta {
                    text: "已添加一次。".into(),
                }),
                Ok(LLMStreamEvent::Done {
                    finish_reason: Some("stop".into()),
                }),
            ]
        };
        Box::pin(futures::stream::iter(events))
    }
}

async fn run_loop(mode: FailureMode) -> (usize, usize, usize, Vec<ChatMessage>) {
    let directory = TestDirectory::new();
    let ctx = build_agent(config(&directory)).await.unwrap();
    let sessions = SessionPlugin::get_service(&ctx).unwrap();
    let id = sessions.create_session();
    sessions.append(&id, ChatMessage::user("旧任务")).unwrap();
    sessions
        .append(&id, ChatMessage::assistant("old details ".repeat(1_000)))
        .unwrap();
    LLMConfigPlugin::get_service(&ctx)
        .unwrap()
        .set_session_config(&id, model_config())
        .unwrap();
    let executions = Arc::new(AtomicUsize::new(0));
    ctx.effect(
        ToolsPlugin::get_service(&ctx)
            .unwrap()
            .register(Arc::new(CountTool(executions.clone())))
            .unwrap(),
    );
    let model = Arc::new(LoopModel {
        mode,
        requests: Mutex::new(Vec::new()),
        summaries: AtomicUsize::new(0),
    });
    LLMPlugin::get_service(&ctx)
        .unwrap()
        .providers
        .lock()
        .unwrap()
        .insert(LLMProvider::OpenAI, model.clone());
    let handle = LoopPlugin::get_service(&ctx).unwrap().send(
        id.clone(),
        "test-run".into(),
        ChatMessage::user("请添加一次"),
        Signal::default(),
    );
    tokio::time::timeout(std::time::Duration::from_secs(10), handle.completed())
        .await
        .unwrap();
    sessions.flush().await.unwrap();
    let messages = sessions.real_messages(&id);
    let counts = (
        executions.load(Ordering::SeqCst),
        model.requests.lock().unwrap().len(),
        model.summaries.load(Ordering::SeqCst),
    );
    ctx.dispose();
    (counts.0, counts.1, counts.2, messages)
}

#[tokio::test]
async fn overflow_retries_only_the_pending_model_step_without_reexecuting_tools() {
    let (executions, requests, summaries, messages) = run_loop(FailureMode::OverflowOnce).await;
    assert_eq!(executions, 1);
    assert_eq!(requests, 3);
    assert!(summaries >= 1);
    assert_eq!(
        messages
            .iter()
            .filter(|m| m.role == ChatRole::User && m.content == "请添加一次")
            .count(),
        1
    );
    assert!(
        messages
            .iter()
            .any(|m| m.role == ChatRole::Assistant && m.content == "已添加一次。")
    );
}

#[tokio::test]
async fn second_overflow_stops_and_other_errors_or_partial_output_never_retry() {
    for (mode, expected_requests, expected_summary) in [
        (FailureMode::OverflowTwice, 3, true),
        (FailureMode::InvalidToolHistory, 2, false),
        (FailureMode::AfterPartialOutput, 2, false),
    ] {
        let (executions, requests, summaries, messages) = run_loop(mode).await;
        assert_eq!(executions, 1);
        assert_eq!(requests, expected_requests);
        assert_eq!(summaries > 0, expected_summary);
        assert!(
            messages
                .iter()
                .any(|message| message.inner_type == Some(ChatRoleInnerType::Error))
        );
    }
}

#[tokio::test]
async fn fixed_prompts_and_tool_schemas_count_toward_budget() {
    struct LargeSchema;
    #[async_trait]
    impl Tool for LargeSchema {
        fn name(&self) -> &str {
            "large-schema"
        }
        fn description(&self) -> &str {
            "test"
        }
        fn parameters(&self) -> Value {
            json!({"description": "schema details ".repeat(10_000)})
        }
        async fn run(&self, _: Value, _: &ToolRunContext) -> anyhow::Result<Value> {
            unreachable!()
        }
    }
    let sessions = Arc::new(agent::session::SessionManager::new());
    let id = sessions.create_session();
    sessions.append(&id, ChatMessage::user("old")).unwrap();
    sessions
        .append(&id, ChatMessage::assistant("old history ".repeat(200)))
        .unwrap();
    sessions.append(&id, ChatMessage::user("current")).unwrap();
    let manager =
        LLMContextManager::new(sessions, Arc::new(LLMCompactor), ContextPolicy::default()).unwrap();
    let model = LoopModel {
        mode: FailureMode::OverflowOnce,
        requests: Mutex::new(Vec::new()),
        summaries: AtomicUsize::new(0),
    };
    let request = ChatRequest {
        system: vec!["fixed rules".into()],
        tools: vec![Arc::new(LargeSchema)],
        messages: Vec::new(),
        config: LLMConfig {
            context_size: LLMContextSize::_8K,
            ..model_config()
        },
        cancel: Signal::default(),
    };
    assert!(manager.prepare(&id, request, &model, false).await.is_err());
    assert_eq!(model.summaries.load(Ordering::SeqCst), 0);
    assert!(model.requests.lock().unwrap().is_empty());
}
