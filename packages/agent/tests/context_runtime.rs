use agent::llm::models::{
    ChatMessage, ChatRequest, ChatRole, ChatToolCall, ChatUsage, LLMAdapter, LLMConfig,
    LLMContextSize, LLMProvider, LLMStream, LLMStreamEvent,
};
use agent::llm::plugins::{LLMConfigPlugin, LLMPlugin};
use agent::plugins::models::PluginMeta;
use agent::server::runtime::AgentLoopRuntimeService;
use agent::session::SessionPlugin;
use agent::store::StorePlugin;
use agent::store::models::Store;
use futures::stream;
use serde_json::json;
use std::ffi::OsString;
use std::sync::{Arc, Mutex};
use std::time::Duration;

struct ContextAdapter(Arc<Mutex<Vec<ChatRequest>>>);

impl LLMAdapter for ContextAdapter {
    fn stream<'a>(&'a self, request: &'a ChatRequest) -> LLMStream<'a> {
        self.0.lock().unwrap().push(request.clone());
        Box::pin(stream::iter([
            Ok(LLMStreamEvent::TextDelta {
                text: "已读取页面".into(),
            }),
            Ok(LLMStreamEvent::Usage(ChatUsage {
                prompt_tokens: 100,
                completion_tokens: 10,
                ..ChatUsage::default()
            })),
            Ok(LLMStreamEvent::Done {
                finish_reason: Some("stop".into()),
            }),
        ]))
    }
}

#[tokio::test]
async fn page_context_precedes_its_user_and_preserves_the_existing_request_prefix() {
    let path = std::env::temp_dir().join(agent::utils::generate_id("context-runtime-test"));
    let config = || agent::AgentConfig {
        store_config: agent::store::StoreConfig {
            path: path.clone(),
            secret: "context-test".into(),
        },
        llm_compactor_config: agent::llm::plugins::LLMCompactorConfig {
            keep: 10,
            threshold: 0.75,
        },
        max_turns_config: agent::plugins::max_turns::MaxTurnsConfig { max_turns: 10 },
        loop_config: agent::r#loop::LoopConfig {
            max_steps_per_turn: 5,
        },
    };
    let ctx = agent::build_agent(config()).await.unwrap();
    let sessions = SessionPlugin::get_service(&ctx).unwrap();
    let id = sessions.create_session_named("已有标题");
    LLMConfigPlugin::get_service(&ctx)
        .unwrap()
        .add_global_config(LLMConfig {
            id: "config-context".into(),
            model: "context-model".into(),
            context_size: LLMContextSize::_256K,
            default: true,
            ..Default::default()
        })
        .unwrap();
    let requests = Arc::new(Mutex::new(Vec::new()));
    LLMPlugin::get_service(&ctx)
        .unwrap()
        .providers
        .lock()
        .unwrap()
        .insert(
            LLMProvider::OpenAI,
            Arc::new(ContextAdapter(requests.clone())),
        );
    let service = AgentLoopRuntimeService::from_ctx(&ctx).unwrap();
    let thread_id = id.to_string();
    let context = r#"{"page":{"page":"playlist","id":123,"name":"正在看的歌单"}}"#;
    let next_context = r#"{"page":{"page":"album","id":456,"name":"新打开的专辑"}}"#;
    let inputs = [
        (Some(context.to_string()), "介绍这个歌单"),
        (Some(next_context.to_string()), "介绍这个专辑"),
        (None, "接着说"),
        (Some(" \n".into()), "继续"),
    ];
    let mut prefixes = Vec::new();
    for (page, input) in &inputs {
        prefixes.push(sessions.compaction_messages(&id));
        service
            .create_run_with_context(&thread_id, (*input).into(), page.clone())
            .unwrap();
        tokio::time::timeout(Duration::from_secs(2), async {
            while !service.list_runs().is_empty() {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
    }
    let requests = requests.lock().unwrap().clone();
    assert_eq!(requests.len(), inputs.len());
    for (index, request) in requests.iter().enumerate() {
        assert_eq!(request.system, requests[0].system);
        assert!(
            request
                .system
                .iter()
                .all(|value| !value.contains(context) && !value.contains(next_context))
        );
        assert!(request.messages.starts_with(&prefixes[index]));
        let tail = &request.messages[prefixes[index].len()..];
        let (context, input) = &inputs[index];
        if let Some(context) = context.as_ref().filter(|value| !value.trim().is_empty()) {
            assert_eq!(
                tail,
                &[
                    ChatMessage::context_snapshot(context),
                    ChatMessage::user(*input)
                ]
            );
        } else {
            assert_eq!(tail, &[ChatMessage::user(*input)]);
        }
    }
    let real = sessions.real_messages(&id);
    assert_eq!(
        real.iter()
            .filter(|message| message.role == ChatRole::User)
            .count(),
        inputs.len()
    );
    assert_eq!(
        real.iter()
            .filter(|message| message.is_context_snapshot())
            .count(),
        2
    );
    for (index, message) in real
        .iter()
        .enumerate()
        .filter(|(_, message)| message.is_context_snapshot())
    {
        assert_eq!(real[index + 1].role, ChatRole::User);
        assert!(
            message
                .content
                .contains(if index == 0 { context } else { next_context })
        );
    }
    assert_eq!(
        requests[3].messages[0],
        ChatMessage::context_snapshot(context)
    );
    let usage = service
        .get_thread(&thread_id)
        .unwrap()
        .unwrap()
        .context
        .unwrap();
    assert_eq!(usage.config_id, "config-context");
    assert_eq!(usage.capacity_tokens, 256 * 1024);
    assert_eq!(
        usage.estimated_tokens,
        sessions
            .compaction_messages(&id)
            .iter()
            .map(ChatMessage::token_count)
            .sum::<usize>()
            + ChatRequest::instruction_tokens(&requests[3].system, &requests[3].tools)
    );
    assert!(
        service
            .create_run_with_context(&thread_id, "x".into(), Some("x".repeat(8193)))
            .is_err()
    );
    assert!(service.list_runs().is_empty());
    let stores = StorePlugin::get_service(&ctx).unwrap();
    let expected = serde_json::to_value(sessions.metadata(&id).unwrap()).unwrap();
    // 后台写入以最后一份元数据落盘为完成标志，不能在 dispose 后立即删除目录。
    tokio::time::timeout(Duration::from_secs(2), async {
        loop {
            let metadata =
                if let Some(store) = stores.get(&OsString::from(id.as_ref())).await.unwrap() {
                    store
                        .get("metadata")
                        .await
                        .ok()
                        .flatten()
                        .and_then(|value| serde_json::from_str::<serde_json::Value>(&value).ok())
                } else {
                    None
                };
            let configs =
                if let Some(store) = stores.get(&OsString::from("llm-configs")).await.unwrap() {
                    store
                        .get("items")
                        .await
                        .ok()
                        .flatten()
                        .and_then(|value| serde_json::from_str::<Vec<LLMConfig>>(&value).ok())
                } else {
                    None
                };
            if metadata.as_ref() == Some(&expected)
                && configs.as_ref().is_some_and(|configs| {
                    configs.iter().any(|config| config.id == "config-context")
                })
            {
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .expect("context fixture writes did not finish");
    let compacted = sessions.compaction_messages(&id);
    ctx.dispose();
    let restored = agent::build_agent(config()).await.unwrap();
    let restored_sessions = SessionPlugin::get_service(&restored).unwrap();
    assert_eq!(restored_sessions.real_messages(&id), real);
    assert_eq!(restored_sessions.compaction_messages(&id), compacted);
    restored.dispose();
    tokio::fs::remove_dir_all(path).await.unwrap();
}

#[test]
fn context_estimates_include_reasoning_and_tool_arguments() {
    let plain = ChatMessage::assistant("");
    let message = ChatMessage::assistant_with_tool_calls_and_reasoning(
        "",
        vec![ChatToolCall {
            id: "call-1".into(),
            name: "search".into(),
            args: json!({"query": "查询".repeat(1000)}),
        }],
        Some("思考历史".repeat(1000)),
    );
    assert!(message.token_count() > plain.token_count() + 1000);
}
