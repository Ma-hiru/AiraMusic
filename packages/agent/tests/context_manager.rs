use agent::context::budget::estimate_request;
use agent::context::compactor::LLMCompactor;
use agent::context::history::{read_history, search_history};
use agent::context::manager::LLMContextManager;
use agent::context::messages::validate_messages;
use agent::context::models::ContextPolicy;
use agent::llm::models::*;
use agent::session::{SessionManager, models::SessionId};
use agent::utils::Signal;
use serde_json::{Value, json};
use std::sync::{Arc, Mutex};

#[derive(Clone, Copy)]
enum SummaryMode {
    Success,
    Failure,
    Empty,
    Truncated,
    Abrupt,
    Cancel,
}
struct SummaryModel {
    mode: SummaryMode,
    requests: Mutex<Vec<ChatRequest>>,
}
impl SummaryModel {
    fn new(mode: SummaryMode) -> Self {
        Self {
            mode,
            requests: Mutex::new(Vec::new()),
        }
    }
}
impl LLMAdapter for SummaryModel {
    fn stream<'a>(&'a self, request: &'a ChatRequest) -> LLMStream<'a> {
        self.requests.lock().unwrap().push(request.clone());
        let events = match self.mode {
            SummaryMode::Success => vec![Ok(LLMStreamEvent::TextDelta { text: "## Objective\n继续完成用户请求。\n## Constraints\n保留用户限制和已确认的歌曲 ID。".into() }),
                Ok(LLMStreamEvent::Done { finish_reason: Some("stop".into()) })],
            SummaryMode::Failure => vec![Err(anyhow::anyhow!("summary request failed"))],
            SummaryMode::Empty => vec![Ok(LLMStreamEvent::Done { finish_reason: Some("stop".into()) })],
            SummaryMode::Truncated => vec![Ok(LLMStreamEvent::TextDelta { text: "## Objective\npartial".into() }), Ok(LLMStreamEvent::Done { finish_reason: Some("length".into()) })],
            SummaryMode::Abrupt => vec![Ok(LLMStreamEvent::TextDelta { text: "## Objective\npartial".into() })],
            SummaryMode::Cancel => { request.cancel.abort(); Vec::new() }
        };
        Box::pin(futures::stream::iter(events))
    }
}
fn policy() -> ContextPolicy {
    ContextPolicy {
        recent_token_budget: 256,
        summary_output_tokens: 256,
        safety_buffer: 256,
        ..ContextPolicy::default()
    }
}
fn request() -> ChatRequest {
    ChatRequest {
        system: vec!["固定人设：用户的规则必须保留。".into()],
        messages: Vec::new(),
        tools: Vec::new(),
        config: LLMConfig {
            model: "test".into(),
            context_size: LLMContextSize::_8K,
            max_output_tokens: Some(512),
            ..LLMConfig::default()
        },
        cancel: Signal::default(),
    }
}
fn setup(messages: Vec<ChatMessage>) -> (Arc<SessionManager>, SessionId, LLMContextManager) {
    let sessions = Arc::new(SessionManager::new());
    let id = sessions.create_session();
    for message in messages {
        sessions.append(&id, message).unwrap();
    }
    let manager =
        LLMContextManager::new(sessions.clone(), Arc::new(LLMCompactor), policy()).unwrap();
    (sessions, id, manager)
}
fn old_history() -> Vec<ChatMessage> {
    vec![
        ChatMessage::user("旧请求：不要重复添加歌曲。"),
        ChatMessage::assistant("旧记录 details ".repeat(600)),
        ChatMessage::user("现在处理第二首歌曲"),
    ]
}
fn calls(ids: &[&str]) -> ChatMessage {
    ChatMessage::assistant_with_tool_calls_and_reasoning(
        "查询歌曲",
        ids.iter()
            .map(|id| ChatToolCall {
                id: id.to_string(),
                name: "lookup".into(),
                args: json!({"track": id}),
            })
            .collect(),
        Some("需要检查两个候选项".into()),
    )
}

#[tokio::test]
async fn failed_summary_must_not_replace_history() {
    let (sessions, id, manager) = setup(old_history());
    let before = sessions.context_snapshot(&id).unwrap();
    let result = manager
        .prepare(
            &id,
            request(),
            &SummaryModel::new(SummaryMode::Failure),
            true,
        )
        .await;
    assert!(
        result.is_err(),
        "a failed summary must not become a successful compaction"
    );
    assert_eq!(sessions.context_snapshot(&id).unwrap(), before);
}

#[tokio::test]
async fn empty_truncated_abrupt_and_cancelled_summaries_preserve_the_checkpoint() {
    for mode in [
        SummaryMode::Empty,
        SummaryMode::Truncated,
        SummaryMode::Abrupt,
        SummaryMode::Cancel,
    ] {
        let (sessions, id, manager) = setup(old_history());
        let before = sessions.context_snapshot(&id).unwrap();
        let result = manager
            .prepare(&id, request(), &SummaryModel::new(mode), true)
            .await;
        assert!(result.is_err());
        assert_eq!(sessions.context_snapshot(&id).unwrap(), before);
    }
}

#[test]
fn validation_rejects_orphan_missing_duplicate_and_interleaved_tool_results() {
    for messages in [
        vec![ChatMessage::tool("orphan", "a")],
        vec![calls(&["a"])],
        vec![
            calls(&["a", "b"]),
            ChatMessage::tool("a", "a"),
            ChatMessage::tool("duplicate", "a"),
        ],
        vec![
            calls(&["a", "b"]),
            ChatMessage::tool("a", "a"),
            ChatMessage::user("interrupt"),
            ChatMessage::tool("b", "b"),
        ],
    ] {
        assert!(validate_messages(&messages).is_err());
    }
    assert!(
        validate_messages(&[
            calls(&["a", "b"]),
            ChatMessage::tool("b", "b"),
            ChatMessage::tool("a", "a")
        ])
        .is_ok()
    );
}

#[tokio::test]
async fn checkpoint_keeps_the_latest_parallel_tool_exchange_and_reasoning() {
    let mut messages = old_history();
    messages.extend([
        calls(&["a", "b"]),
        ChatMessage::tool("song A", "a"),
        ChatMessage::tool("song B", "b"),
    ]);
    let (sessions, id, manager) = setup(messages.clone());
    let model = SummaryModel::new(SummaryMode::Success);
    let prepared = manager.prepare(&id, request(), &model, true).await.unwrap();
    assert!(sessions.context_snapshot(&id).unwrap().checkpoint.is_none());
    validate_messages(&prepared.request.messages).unwrap();
    let assistant = prepared
        .request
        .messages
        .iter()
        .find(|m| !m.tool_calls.is_empty())
        .unwrap();
    assert_eq!(assistant.tool_calls.len(), 2);
    assert_eq!(
        assistant.reasoning_content.as_deref(),
        Some("需要检查两个候选项")
    );
    assert_eq!(prepared.request.system, request().system);
    assert_eq!(
        prepared
            .request
            .messages
            .iter()
            .filter(|m| m.role == ChatRole::User && m.content == "现在处理第二首歌曲")
            .count(),
        1
    );
    manager
        .commit(&id, &prepared, &prepared.request)
        .await
        .unwrap();
    assert_eq!(sessions.real_messages(&id), messages);
    assert!(
        sessions
            .context_snapshot(&id)
            .unwrap()
            .checkpoint
            .unwrap()
            .through_seq
            < 4
    );
}

#[tokio::test]
async fn subsequent_checkpoint_uses_prior_summary_and_only_new_records() {
    let (sessions, id, manager) = setup(old_history());
    let model = SummaryModel::new(SummaryMode::Success);
    let first = manager.prepare(&id, request(), &model, true).await.unwrap();
    manager.commit(&id, &first, &first.request).await.unwrap();
    let checkpoint = sessions.context_snapshot(&id).unwrap().checkpoint.unwrap();
    sessions
        .append(&id, ChatMessage::assistant("new result ".repeat(500)))
        .unwrap();
    sessions
        .append(&id, ChatMessage::user("继续最新任务"))
        .unwrap();
    model.requests.lock().unwrap().clear();
    let second = manager.prepare(&id, request(), &model, true).await.unwrap();
    for input in model.requests.lock().unwrap().iter() {
        let payload: Value = serde_json::from_str(&input.messages[0].content).unwrap();
        assert!(!payload["prior_checkpoint"].as_str().unwrap().is_empty());
        for record in payload["new_records"].as_array().unwrap() {
            assert!(record["seq"].as_u64().unwrap() > checkpoint.through_seq);
        }
    }
    manager.commit(&id, &second, &second.request).await.unwrap();
    assert!(
        sessions
            .context_snapshot(&id)
            .unwrap()
            .checkpoint
            .unwrap()
            .through_seq
            > checkpoint.through_seq
    );
}

#[tokio::test]
async fn long_current_turn_retains_user_anchor_once_and_latest_step() {
    let mut messages = vec![ChatMessage::user("只添加一次，按刚才的顺序")];
    for index in 0..6 {
        let id = format!("call-{index}");
        messages.extend([
            calls(&[&id]),
            ChatMessage::tool("track data ".repeat(500), id),
        ]);
    }
    let (sessions, id, manager) = setup(messages);
    let prepared = manager
        .prepare(
            &id,
            request(),
            &SummaryModel::new(SummaryMode::Success),
            true,
        )
        .await
        .unwrap();
    assert_eq!(
        prepared
            .request
            .messages
            .iter()
            .filter(|m| m.role == ChatRole::User)
            .count(),
        1
    );
    assert!(
        prepared
            .request
            .messages
            .iter()
            .any(|m| m.tool_call_id.as_deref() == Some("call-5"))
    );
    validate_messages(&prepared.request.messages).unwrap();
    manager
        .commit(&id, &prepared, &prepared.request)
        .await
        .unwrap();
    assert!(
        sessions
            .context_snapshot(&id)
            .unwrap()
            .checkpoint
            .unwrap()
            .through_seq
            > 1
    );
}

#[tokio::test]
async fn summary_batches_fit_even_when_one_old_message_exceeds_the_window() {
    let (sessions, id, manager) = setup(vec![
        ChatMessage::user("历史内容 abc ".repeat(6_000)),
        ChatMessage::user("当前请求"),
    ]);
    let model = SummaryModel::new(SummaryMode::Success);
    let prepared = manager.prepare(&id, request(), &model, true).await.unwrap();
    {
        let requests = model.requests.lock().unwrap();
        assert!(requests.len() > 1);
        for input in requests.iter() {
            assert!(
                estimate_request(input).total() + input.config.output_limit() as usize + 256
                    <= 8_192
            );
            assert!(input.tools.is_empty());
            assert_eq!(input.messages.len(), 1);
            assert_eq!(input.messages[0].role, ChatRole::User);
        }
    }
    manager
        .commit(&id, &prepared, &prepared.request)
        .await
        .unwrap();
    assert_eq!(sessions.real_messages(&id).len(), 2);
}

#[tokio::test]
async fn final_hook_corruption_or_budget_growth_does_not_commit_a_draft() {
    let (sessions, id, manager) = setup(old_history());
    let prepared = manager
        .prepare(
            &id,
            request(),
            &SummaryModel::new(SummaryMode::Success),
            true,
        )
        .await
        .unwrap();
    let mut corrupt = prepared.request.clone();
    corrupt
        .messages
        .push(ChatMessage::tool("injected", "missing"));
    assert!(manager.commit(&id, &prepared, &corrupt).await.is_err());
    let mut oversized = prepared.request.clone();
    oversized.system.push("large system ".repeat(10_000));
    assert!(manager.commit(&id, &prepared, &oversized).await.is_err());
    assert!(sessions.context_snapshot(&id).unwrap().checkpoint.is_none());
    sessions
        .append(&id, ChatMessage::user("concurrent edit"))
        .unwrap();
    assert!(
        manager
            .commit(&id, &prepared, &prepared.request)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn short_history_needs_no_summary_and_single_oversized_input_fails_cleanly() {
    let (sessions, id, manager) = setup(vec![ChatMessage::user("你好")]);
    let model = SummaryModel::new(SummaryMode::Failure);
    let prepared = manager
        .prepare(&id, request(), &model, false)
        .await
        .unwrap();
    assert_eq!(prepared.request.messages, sessions.real_messages(&id));
    assert!(model.requests.lock().unwrap().is_empty());
    sessions
        .append(&id, ChatMessage::user("new input during hook"))
        .unwrap();
    assert!(
        manager
            .commit(&id, &prepared, &prepared.request)
            .await
            .is_err()
    );
    let (_, id, manager) = setup(vec![ChatMessage::user(
        "huge current input ".repeat(10_000),
    )]);
    assert!(
        manager
            .prepare(&id, request(), &model, false)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn failed_soft_compaction_falls_back_only_when_original_request_fits() {
    let sessions = Arc::new(SessionManager::new());
    let id = sessions.create_session();
    for message in old_history() {
        sessions.append(&id, message).unwrap();
    }
    let manager = LLMContextManager::new(
        sessions.clone(),
        Arc::new(LLMCompactor),
        ContextPolicy {
            trigger_ratio: 0.1,
            ..policy()
        },
    )
    .unwrap();
    let model = SummaryModel::new(SummaryMode::Failure);
    let prepared = manager
        .prepare(&id, request(), &model, false)
        .await
        .unwrap();
    manager
        .commit(&id, &prepared, &prepared.request)
        .await
        .unwrap();
    assert!(!model.requests.lock().unwrap().is_empty());
    assert!(sessions.context_snapshot(&id).unwrap().checkpoint.is_none());
}

#[tokio::test]
async fn large_tool_result_has_a_bounded_preview_and_lossless_unicode_readback() {
    let content = "歌曲🎵 编号 123；原始数据。\n".repeat(1_000);
    let (sessions, id, manager) = setup(vec![
        ChatMessage::user("读取"),
        calls(&["a"]),
        ChatMessage::tool(&content, "a"),
    ]);
    let model = SummaryModel::new(SummaryMode::Failure);
    let prepared = manager
        .prepare(&id, request(), &model, false)
        .await
        .unwrap();
    let preview = &prepared.request.messages.last().unwrap().content;
    assert!(token_count(preview) <= 512);
    assert!(preview.contains("message_seq=3"));
    assert!(model.requests.lock().unwrap().is_empty());
    let mut recovered = String::new();
    let mut offset = 0;
    loop {
        let page = read_history(&sessions.real_messages(&id), 3, offset, 128).unwrap();
        recovered.push_str(page["content"].as_str().unwrap());
        match page["next_offset"].as_u64() {
            Some(next) => {
                assert!(next as usize > offset);
                offset = next as usize;
            }
            None => break,
        }
    }
    assert_eq!(recovered, content);
}

#[test]
fn history_search_deduplicates_and_does_not_reimport_tool_search_results() {
    let messages = vec![
        ChatMessage::user("歌单 推荐".repeat(2_000)),
        ChatMessage::tool("歌单 推荐 旧搜索结果", "a"),
        ChatMessage::assistant("推荐已完成"),
    ];
    let result = search_history(&messages, &["推荐".into(), "歌单".into()], 20, 0, false);
    assert_eq!(result["results"].as_array().unwrap().len(), 2);
    assert_eq!(result["results"][0]["message_seq"], 1);
    assert!(token_count(&result.to_string()) <= 2_048);
    let first = search_history(&messages, &["推荐".into()], 1, 0, false);
    let second = search_history(
        &messages,
        &["推荐".into()],
        1,
        first["next_after_seq"].as_u64().unwrap(),
        false,
    );
    assert_eq!(second["results"][0]["message_seq"], 3);
}
