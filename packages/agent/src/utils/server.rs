use crate::server::models::ApiError;
use axum::Json;
use axum::response::{IntoResponse, Response};
use http::StatusCode;

pub fn internal_error(error: anyhow::Error) -> Response {
    tracing::error!(error = %error, "Agent API 请求失败");
    api_error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        "Agent 服务请求失败",
    )
}

pub fn api_error(status: StatusCode, code: &str, message: &str) -> Response {
    (
        status,
        Json(ApiError {
            code: code.to_string(),
            message: message.to_string(),
        }),
    )
        .into_response()
}
