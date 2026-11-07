use agent::ctx::Ctx;
use agent::ctx::models::Event;
use agent::llm::models::{
    ChatMessage, ChatRequest, ChatUsage, LLMAdapter, LLMConfig, LLMStream, LLMStreamEvent,
};
use agent::llm::usage::{UsageTrackingAdapter, UsageTrackingEvent};
use agent::plugins::models::PluginMeta;
use agent::session::models::{
    AuxiliaryUsagePurpose, SESSION_USAGE_UPDATED, SessionEvent, SessionId, SessionUsageUpdated,
    ThreadMetadata,
};
use agent::session::usage::track_auxiliary_usage;
use agent::session::{SessionManager, SessionPlugin};
use agent::store::StorePlugin;
use agent::store::models::Store;
use agent::utils::Signal;
use async_stream::stream;
use futures::StreamExt;
use std::ffi::OsString;
use std::sync::{Arc, Mutex};
use std::time::Duration;

struct TestAdapter {
    events: Vec<LLMStreamEvent>,
    error: bool,
    pending: bool,
}

impl LLMAdapter for TestAdapter {
    fn stream<'a>(&'a self, _request: &'a ChatRequest) -> LLMStream<'a> {
        Box::pin(stream! {
            for event in self.events.iter().cloned() {
                yield Ok(event);
            }
            if self.error {
                yield Err(anyhow::anyhow!("test failure"));
            }
            if self.pending {
                futures::future::pending::<()>().await;
            }
        })
    }
}

fn usage(input: u32, output: u32) -> ChatUsage {
    ChatUsage {
        prompt_tokens: input,
        completion_tokens: output,
        ..ChatUsage::default()
    }
}

fn request() -> ChatRequest {
    ChatRequest {
        system: Vec::new(),
        messages: Vec::new(),
        tools: Vec::new(),
        config: LLMConfig::default(),
        cancel: Signal::default(),
    }
}

fn record_request(
    sessions: &SessionManager,
    id: &SessionId,
    purpose: AuxiliaryUsagePurpose,
    usage: Option<ChatUsage>,
) {
    sessions
        .record_auxiliary_usage(id, purpose, &UsageTrackingEvent::Started)
        .unwrap();
    if let Some(usage) = usage {
        sessions
            .record_auxiliary_usage(
                id,
                purpose,
                &UsageTrackingEvent::Reported {
                    previous: None,
                    usage,
                },
            )
            .unwrap();
    }
}

#[tokio::test]
async fn usage_tracking_reports_start_and_snapshots_before_yielding() {
    let records = Arc::new(Mutex::new(Vec::new()));
    let captured = Arc::clone(&records);
    let adapter = UsageTrackingAdapter::new(
        Arc::new(TestAdapter {
            events: vec![
                LLMStreamEvent::Usage(usage(100, 5)),
                LLMStreamEvent::Usage(usage(100, 20)),
                LLMStreamEvent::Done {
                    finish_reason: Some("stop".into()),
                },
            ],
            error: false,
            pending: false,
        }),
        Arc::new(move |usage| captured.lock().unwrap().push(usage)),
    );
    let request = request();
    drop(adapter.stream(&request));
    assert!(records.lock().unwrap().is_empty());
    let events = adapter.stream(&request).collect::<Vec<_>>().await;
    assert_eq!(events.len(), 3);
    assert_eq!(
        *records.lock().unwrap(),
        vec![
            UsageTrackingEvent::Started,
            UsageTrackingEvent::Reported {
                previous: None,
                usage: usage(100, 5)
            },
            UsageTrackingEvent::Reported {
                previous: Some(usage(100, 5)),
                usage: usage(100, 20)
            },
        ]
    );
}

#[tokio::test]
async fn failures_and_dropped_streams_keep_reported_usage_and_missing_reports_unknown() {
    for reported in [false, true] {
        for pending in [false, true] {
            let records = Arc::new(Mutex::new(Vec::new()));
            let captured = Arc::clone(&records);
            let adapter = UsageTrackingAdapter::new(
                Arc::new(TestAdapter {
                    events: if reported {
                        vec![LLMStreamEvent::Usage(usage(30, 7))]
                    } else {
                        Vec::new()
                    },
                    error: !pending,
                    pending,
                }),
                Arc::new(move |usage| captured.lock().unwrap().push(usage)),
            );
            let request = request();
            let result = tokio::time::timeout(
                Duration::from_millis(5),
                adapter.stream(&request).collect::<Vec<_>>(),
            )
            .await;
            assert_eq!(result.is_err(), pending);
            let mut expected = vec![UsageTrackingEvent::Started];
            if reported {
                expected.push(UsageTrackingEvent::Reported {
                    previous: None,
                    usage: usage(30, 7),
                });
            }
            assert_eq!(*records.lock().unwrap(), expected);
        }
    }
}

#[tokio::test]
async fn auxiliary_usage_updates_metadata_without_entering_chat_history() {
    let ctx = Arc::new(Ctx::new());
    let sessions = Arc::new(SessionManager::new());
    let id = sessions.create_session_named("manual title");
    sessions.append(&id, ChatMessage::user("hello")).unwrap();
    let updated = Arc::new(Mutex::new(Vec::new()));
    let captured = Arc::clone(&updated);
    ctx.effect(ctx.on::<SessionUsageUpdated>(
        Event {
            name: SESSION_USAGE_UPDATED.into(),
            session_id: None,
        },
        move |payload| captured.lock().unwrap().push(payload.clone()),
    ));
    let adapter = track_auxiliary_usage(
        Arc::new(TestAdapter {
            events: vec![LLMStreamEvent::Usage(usage(25, 4))],
            error: false,
            pending: false,
        }),
        Arc::clone(&sessions),
        Arc::downgrade(&ctx),
        id.clone(),
        "run-1".into(),
        AuxiliaryUsagePurpose::Title,
    );
    adapter.stream(&request()).collect::<Vec<_>>().await;
    let events = updated.lock().unwrap().clone();
    assert_eq!(events.len(), 2);
    assert_eq!(events[0].session_id, id);
    assert_eq!(events[0].run_id, "run-1");
    assert_eq!(events[0].metadata.name, "manual title");
    assert_eq!(
        events[0]
            .metadata
            .auxiliary_usage
            .as_ref()
            .unwrap()
            .title
            .reported_requests,
        0
    );
    let totals = &events[1].metadata.auxiliary_usage.as_ref().unwrap().title;
    assert_eq!(
        (
            totals.requests,
            totals.reported_requests,
            totals.prompt_tokens,
            totals.completion_tokens
        ),
        (1, 1, 25, 4)
    );
    assert_eq!(
        sessions.real_messages(&id),
        vec![ChatMessage::user("hello")]
    );
    assert_eq!(
        sessions.compaction_messages(&id),
        vec![ChatMessage::user("hello")]
    );
    drop(events);
    sessions.delete_session(&id).unwrap();
    adapter.stream(&request()).collect::<Vec<_>>().await;
    assert_eq!(updated.lock().unwrap().len(), 2);
    assert!(sessions.metadata(&id).is_none());
    ctx.dispose();
}

#[test]
fn concurrent_auxiliary_requests_keep_categories_and_metadata_events_in_order() {
    let sessions = Arc::new(SessionManager::new());
    let id = sessions.create_session();
    let mut events = sessions.subscribe();
    std::thread::scope(|scope| {
        for purpose in [
            AuxiliaryUsagePurpose::Title,
            AuxiliaryUsagePurpose::Compaction,
        ] {
            let sessions = Arc::clone(&sessions);
            let id = id.clone();
            scope.spawn(move || {
                for index in 0..10 {
                    record_request(
                        &sessions,
                        &id,
                        purpose,
                        (index % 2 == 0).then(|| usage(10, 2)),
                    );
                }
            });
        }
    });
    let metadata = sessions.metadata(&id).unwrap();
    let auxiliary = metadata.auxiliary_usage.as_ref().unwrap();
    for totals in [&auxiliary.title, &auxiliary.compaction] {
        assert_eq!(
            (
                totals.requests,
                totals.reported_requests,
                totals.prompt_tokens,
                totals.completion_tokens
            ),
            (10, 5, 50, 10)
        );
    }
    let mut last: Option<ThreadMetadata> = None;
    while let Ok(SessionEvent::Metadata { metadata, .. }) = events.try_recv() {
        if let Some(previous) = &last {
            assert!(metadata.updated_at > previous.updated_at);
        }
        last = Some(metadata);
    }
    assert_eq!(last, Some(metadata));
    assert!(sessions.real_messages(&id).is_empty());
}

#[test]
fn repeated_full_snapshots_replace_only_their_request_contribution() {
    let sessions = SessionManager::new();
    let id = sessions.create_session();
    let purpose = AuxiliaryUsagePurpose::Compaction;
    record_request(&sessions, &id, purpose, Some(usage(30, 5)));
    record_request(&sessions, &id, purpose, Some(usage(50, 7)));
    sessions
        .record_auxiliary_usage(
            &id,
            purpose,
            &UsageTrackingEvent::Reported {
                previous: Some(usage(30, 5)),
                usage: usage(20, 2),
            },
        )
        .unwrap();
    let totals = sessions
        .metadata(&id)
        .unwrap()
        .auxiliary_usage
        .unwrap()
        .compaction;
    assert_eq!(
        (
            totals.requests,
            totals.reported_requests,
            totals.prompt_tokens,
            totals.completion_tokens
        ),
        (2, 2, 70, 9)
    );
}

#[tokio::test]
async fn shutdown_persists_started_and_received_usage_while_the_stream_is_still_alive() {
    for reported in [false, true] {
        let path = std::env::temp_dir().join(agent::utils::generate_id("auxiliary-shutdown-test"));
        let config = || agent::AgentConfig {
            store_config: agent::store::StoreConfig {
                path: path.clone(),
                secret: "test-secret".into(),
            },
            llm_compactor_config: agent::llm::plugins::LLMCompactorConfig {
                keep: 10,
                threshold: 0.8,
            },
            max_turns_config: agent::plugins::max_turns::MaxTurnsConfig { max_turns: 10 },
            loop_config: agent::r#loop::LoopConfig {
                max_steps_per_turn: 5,
            },
        };
        let ctx = agent::build_agent(config()).await.unwrap();
        let sessions = SessionPlugin::get_service(&ctx).unwrap();
        let stores = StorePlugin::get_service(&ctx).unwrap();
        let id = sessions.create_session_named("pending auxiliary request");
        let mut events = sessions.subscribe();
        let adapter = track_auxiliary_usage(
            Arc::new(TestAdapter {
                events: vec![if reported {
                    LLMStreamEvent::Usage(usage(12, 3))
                } else {
                    LLMStreamEvent::TextDelta {
                        text: "partial".into(),
                    }
                }],
                error: false,
                pending: true,
            }),
            Arc::clone(&sessions),
            Arc::downgrade(&ctx),
            id.clone(),
            "pending-run".into(),
            AuxiliaryUsagePurpose::Title,
        );
        let request = request();
        let mut stream = adapter.stream(&request);
        stream.next().await.unwrap().unwrap();
        let expected = sessions.metadata(&id).unwrap();
        let totals = &expected.auxiliary_usage.as_ref().unwrap().title;
        assert_eq!(
            (totals.requests, totals.reported_requests),
            (1, u32::from(reported))
        );
        assert_eq!(
            (totals.prompt_tokens, totals.completion_tokens),
            if reported { (12, 3) } else { (0, 0) }
        );
        let mut count = 0;
        while let Ok(SessionEvent::Metadata { .. }) = events.try_recv() {
            count += 1;
        }
        assert_eq!(count, 1 + usize::from(reported));
        // 流仍然活着就关闭上下文，持久化只能排空此前收到的事件。
        ctx.dispose();
        drop(stream);
        assert!(events.try_recv().is_err());
        tokio::time::timeout(Duration::from_secs(2), async {
            loop {
                if let Some(store) = stores.get(&OsString::from(id.to_string())).await.unwrap()
                    && let Ok(Some(value)) = store.get("metadata").await
                    && serde_json::from_str::<ThreadMetadata>(&value).ok().as_ref()
                        == Some(&expected)
                {
                    break;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        let restored = agent::build_agent(config()).await.unwrap();
        assert_eq!(
            SessionPlugin::get_service(&restored).unwrap().metadata(&id),
            Some(expected)
        );
        restored.dispose();
        tokio::fs::remove_dir_all(path).await.unwrap();
    }
}

#[tokio::test]
async fn auxiliary_totals_survive_encrypted_store_restart_and_old_metadata_stays_unknown() {
    let legacy: ThreadMetadata =
        serde_json::from_str(r#"{"name":"old","createdAt":1,"updatedAt":2}"#).unwrap();
    assert!(legacy.auxiliary_usage.is_none());
    let data_dir = std::env::temp_dir().join(agent::utils::generate_id("auxiliary-usage-test"));
    let config = || agent::AgentConfig {
        store_config: agent::store::StoreConfig {
            path: data_dir.clone(),
            secret: "test-secret".into(),
        },
        llm_compactor_config: agent::llm::plugins::LLMCompactorConfig {
            keep: 10,
            threshold: 0.8,
        },
        max_turns_config: agent::plugins::max_turns::MaxTurnsConfig { max_turns: 10 },
        loop_config: agent::r#loop::LoopConfig {
            max_steps_per_turn: 5,
        },
    };
    let ctx = agent::build_agent(config()).await.unwrap();
    let sessions = SessionPlugin::get_service(&ctx).unwrap();
    let id = sessions.create_session_named("usage");
    record_request(
        &sessions,
        &id,
        AuxiliaryUsagePurpose::Compaction,
        Some(usage(77, 8)),
    );
    let metadata = sessions.metadata(&id).unwrap();
    record_request(&sessions, &id, AuxiliaryUsagePurpose::Title, None);
    let expected = sessions.metadata(&id).unwrap();
    let stores = StorePlugin::get_service(&ctx).unwrap();
    tokio::time::timeout(Duration::from_secs(2), async {
        loop {
            if let Some(store) = stores.get(&OsString::from(id.to_string())).await.unwrap()
                && let Some(value) = store.get("metadata").await.unwrap()
                && serde_json::from_str::<ThreadMetadata>(&value).unwrap() == expected
            {
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    assert!(expected.updated_at > metadata.updated_at);
    ctx.dispose();
    drop(ctx);
    let restored = agent::build_agent(config()).await.unwrap();
    let sessions = SessionPlugin::get_service(&restored).unwrap();
    assert_eq!(sessions.metadata(&id), Some(expected.clone()));
    let runtime = agent::server::runtime::AgentLoopRuntimeService::from_ctx(&restored).unwrap();
    assert_eq!(
        runtime
            .get_thread(id.as_ref())
            .unwrap()
            .unwrap()
            .auxiliary_usage,
        expected.auxiliary_usage
    );
    assert!(sessions.real_messages(&id).is_empty());
    restored.dispose();
    tokio::fs::remove_dir_all(data_dir).await.unwrap();
}

#[tokio::test]
async fn the_loop_records_only_triggered_compaction_and_projects_its_usage_to_agui() {
    use agent::agui::AguiPlugin;
    use agent::agui::models::AguiEvent;
    use agent::llm::models::{ChatRoleInnerType, LLMContextSize, LLMProvider};
    use agent::llm::plugins::{
        LLMAdapterManager, LLMCompactor, LLMCompactorConfig, LLMCompactorPlugin, LLMConfigManager,
        LLMConfigPlugin, LLMPlugin,
    };
    use agent::r#loop::{LoopConfig, LoopService};
    use agent::mcp::{MCPPlugin, MCPService};
    use agent::plugins::models::Plugin;
    use agent::prompt::{PromptPlugin, PromptRegistry};
    use agent::tools::{ToolRegistry, ToolsPlugin};

    struct CompactionAdapter(Arc<Mutex<Vec<bool>>>);
    impl LLMAdapter for CompactionAdapter {
        fn stream<'a>(&'a self, request: &'a ChatRequest) -> LLMStream<'a> {
            let compaction = request
                .system
                .iter()
                .any(|value| value.contains("会话压缩器"));
            self.0.lock().unwrap().push(compaction);
            Box::pin(futures::stream::iter([
                Ok(LLMStreamEvent::TextDelta {
                    text: if compaction {
                        "旧目标与工具结果已确认"
                    } else {
                        "本轮回答"
                    }
                    .into(),
                }),
                Ok(LLMStreamEvent::Usage(if compaction {
                    usage(500, 30)
                } else {
                    usage(700, 40)
                })),
                Ok(LLMStreamEvent::Done {
                    finish_reason: Some("stop".into()),
                }),
            ]))
        }
    }

    for compact in [false, true] {
        let ctx = Arc::new(Ctx::new());
        ctx.effect(SessionPlugin::register_service(&ctx, SessionManager::new()).unwrap());
        ctx.effect(ToolsPlugin::register_service(&ctx, ToolRegistry::new()).unwrap());
        ctx.effect(PromptPlugin::register_service(&ctx, PromptRegistry::new()).unwrap());
        ctx.effect(LLMConfigPlugin::register_service(&ctx, LLMConfigManager::new()).unwrap());
        ctx.effect(
            LLMCompactorPlugin::register_service(
                &ctx,
                LLMCompactor::new(LLMCompactorConfig {
                    keep: 3,
                    threshold: 0.9,
                }),
            )
            .unwrap(),
        );
        let tools = ToolsPlugin::get_service(&ctx).unwrap();
        ctx.effect(MCPPlugin::register_service(&ctx, MCPService::new(tools)).unwrap());
        let row = AguiPlugin.boot(&ctx, ()).unwrap();
        ctx.effect(row.disposer.unwrap());
        let mut agui = AguiPlugin::get_service(&ctx).unwrap().subscribe();
        let requests = Arc::new(Mutex::new(Vec::new()));
        let adapters = LLMAdapterManager::new();
        adapters.providers.lock().unwrap().insert(
            LLMProvider::OpenAI,
            Arc::new(CompactionAdapter(Arc::clone(&requests))),
        );
        ctx.effect(LLMPlugin::register_service(&ctx, adapters).unwrap());
        let sessions = SessionPlugin::get_service(&ctx).unwrap();
        let id = sessions.create_session_named("existing title");
        let history = [
            ChatMessage::user("old constraints ".repeat(300)),
            ChatMessage::assistant("old results ".repeat(300)),
            ChatMessage::user("recent context ".repeat(300)),
            ChatMessage::assistant("recent answer"),
        ];
        for message in &history {
            sessions.append(&id, message.clone()).unwrap();
        }
        let current = ChatMessage::user("current question");
        let tokens = history
            .iter()
            .chain([&current])
            .map(ChatMessage::token_count)
            .sum::<usize>();
        LLMConfigPlugin::get_service(&ctx)
            .unwrap()
            .set_session_config(
                &id,
                LLMConfig {
                    model: "compaction-model".into(),
                    context_size: LLMContextSize::Custom(if compact { tokens } else { tokens * 3 }),
                    ..LLMConfig::default()
                },
            )
            .unwrap();
        let service = Arc::new(LoopService::new(
            &ctx,
            LoopConfig {
                max_steps_per_turn: 2,
            },
        ));
        tokio::time::timeout(
            Duration::from_secs(2),
            service
                .send(
                    id.clone(),
                    "run-compaction".into(),
                    current,
                    Signal::default(),
                )
                .completed(),
        )
        .await
        .unwrap();
        assert_eq!(
            *requests.lock().unwrap(),
            if compact {
                vec![true, false]
            } else {
                vec![false]
            }
        );
        let auxiliary = sessions.metadata(&id).unwrap().auxiliary_usage;
        if compact {
            let auxiliary = auxiliary.unwrap();
            assert_eq!(
                (
                    auxiliary.compaction.requests,
                    auxiliary.compaction.reported_requests,
                    auxiliary.compaction.prompt_tokens,
                    auxiliary.compaction.completion_tokens
                ),
                (1, 1, 500, 30)
            );
            assert_eq!(auxiliary.title.requests, 0);
        } else {
            assert!(auxiliary.is_none());
        }
        let messages = sessions.real_messages(&id);
        let turn = messages
            .iter()
            .find(|message| message.inner_type == Some(ChatRoleInnerType::Usage))
            .unwrap();
        let turn: serde_json::Value = serde_json::from_str(&turn.content).unwrap();
        assert_eq!(turn["requests"], 1);
        assert_eq!(turn["records"].as_array().unwrap().len(), 1);
        assert_eq!(turn["records"][0]["usage"]["prompt_tokens"], 700);
        let mut metadata_events = 0;
        while let Ok(event) = agui.try_recv() {
            if let AguiEvent::Custom {
                name,
                run_id,
                value,
                ..
            } = event
            {
                assert_eq!(name, "thread-metadata");
                assert_eq!(run_id, "run-compaction");
                assert_eq!(value.auxiliary_usage.unwrap().compaction.requests, 1);
                metadata_events += 1;
            }
        }
        assert_eq!(metadata_events, usize::from(compact) * 2);
        service.stop();
        ctx.dispose();
    }
}
