//! 真实网络的冒烟测试（默认 `#[ignore]`，手动跑：`cargo test --lib ncm::live -- --ignored`）。
//!
//! 只校验"能拿到结构正确的数据"，不做逐字段断言——逐字段的保真度由
//! `parity.rs` / `routes_parity.rs` 对拍 JS 版保证。

#![cfg(test)]

use std::sync::Arc;
use std::time::Duration;

use serde_json::Value;

use crate::ncm::request::Ctx;
use crate::ncm::testkit;

async fn call(app: &str, path: &str) -> (u16, Value) {
    let response = testkit::test_client()
        .get(format!("{app}{path}"))
        .send()
        .await
        .unwrap_or_else(|error| panic!("{path}: {error}"));
    let status = response.status().as_u16();
    let body = response.json::<Value>().await.unwrap_or(Value::Null);
    (status, body)
}

#[tokio::test]
#[ignore = "需要真实网络"]
async fn live_endpoints_return_real_data() {
    let ctx = Arc::new(Ctx::new(
        crate::http::client(Duration::from_secs(20)),
        crate::ncm::device_id(),
        crate::ncm::anonymous_token(),
        crate::ncm::util::generate_random_chinese_ip(),
    ));
    let app = testkit::serve(ctx).await;

    type Check = fn(&Value) -> bool;
    let cases: &[(&str, Check)] = &[
        ("/banner?type=0", |body| {
            body["banners"]
                .as_array()
                .map(|v| !v.is_empty())
                .unwrap_or(false)
        }),
        ("/personalized?limit=6", |body| {
            body["result"]
                .as_array()
                .map(|v| !v.is_empty())
                .unwrap_or(false)
        }),
        (
            "/search?keywords=%E5%91%A8%E6%9D%B0%E4%BC%A6&limit=3",
            |body| {
                body["result"]["songs"]
                    .as_array()
                    .map(|v| !v.is_empty())
                    .unwrap_or(false)
            },
        ),
        ("/playlist/detail?id=3778678", |body| {
            body["playlist"]["name"]
                .as_str()
                .map(|v| !v.is_empty())
                .unwrap_or(false)
        }),
        ("/song/detail?ids=1974443814", |body| {
            body["songs"]
                .as_array()
                .map(|v| v.len() == 1)
                .unwrap_or(false)
        }),
        ("/lyric/new?id=1974443814", |body| {
            body["lrc"]["lyric"]
                .as_str()
                .map(|v| !v.is_empty())
                .unwrap_or(false)
        }),
        ("/song/url/v1?id=1974443814&level=exhigh", |body| {
            body["data"][0]["url"]
                .as_str()
                .map(|v| !v.is_empty())
                .unwrap_or(false)
        }),
        ("/mv/url?id=5436712", |body| {
            body["data"]["url"]
                .as_str()
                .map(|v| !v.is_empty())
                .unwrap_or(false)
        }),
        ("/user/account", |body| body["code"].as_u64() == Some(200)),
    ];

    let mut failures = Vec::new();
    for (path, check) in cases {
        let (status, body) = call(&app, path).await;
        if status != 200 || !check(&body) {
            failures.push(format!("{path} → {status} {}", truncate(&body)));
        }
    }
    assert!(
        failures.is_empty(),
        "以下接口异常:\n{}",
        failures.join("\n")
    );
}

fn truncate(body: &Value) -> String {
    let text = body.to_string();
    text.chars().take(300).collect()
}
