//! 真实网络冒烟（默认 ignored）：`cargo test --lib agent::live -- --ignored`

#![cfg(test)]

use serde_json::{json, Value};

use crate::agent::{bangumi, webtool};

#[tokio::test]
#[ignore = "需要真实网络"]
async fn bangumi_search_and_detail() {
    let args = json!({ "action": "search", "query": "孤独摇滚", "kind": "subject" });
    let result = bangumi::call(args.as_object().unwrap())
        .await
        .expect("search");
    let items = result["items"].as_array().expect("items");
    assert!(!items.is_empty(), "搜索结果为空: {result}");
    let id = items[0]["id"].as_u64().expect("id");

    let detail = bangumi::call(
        json!({ "action": "subject", "id": id, "include": ["characters"], "detail": "detailed" })
            .as_object()
            .unwrap(),
    )
    .await
    .expect("subject");
    assert_eq!(detail["id"], json!(id));
    assert!(detail["name"]
        .as_str()
        .map(|v| !v.is_empty())
        .unwrap_or(false));
    assert!(detail["characters"]["items"].as_array().is_some());
}

#[tokio::test]
#[ignore = "需要真实网络"]
async fn web_snapshot_reads_static_page() {
    let result = webtool::snapshot(
        json!({ "action": "open", "url": "https://example.com", "max_chars": 1000 })
            .as_object()
            .unwrap(),
    )
    .await
    .expect("open");
    assert!(result["content"]
        .as_str()
        .map(|v| !v.is_empty())
        .unwrap_or(false));
    assert_eq!(result["title"], json!("Example Domain"));
}

#[tokio::test]
#[ignore = "需要真实网络"]
async fn web_snapshot_searches_bing() {
    let result: Value = webtool::snapshot(
        json!({ "action": "search", "query": "tauri v2", "limit": 3 })
            .as_object()
            .unwrap(),
    )
    .await
    .expect("search");
    assert!(
        result["results"]
            .as_array()
            .map(|v| !v.is_empty())
            .unwrap_or(false),
        "{result}"
    );
}
