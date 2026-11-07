use agent::llm::models::LLMProvider;
use agent::llm::plugins::config::LLMConfigManager;
use agent::server::models::ProviderConfigInput;
use agent::server::runtime::{AgentLoopRuntimeService, AgentLoopRuntimeThreadRegistry};

use agent::session::SessionManager;
use std::sync::Arc;

#[test]
fn background_titles_preserve_manual_renames_and_deleted_threads() {
    use agent::session::models::SessionEvent;

    let sessions = SessionManager::new();
    let id = sessions.create_session_named("first message");
    let mut events = sessions.subscribe();
    let metadata = sessions
        .rename_if_name(&id, "first message", "Summarized title".to_string())
        .unwrap()
        .unwrap();
    assert_eq!(metadata.name, "Summarized title");
    assert!(
        matches!(events.try_recv().unwrap(), SessionEvent::Metadata { metadata, .. }
        if metadata.name == "Summarized title")
    );
    sessions.rename(&id, "My title").unwrap();
    events.try_recv().unwrap();
    assert!(
        sessions
            .rename_if_name(&id, "Summarized title", "Late title".to_string())
            .unwrap()
            .is_none()
    );
    assert_eq!(sessions.metadata(&id).unwrap().name, "My title");
    assert!(events.try_recv().is_err());
    sessions.delete_session(&id).unwrap();
    assert!(
        sessions
            .rename_if_name(&id, "My title", "Late title".to_string())
            .unwrap()
            .is_none()
    );
}

#[tokio::test]
async fn restored_blank_titles_use_the_first_user_message_and_are_persisted() {
    use agent::llm::models::ChatMessage;
    use agent::plugins::models::PluginMeta;
    use agent::session::models::{SessionId, ThreadMetadata};
    use agent::store::StorePlugin;
    use agent::store::models::Store;
    use std::ffi::OsString;

    let data_dir = std::env::temp_dir().join(agent::utils::generate_id("thread-title-test"));
    let ctx = agent::build_agent(agent_config(data_dir.clone()))
        .await
        .unwrap();
    let stores = StorePlugin::get_service(&ctx).unwrap();
    let store = stores
        .get_or_create(&OsString::from("legacy-title"))
        .await
        .unwrap();
    let messages = vec![
        ChatMessage::system("system prompt"),
        ChatMessage::user("  第一条问题：\n如何设计播放器？  "),
        ChatMessage::assistant("回答"),
        ChatMessage::user("第二条问题"),
    ];
    store
        .set("real", serde_json::to_string(&messages).unwrap())
        .await
        .unwrap();
    store
        .set("compaction", serde_json::to_string(&messages).unwrap())
        .await
        .unwrap();
    store
        .set(
            "metadata",
            serde_json::to_string(&ThreadMetadata::new(" ")).unwrap(),
        )
        .await
        .unwrap();
    ctx.dispose();
    drop(ctx);

    let restored = agent::build_agent(agent_config(data_dir.clone()))
        .await
        .unwrap();
    let sessions = agent::session::SessionPlugin::get_service(&restored).unwrap();
    assert_eq!(
        sessions
            .metadata(&SessionId::from("legacy-title"))
            .unwrap()
            .name,
        "第一条问题： 如何设计播放器？"
    );
    let metadata: ThreadMetadata =
        serde_json::from_str(&store.get("metadata").await.unwrap().unwrap()).unwrap();
    assert_eq!(metadata.name, "第一条问题： 如何设计播放器？");
    assert_eq!(
        ThreadMetadata::title_from_input(&"中".repeat(40))
            .chars()
            .count(),
        32
    );
    restored.dispose();
    tokio::fs::remove_dir_all(data_dir).await.unwrap();
}

#[test]
fn runtime_service_owns_thread_metadata_and_deletion() {
    let service = AgentLoopRuntimeService::from_services(
        SessionManager::new(),
        LLMConfigManager::new(),
        None,
    );

    let created = service
        .create_thread(Some("First thread".to_string()))
        .unwrap();
    assert_eq!(created.name, "First thread");
    assert!(created.created_at > 0);
    assert_eq!(created.created_at, created.updated_at);

    assert_eq!(service.list_threads().unwrap(), vec![created.clone()]);
    let snapshot = service.get_thread(&created.id).unwrap().unwrap();
    assert_eq!(snapshot.name, "First thread");
    assert!(snapshot.messages.is_empty());

    assert!(service.delete_thread(&created.id).unwrap());
    assert!(service.get_thread(&created.id).unwrap().is_none());
}

#[test]
fn run_registry_allows_parallel_threads_but_only_one_run_per_thread() {
    let registry = AgentLoopRuntimeThreadRegistry::new();
    let first = registry
        .create_with_id("thread-1", "thread-1-turn1")
        .unwrap();
    assert_eq!(first.run_id, "thread-1-turn1");

    assert!(registry.create_run("thread-1").is_err());
    let second = registry.create_run("thread-2").unwrap();
    assert_ne!(first.run_id, second.run_id);
    assert_eq!(registry.list().len(), 2);

    assert!(registry.cancel(&first.run_id));
    assert!(first.signal.is_aborted());
    assert!(registry.finish(&first.run_id));
    assert!(registry.create_run("thread-1").is_ok());
}

#[test]
fn config_crud_returns_only_masked_api_keys() {
    let service = AgentLoopRuntimeService::from_services(
        SessionManager::new(),
        LLMConfigManager::new(),
        None,
    );
    let created = service
        .create_config(provider_input(None, "First", "sk-secret-value"))
        .unwrap();

    assert_eq!(created.name, "First");
    assert_eq!(created.masked_api_key, "sk-s***");
    assert_ne!(created.masked_api_key, "sk-secret-value");

    let updated = service
        .update_config(
            &created.id,
            provider_input(Some(created.id.clone()), "Updated", "sk-new-secret"),
        )
        .unwrap();
    assert_eq!(updated.id, created.id);
    assert_eq!(updated.name, "Updated");
    let preserved = service
        .update_config(
            &created.id,
            provider_input(Some(created.id.clone()), "Preserved", ""),
        )
        .unwrap();
    assert_eq!(preserved.masked_api_key, "sk-n***");
    assert_eq!(service.list_configs().unwrap(), vec![preserved]);

    assert!(service.delete_config(&created.id).unwrap());
    assert!(service.list_configs().unwrap().is_empty());
}

#[test]
fn ollama_configs_allow_no_key_and_preserve_an_existing_key_on_edit() {
    let configs = Arc::new(LLMConfigManager::new());
    let service =
        AgentLoopRuntimeService::from_services(SessionManager::new(), configs.clone(), None);
    let mut input = provider_input(None, "Local Ollama", "");
    input.provider = "ollama".to_string();
    input.model = "qwen3:8b".to_string();
    input.base_url = None;

    let created = service.create_config(input.clone()).unwrap();
    assert_eq!(created.provider, "ollama");
    assert_eq!(created.masked_api_key, "");
    assert_eq!(created.base_url, None);
    let saved = configs.get_global_config(&created.id).unwrap().unwrap();
    assert_eq!(saved.provider, LLMProvider::Ollama);
    assert!(saved.api_key.is_empty());
    assert_eq!(saved.base_url, None);

    input.name = "Renamed Ollama".to_string();
    input.model = "qwen3:14b".to_string();
    let renamed = service.update_config(&created.id, input.clone()).unwrap();
    assert_eq!(renamed.id, created.id);
    assert_eq!(renamed.name, "Renamed Ollama");
    assert_eq!(renamed.model, "qwen3:14b");
    assert!(renamed.masked_api_key.is_empty());

    input.api_key = "ollama-private-key".to_string();
    input.base_url = Some("https://ollama.example/v1".to_string());
    service.update_config(&created.id, input.clone()).unwrap();
    input.api_key = "   ".to_string();
    let preserved = service.update_config(&created.id, input).unwrap();
    let saved = configs.get_global_config(&created.id).unwrap().unwrap();
    assert_eq!(saved.api_key, "ollama-private-key");
    assert_eq!(saved.base_url.as_deref(), Some("https://ollama.example/v1"));
    assert_ne!(preserved.masked_api_key, saved.api_key);
    assert_eq!(service.list_configs().unwrap(), vec![preserved]);
    assert!(service.delete_config(&created.id).unwrap());
    assert!(service.list_configs().unwrap().is_empty());
}

#[test]
fn openai_still_requires_a_key_when_creating_or_switching_from_keyless_ollama() {
    let service = AgentLoopRuntimeService::from_services(
        SessionManager::new(),
        LLMConfigManager::new(),
        None,
    );
    for key in ["", "   "] {
        assert!(
            service
                .create_config(provider_input(None, "OpenAI", key))
                .unwrap_err()
                .to_string()
                .contains("API Key 不能为空")
        );
    }
    assert!(service.list_configs().unwrap().is_empty());

    let mut input = provider_input(None, "Local Ollama", "");
    input.provider = "ollama".to_string();
    let created = service.create_config(input).unwrap();
    assert!(
        service
            .update_config(&created.id, provider_input(None, "OpenAI", ""))
            .unwrap_err()
            .to_string()
            .contains("API Key 不能为空")
    );
    assert_eq!(service.list_configs().unwrap(), vec![created]);
}

#[tokio::test]
async fn keyless_ollama_config_is_encrypted_and_restored_on_agent_restart() {
    use agent::llm::plugins::LLMConfigPlugin;
    use agent::plugins::models::PluginMeta;
    use agent::store::StorePlugin;
    use agent::store::models::Store;
    use std::ffi::OsString;
    use std::time::Duration;

    let data_dir = std::env::temp_dir().join(agent::utils::generate_id("ollama-config-test"));
    let ctx = agent::build_agent(agent_config(data_dir.clone()))
        .await
        .unwrap();
    let service = AgentLoopRuntimeService::from_ctx(&ctx).unwrap();
    let mut input = provider_input(None, "Persisted Ollama", "");
    input.provider = "ollama".to_string();
    input.model = "qwen3:8b".to_string();
    input.base_url = None;
    let created = service.create_config(input).unwrap();

    let stores = StorePlugin::get_service(&ctx).unwrap();
    tokio::time::timeout(Duration::from_secs(2), async {
        loop {
            if let Some(store) = stores.get(&OsString::from("llm-configs")).await.unwrap()
                && let Ok(Some(raw)) = store.get("items").await
                && raw.contains(&created.id)
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
    let encrypted = tokio::fs::read_to_string(data_dir.join("llm-configs/items"))
        .await
        .unwrap();
    assert!(!encrypted.contains("Persisted Ollama"));
    assert!(!encrypted.contains("qwen3:8b"));
    ctx.dispose();
    drop(service);
    drop(stores);
    drop(ctx);

    let restored_ctx = agent::build_agent(agent_config(data_dir.clone()))
        .await
        .unwrap();
    let restored_service = AgentLoopRuntimeService::from_ctx(&restored_ctx).unwrap();
    assert_eq!(
        restored_service.list_configs().unwrap(),
        vec![created.clone()]
    );
    let configs = LLMConfigPlugin::get_service(&restored_ctx).unwrap();
    let restored = configs.get_global_config(&created.id).unwrap().unwrap();
    assert_eq!(restored.provider, LLMProvider::Ollama);
    assert!(restored.api_key.is_empty());
    assert_eq!(restored.base_url, None);
    restored_ctx.dispose();
    tokio::fs::remove_dir_all(data_dir).await.unwrap();
}

fn agent_config(path: std::path::PathBuf) -> agent::AgentConfig {
    agent::AgentConfig {
        store_config: agent::store::StoreConfig {
            path,
            secret: "ollama-config-test-secret".to_string(),
        },
        llm_compactor_config: agent::llm::plugins::LLMCompactorConfig {
            keep: 10,
            threshold: 0.8,
        },
        max_turns_config: agent::plugins::max_turns::MaxTurnsConfig { max_turns: 10 },
        loop_config: agent::r#loop::LoopConfig {
            max_steps_per_turn: 5,
        },
    }
}

#[test]
fn the_first_config_becomes_default_without_the_electron_facade() {
    let service = AgentLoopRuntimeService::from_services(
        SessionManager::new(),
        LLMConfigManager::new(),
        None,
    );
    let mut first_input = provider_input(None, "First", "sk-first");
    first_input.default = false;
    assert!(service.create_config(first_input).unwrap().default);
    let mut second_input = provider_input(None, "Second", "sk-second");
    second_input.default = false;
    assert!(!service.create_config(second_input).unwrap().default);
}

#[test]
fn config_binding_rejects_a_missing_thread() {
    let service = AgentLoopRuntimeService::from_services(
        SessionManager::new(),
        LLMConfigManager::new(),
        None,
    );
    let config = service
        .create_config(provider_input(None, "First", "sk-secret-value"))
        .unwrap();

    assert!(
        service
            .set_thread_config("missing-thread", &config.id)
            .unwrap_err()
            .to_string()
            .contains("会话 missing-thread 不存在")
    );
}

fn provider_input(id: Option<String>, name: &str, api_key: &str) -> ProviderConfigInput {
    ProviderConfigInput {
        id,
        name: name.to_string(),
        provider: "openai".to_string(),
        model: "model-1".to_string(),
        api_key: api_key.to_string(),
        context_size: "128K".to_string(),
        base_url: Some("https://example.com/v1".to_string()),
        headers: None,
        other: None,
        default: true,
        thinking: false,
    }
}
