use agent::llm::plugins::config::LLMConfigManager;
use agent::server::models::ProviderConfigInput;
use agent::server::runtime::{AgentLoopRuntimeService, AgentLoopRuntimeThreadRegistry};

use agent::session::SessionManager;

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
