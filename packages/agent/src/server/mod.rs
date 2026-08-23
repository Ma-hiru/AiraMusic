pub mod bootstrap;

use crate::agui::models::AguiEvent;
use crate::api::models::{
    AgentServiceStatus, ApiError, CreateRunRequest, CreateThreadRequest, HealthResponse,
    ProviderConfigInput, SetThreadConfigRequest,
};
use crate::cancel::Signal;
use crate::runtime::AgentRuntimeService;
use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, Request, StatusCode};
use axum::middleware::{self, Next};
use axum::response::sse::{Event, KeepAlive};
use axum::response::{IntoResponse, Response, Sse};
use axum::routing::{get, post};
use axum::{Json, Router};
use futures::StreamExt;
use std::convert::Infallible;
use std::sync::Arc;
use subtle::ConstantTimeEq;
use tokio::sync::broadcast;
use tokio_stream::wrappers::BroadcastStream;

pub const AGENT_PROTOCOL_VERSION: u16 = 1;

#[derive(Clone)]
pub struct AgentServerState {
    runtime: AgentRuntimeService,
    control_token: Arc<Vec<u8>>,
    events: broadcast::Sender<AguiEvent>,
    shutdown: Signal,
}

impl AgentServerState {
    pub fn new(
        runtime: AgentRuntimeService,
        control_token: impl AsRef<str>,
        events: broadcast::Sender<AguiEvent>,
    ) -> Self {
        Self {
            runtime,
            control_token: Arc::new(control_token.as_ref().as_bytes().to_vec()),
            events,
            shutdown: Signal::new(),
        }
    }

    pub fn shutdown_signal(&self) -> Signal {
        self.shutdown.clone()
    }
}

pub fn build_router(state: AgentServerState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/shutdown", post(shutdown))
        .route("/v1/events", get(events))
        .route("/v1/threads", get(list_threads).post(create_thread))
        .route("/v1/runs", get(list_runs))
        .route("/v1/runs/{id}/cancel", post(cancel_run))
        .route("/v1/providers", get(list_providers))
        .route("/v1/configs", get(list_configs).post(create_config))
        .route(
            "/v1/configs/{id}",
            axum::routing::put(update_config).delete(delete_config),
        )
        .route("/v1/threads/{id}", get(get_thread).delete(delete_thread))
        .route("/v1/threads/{id}/runs", post(create_run))
        .route(
            "/v1/threads/{id}/config",
            axum::routing::put(set_thread_config),
        )
        .layer(middleware::from_fn_with_state(state.clone(), authorize))
        .with_state(state)
}

async fn authorize(
    State(state): State<AgentServerState>,
    headers: HeaderMap,
    request: Request<Body>,
    next: Next,
) -> Response {
    let supplied = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::as_bytes);
    let valid = supplied.is_some_and(|token| {
        token.len() == state.control_token.len()
            && bool::from(token.ct_eq(state.control_token.as_slice()))
    });
    if !valid {
        return api_error(
            StatusCode::UNAUTHORIZED,
            "unauthorized",
            "Agent 控制鉴权失败",
        );
    }
    next.run(request).await
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: AgentServiceStatus::Ready,
        protocol_version: AGENT_PROTOCOL_VERSION,
    })
}

async fn shutdown(State(state): State<AgentServerState>) -> StatusCode {
    state.shutdown.cancel();
    StatusCode::NO_CONTENT
}

async fn events(
    State(state): State<AgentServerState>,
) -> Sse<impl futures::Stream<Item = Result<Event, Infallible>>> {
    let stream = BroadcastStream::new(state.events.subscribe()).filter_map(|event| async move {
        match event {
            Ok(event) => Event::default().json_data(event).ok().map(Ok),
            Err(error) => {
                tracing::warn!(error = %error, "AG-UI 事件订阅滞后");
                None
            }
        }
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}

async fn create_thread(
    State(state): State<AgentServerState>,
    Json(request): Json<CreateThreadRequest>,
) -> Response {
    match state.runtime.create_thread(request.name) {
        Ok(thread) => (StatusCode::CREATED, Json(thread)).into_response(),
        Err(error) => internal_error(error),
    }
}

async fn list_threads(State(state): State<AgentServerState>) -> Response {
    match state.runtime.list_threads() {
        Ok(threads) => Json(threads).into_response(),
        Err(error) => internal_error(error),
    }
}

async fn get_thread(State(state): State<AgentServerState>, Path(id): Path<String>) -> Response {
    match state.runtime.get_thread(&id) {
        Ok(Some(thread)) => Json(thread).into_response(),
        Ok(None) => api_error(StatusCode::NOT_FOUND, "thread_not_found", "会话不存在"),
        Err(error) => internal_error(error),
    }
}

async fn delete_thread(State(state): State<AgentServerState>, Path(id): Path<String>) -> Response {
    match state.runtime.delete_thread(&id) {
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => api_error(StatusCode::NOT_FOUND, "thread_not_found", "会话不存在"),
        Err(error) => api_error(StatusCode::CONFLICT, "thread_busy", &error.to_string()),
    }
}

async fn create_run(
    State(state): State<AgentServerState>,
    Path(thread_id): Path<String>,
    Json(request): Json<CreateRunRequest>,
) -> Response {
    match state.runtime.create_run(&thread_id, request.content) {
        Ok(run) => (StatusCode::ACCEPTED, Json(run)).into_response(),
        Err(error) => api_error(StatusCode::CONFLICT, "run_rejected", &error.to_string()),
    }
}

async fn list_runs(State(state): State<AgentServerState>) -> Response {
    Json(state.runtime.list_runs()).into_response()
}

async fn list_providers(State(state): State<AgentServerState>) -> Response {
    Json(state.runtime.list_providers()).into_response()
}

async fn cancel_run(State(state): State<AgentServerState>, Path(id): Path<String>) -> Response {
    if state.runtime.cancel_run(&id) {
        StatusCode::NO_CONTENT.into_response()
    } else {
        api_error(StatusCode::NOT_FOUND, "run_not_found", "运行不存在")
    }
}

async fn create_config(
    State(state): State<AgentServerState>,
    Json(input): Json<ProviderConfigInput>,
) -> Response {
    match state.runtime.create_config(input) {
        Ok(config) => (StatusCode::CREATED, Json(config)).into_response(),
        Err(error) => api_error(
            StatusCode::BAD_REQUEST,
            "invalid_config",
            &error.to_string(),
        ),
    }
}

async fn list_configs(State(state): State<AgentServerState>) -> Response {
    match state.runtime.list_configs() {
        Ok(configs) => Json(configs).into_response(),
        Err(error) => internal_error(error),
    }
}

async fn update_config(
    State(state): State<AgentServerState>,
    Path(id): Path<String>,
    Json(input): Json<ProviderConfigInput>,
) -> Response {
    match state.runtime.update_config(&id, input) {
        Ok(config) => Json(config).into_response(),
        Err(error) => api_error(
            StatusCode::BAD_REQUEST,
            "invalid_config",
            &error.to_string(),
        ),
    }
}

async fn delete_config(State(state): State<AgentServerState>, Path(id): Path<String>) -> Response {
    match state.runtime.delete_config(&id) {
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => api_error(StatusCode::NOT_FOUND, "config_not_found", "配置不存在"),
        Err(error) => internal_error(error),
    }
}

async fn set_thread_config(
    State(state): State<AgentServerState>,
    Path(thread_id): Path<String>,
    Json(request): Json<SetThreadConfigRequest>,
) -> Response {
    match state
        .runtime
        .set_thread_config(&thread_id, &request.config_id)
    {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => api_error(
            StatusCode::NOT_FOUND,
            "binding_not_found",
            &error.to_string(),
        ),
    }
}

fn internal_error(error: anyhow::Error) -> Response {
    tracing::error!(error = %error, "Agent API 请求失败");
    api_error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        "Agent 服务请求失败",
    )
}

fn api_error(status: StatusCode, code: &str, message: &str) -> Response {
    (
        status,
        Json(ApiError {
            code: code.to_string(),
            message: message.to_string(),
        }),
    )
        .into_response()
}
