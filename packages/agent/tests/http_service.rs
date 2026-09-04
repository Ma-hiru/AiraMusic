use agent::agui::models::AguiEvent;
use agent::llm::plugins::config::LLMConfigManager;
use agent::server::runtime::AgentLoopRuntimeService;
use agent::session::SessionManager;
use axum::body::Body;
use http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tokio::sync::broadcast;
use tower::ServiceExt;

#[tokio::test]
async fn control_routes_require_the_exact_bearer_token() {
    let (events, _) = broadcast::channel(8);
    let app = build_router(test_state("control-secret", events));

    let missing = app
        .clone()
        .oneshot(Request::get("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(missing.status(), StatusCode::UNAUTHORIZED);

    let invalid = app
        .clone()
        .oneshot(
            Request::get("/health")
                .header("authorization", "Bearer wrong-secret")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(invalid.status(), StatusCode::UNAUTHORIZED);

    let valid = app
        .oneshot(authorized(Request::get("/health"), Body::empty()))
        .await
        .unwrap();
    assert_eq!(valid.status(), StatusCode::OK);
    assert_eq!(
        json_body(valid).await,
        json!({ "status": "ready", "protocolVersion": 1 })
    );
}

#[tokio::test]
async fn shutdown_route_is_authenticated_and_signals_graceful_shutdown() {
    let (events, _) = broadcast::channel(8);
    let state = test_state("control-secret", events);
    let shutdown = state.shutdown_signal();
    let app = build_router(state);

    let response = app
        .oneshot(authorized(Request::post("/shutdown"), Body::empty()))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    assert!(shutdown.is_aborted());
}

#[tokio::test]
async fn thread_routes_use_the_runtime_facade() {
    let (events, _) = broadcast::channel(8);
    let app = build_router(test_state("control-secret", events));
    let create = app
        .clone()
        .oneshot(authorized(
            Request::post("/v1/threads").header("content-type", "application/json"),
            Body::from(r#"{"name":"HTTP thread"}"#),
        ))
        .await
        .unwrap();
    assert_eq!(create.status(), StatusCode::CREATED);
    let created = json_body(create).await;
    assert_eq!(created["name"], "HTTP thread");

    let list = app
        .clone()
        .oneshot(authorized(Request::get("/v1/threads"), Body::empty()))
        .await
        .unwrap();
    assert_eq!(list.status(), StatusCode::OK);
    assert_eq!(json_body(list).await[0]["id"], created["id"]);

    let detail = app
        .clone()
        .oneshot(authorized(
            Request::get(format!("/v1/threads/{}", created["id"].as_str().unwrap())),
            Body::empty(),
        ))
        .await
        .unwrap();
    assert_eq!(detail.status(), StatusCode::OK);

    let deleted = app
        .clone()
        .oneshot(authorized(
            Request::delete(format!("/v1/threads/{}", created["id"].as_str().unwrap())),
            Body::empty(),
        ))
        .await
        .unwrap();
    assert_eq!(deleted.status(), StatusCode::NO_CONTENT);

    let missing = app
        .oneshot(authorized(
            Request::get(format!("/v1/threads/{}", created["id"].as_str().unwrap())),
            Body::empty(),
        ))
        .await
        .unwrap();
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn config_routes_mask_secrets_and_bind_a_config_to_a_thread() {
    let (events, _) = broadcast::channel(8);
    let app = build_router(test_state("control-secret", events));
    let thread = app
        .clone()
        .oneshot(authorized(
            Request::post("/v1/threads").header("content-type", "application/json"),
            Body::from("{}"),
        ))
        .await
        .unwrap();
    let thread = json_body(thread).await;

    let create = app
        .clone()
        .oneshot(authorized(
            Request::post("/v1/configs").header("content-type", "application/json"),
            Body::from(provider_json("Initial", "sk-super-secret")),
        ))
        .await
        .unwrap();
    assert_eq!(create.status(), StatusCode::CREATED);
    let created = json_body(create).await;
    assert_eq!(created["maskedApiKey"], "sk-s***");
    assert!(!created.to_string().contains("sk-super-secret"));
    let config_id = created["id"].as_str().unwrap();

    let update = app
        .clone()
        .oneshot(authorized(
            Request::put(format!("/v1/configs/{config_id}"))
                .header("content-type", "application/json"),
            Body::from(provider_json("Updated", "sk-new-secret")),
        ))
        .await
        .unwrap();
    assert_eq!(update.status(), StatusCode::OK);
    assert_eq!(json_body(update).await["name"], "Updated");

    let bind = app
        .clone()
        .oneshot(authorized(
            Request::put(format!(
                "/v1/threads/{}/config",
                thread["id"].as_str().unwrap()
            ))
            .header("content-type", "application/json"),
            Body::from(format!(r#"{{"configId":"{config_id}"}}"#)),
        ))
        .await
        .unwrap();
    assert_eq!(bind.status(), StatusCode::NO_CONTENT);

    let list = app
        .clone()
        .oneshot(authorized(Request::get("/v1/configs"), Body::empty()))
        .await
        .unwrap();
    let listed = json_body(list).await;
    assert_eq!(listed.as_array().unwrap().len(), 1);
    assert_eq!(listed[0]["name"], "Updated");
    assert!(!listed.to_string().contains("sk-new-secret"));

    let deleted = app
        .oneshot(authorized(
            Request::delete(format!("/v1/configs/{config_id}")),
            Body::empty(),
        ))
        .await
        .unwrap();
    assert_eq!(deleted.status(), StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn provider_route_is_owned_by_the_agent_service() {
    let (events, _) = broadcast::channel(8);
    let app = build_router(test_state("control-secret", events));
    let response = app
        .oneshot(authorized(Request::get("/v1/providers"), Body::empty()))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let providers = json_body(response).await;
    assert_eq!(providers[0]["id"], "openai");
    assert_eq!(
        providers[0]["configSchema"]["required"],
        json!(["model", "apiKey"])
    );
}

#[tokio::test]
async fn event_stream_serializes_canonical_agui_events() {
    let (events, _) = broadcast::channel(8);
    let app = build_router(test_state("control-secret", events.clone()));
    let response = app
        .oneshot(authorized(Request::get("/v1/events"), Body::empty()))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    events
        .send(AguiEvent::RunStarted {
            session_id: "thread-1".to_string(),
            run_id: "run-1".to_string(),
        })
        .unwrap();

    let mut stream = response.into_body().into_data_stream();
    let chunk = tokio::time::timeout(std::time::Duration::from_secs(1), stream.next())
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    let text = String::from_utf8(chunk.to_vec()).unwrap();
    assert!(text.contains("data: {\"type\":\"RUN_STARTED\""));
    assert!(text.contains("\"threadId\":\"thread-1\""));
}

fn test_state(token: &str, events: broadcast::Sender<AguiEvent>) -> AgentServerState {
    AgentServerState::new(
        AgentLoopRuntimeService::from_services(
            SessionManager::new(),
            LLMConfigManager::new(),
            None,
        ),
        token,
        events,
    )
}

fn authorized(builder: http::request::Builder, body: Body) -> Request<Body> {
    builder
        .header("authorization", "Bearer control-secret")
        .body(body)
        .unwrap()
}

async fn json_body(response: axum::response::Response) -> Value {
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap()
}

fn provider_json(name: &str, api_key: &str) -> String {
    json!({
        "name": name,
        "provider": "openai",
        "model": "model-1",
        "apiKey": api_key,
        "contextSize": "128K",
        "baseUrl": "https://example.com/v1",
        "default": true,
        "thinking": false
    })
    .to_string()
}

use agent::server::router::build_router;
use agent::server::service::AgentServerState;
use futures::StreamExt;
