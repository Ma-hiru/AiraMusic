//! 测试辅助：本地 mock 上游 + 一个监听真实端口的 ncm 服务。
//!
//! 只在 `cfg(test)` 下编译。mock 上游记录收到的每个请求，
//! 便于断言 Rust 侧真正发出去的东西（而不是只看返回值）。

use std::sync::{Arc, Mutex};

use axum::http::HeaderMap;
use serde_json::Value;

#[derive(Clone, Debug)]
pub struct Recorded {
    pub method: String,
    pub path: String,
    pub headers: HeaderMap,
    pub body: String,
}

impl Recorded {
    /// 把 `params=` 解回明文（eapi）
    pub fn plaintext(&self) -> Value {
        self.body
            .split('&')
            .find_map(|pair| pair.strip_prefix("params="))
            .and_then(crate::ncm::crypto::eapi_req_decrypt)
            .map(|(_, data)| data)
            .unwrap_or(Value::Null)
    }
}

#[derive(Clone)]
pub struct Reply {
    pub status: u16,
    pub body: String,
    pub cookies: Vec<String>,
}

impl Reply {
    pub fn json(body: Value) -> Self {
        Self {
            status: 200,
            body: body.to_string(),
            cookies: Vec::new(),
        }
    }

    pub fn with_cookie(mut self, cookie: &str) -> Self {
        self.cookies.push(cookie.to_string());
        self
    }
}

pub struct MockUpstream {
    pub base: String,
    received: Arc<Mutex<Vec<Recorded>>>,
}

impl MockUpstream {
    pub async fn start(replies: Vec<Reply>) -> Self {
        use axum::extract::State;
        use axum::response::IntoResponse;

        type Shared = (Arc<Mutex<Vec<Reply>>>, Arc<Mutex<Vec<Recorded>>>);
        let received: Arc<Mutex<Vec<Recorded>>> = Arc::new(Mutex::new(Vec::new()));
        let state: Shared = (Arc::new(Mutex::new(replies)), received.clone());

        let app = axum::Router::new()
            .fallback(
                |State((replies, received)): State<Shared>, request: axum::extract::Request| async move {
                    let (parts, body) = request.into_parts();
                    let bytes = axum::body::to_bytes(body, 4 * 1024 * 1024)
                        .await
                        .unwrap_or_default();
                    {
                        let mut guard = received.lock().unwrap();
                        guard.push(Recorded {
                            method: parts.method.to_string(),
                            path: parts.uri.path().to_string(),
                            headers: parts.headers.clone(),
                            body: String::from_utf8_lossy(&bytes).into_owned(),
                        });
                    }
                    let reply = {
                        let mut guard = replies.lock().unwrap();
                        if guard.is_empty() {
                            Reply::json(serde_json::json!({ "code": 200 }))
                        } else {
                            guard.remove(0)
                        }
                    };
                    let mut response = (
                        axum::http::StatusCode::from_u16(reply.status).unwrap(),
                        reply.body,
                    )
                        .into_response();
                    for cookie in reply.cookies {
                        if let Ok(value) = cookie.parse() {
                            response
                                .headers_mut()
                                .append(axum::http::header::SET_COOKIE, value);
                        }
                    }
                    response
                },
            )
            .with_state(state);

        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.ok();
        });

        Self {
            base: format!("http://{address}"),
            received,
        }
    }

    pub fn requests(&self) -> Vec<Recorded> {
        self.received.lock().unwrap().clone()
    }

    pub fn last(&self) -> Recorded {
        self.received
            .lock()
            .unwrap()
            .last()
            .cloned()
            .expect("mock 未收到请求")
    }
}

/// 起一个真实的 ncm 服务（监听 127.0.0.1 随机端口）
pub async fn serve(ctx: Arc<crate::ncm::request::Ctx>) -> String {
    let app = crate::ncm::server::router(ctx);
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
        .await
        .unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });
    format!("http://{address}")
}

pub fn test_client() -> reqwest::Client {
    // 测试机上存在 HTTP_PROXY，localhost 必须绕过
    reqwest::Client::builder()
        .no_proxy()
        .build()
        .expect("client")
}

pub fn ctx() -> Arc<crate::ncm::request::Ctx> {
    Arc::new(crate::ncm::request::Ctx::new(
        test_client(),
        "A1B2C3D4E5F60718293A4B5C6D7E8F90123456789ABCDEF0123456789ABCDEF0".to_string(),
        "guest-token".to_string(),
        "1.2.4.8".to_string(),
    ))
}
