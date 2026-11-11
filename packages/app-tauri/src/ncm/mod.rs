//! ncm 兼容层：把上游 `@neteasecloudmusicapienhanced/api` 的核心链路
//! 1:1 复刻成 Rust。
//!
//! 分层与 JS 版严格对应：
//!
//! | JS                          | Rust              |
//! | --------------------------- | ----------------- |
//! | `util/config.json` + 常量表  | `config.rs`       |
//! | `util/index.js`             | `util.rs`         |
//! | `util/crypto.js`            | `crypto.rs`       |
//! | `util/option.js`            | `option.rs`       |
//! | `util/request.js`           | `request.rs`      |
//! | `server.js`                 | `server.rs`       |
//! | `module/*.js`（仅 modDef 内）| `routes/`         |
//!
//! 对外只暴露 `router()` / `serve()` / `set_device_id()`，宿主不需要知道内部细节。

pub mod config;
pub mod crypto;
pub mod ncbl;
pub mod option;
pub mod request;
pub mod routes;
pub mod scrobble;
pub mod server;
pub mod upload;
pub mod util;
pub mod xeapi;

#[cfg(test)]
mod live;
#[cfg(test)]
mod parity;
#[cfg(test)]
mod routes_parity;
#[cfg(test)]
mod testkit;

use std::sync::{Arc, OnceLock};
use std::time::Duration;

use axum::Router;

use crate::ncm::request::Ctx;

/// 进程级 deviceId（对应 Electron 的 `inner/ncm/deviceId`）
///
/// 用 `RwLock` 而不是 `OnceLock`：宿主在 setup 里注入真实设备号，
/// 而首次访问可能早于注入（例如 dev 端口先起），需要允许"先兜底、后被覆盖"。
static DEVICE_ID: std::sync::RwLock<Option<String>> = std::sync::RwLock::new(None);
static CTX: OnceLock<Arc<Ctx>> = OnceLock::new();

pub fn set_device_id(id: String) {
    if let Ok(mut slot) = DEVICE_ID.write() {
        *slot = Some(id);
    }
}

/// 稳定的设备号：没有注入时生成一次并缓存，之后始终返回同一个值
pub fn device_id() -> String {
    if let Ok(slot) = DEVICE_ID.read() {
        if let Some(id) = slot.as_ref() {
            return id.clone();
        }
    }
    let generated = util::generate_device_id();
    if let Ok(mut slot) = DEVICE_ID.write() {
        return slot.get_or_insert(generated).clone();
    }
    generated
}

/// `/tmp/anonymous_token`（Electron 版 bootstrap 产物），有就复用
pub fn anonymous_token() -> String {
    std::fs::read_to_string(std::env::temp_dir().join("anonymous_token"))
        .ok()
        .map(|text| text.trim().to_string())
        .unwrap_or_default()
}

/// 进程级上下文：相当于 JS 里的 `global.deviceId` / `global.cnIp` / `NMTID`
pub fn ctx() -> Arc<Ctx> {
    CTX.get_or_init(|| {
        Arc::new(
            Ctx::new(
                crate::http::client(Duration::from_secs(15)),
                device_id(),
                anonymous_token(),
                util::generate_random_chinese_ip(),
            )
            .with_anticheat(Arc::new(|_| {
                Box::pin(async { crate::anticheat::token().await.unwrap_or_default() })
            })),
        )
    })
    .clone()
}

/// ncm 路由。供内置 HTTP listener 以 `/api` 前缀挂载。
pub fn router() -> Router {
    server::router(ctx())
}

/// 单独启动 ncm 服务。开发期 Vite 的 `/api` 代理指向它；
/// 生产链路走 `server::serve`（挂在 `/api` 子路由上）。
pub async fn serve(port: u16) -> anyhow::Result<()> {
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port)).await?;
    crate::host_log!("[ncm] listening on http://127.0.0.1:{port}");
    axum::serve(listener, router()).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn device_id_is_generated_when_unset() {
        let id = device_id();
        assert_eq!(id.len(), 52, "应与 generateDeviceId 一致");
        assert_eq!(id, device_id(), "同一进程内必须稳定");
    }

    #[test]
    fn anonymous_token_is_trimmed() {
        let token = anonymous_token();
        assert_eq!(token, token.trim());
    }

    #[test]
    fn router_reuses_a_single_context() {
        let _ = router();
        let first = ctx();
        let second = ctx();
        assert!(Arc::ptr_eq(&first, &second), "ctx 必须是进程级单例");
    }
}
