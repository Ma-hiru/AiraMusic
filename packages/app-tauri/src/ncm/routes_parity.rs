//! 路由层对拍：`tests/fixtures/ncm-route-cases.json` 由
//! `temp/ncm-oracle-routes.mjs` 生成——它逐个执行上游 `module/*.js`
//! （仅 `ncmModDef.ts` 里声明的 99 个），把 `(uri, data, options)` 记下来。
//!
//! 这里用同一份 query 跑 `routes::build`，逐条比对。差异会汇总后一次性报出，
//! 方便按模块逐个修正。

#![cfg(test)]

use serde_json::{Map, Value};

use crate::ncm::routes;

const FIXTURE: &str = include_str!("../../tests/fixtures/ncm-route-cases.json");

/// 已知未移植的接口：它们不走 `request`（NCBL 上报 / NOS 分片上传 / 本地二维码生成）
const UNSUPPORTED: &[&str] = &["scrobble_v1", "playlist_cover_update", "login_qr_create"];

fn normalize(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut out = Map::new();
            for (key, item) in map {
                out.insert(key.clone(), normalize(item));
            }
            Value::Object(out)
        }
        Value::Array(items) => Value::Array(items.iter().map(normalize).collect()),
        Value::String(text) if is_timestamp(text) => Value::String("<ts>".into()),
        Value::Number(number) => match number.as_u64() {
            Some(value) if (1_600_000_000_000..2_000_000_000_000).contains(&value) => {
                Value::String("<ts>".into())
            }
            _ => value.clone(),
        },
        other => other.clone(),
    }
}

fn is_timestamp(text: &str) -> bool {
    text.len() == 13 && text.starts_with('1') && text.chars().all(|c| c.is_ascii_digit())
}

fn text(value: &Value) -> String {
    serde_json::to_string(&normalize(value)).unwrap_or_default()
}

#[test]
fn route_build_matches_js_modules() {
    let fixture: Value = serde_json::from_str(FIXTURE).expect("fixture");
    let cases = fixture["cases"].as_array().expect("cases");
    let mut failures: Vec<String> = Vec::new();
    let mut checked = 0;

    for case in cases {
        let identifier = case["identifier"].as_str().unwrap_or("?");
        let label = case["label"].as_str().unwrap_or("?");
        if UNSUPPORTED.contains(&identifier) {
            continue;
        }
        if case["uri"].is_null() && case["error"].is_null() {
            // 该模块不走 `request`（本地生成 / NCBL 另一套传输），单独处理
            continue;
        }
        let Some(expected_uri) = case["uri"].as_str() else {
            // 模块在发请求之前就拒绝了（缺必填参数），Rust 侧应同样失败
            let Some(route) = routes::all()
                .into_iter()
                .find(|route| route.identifier == identifier)
            else {
                failures.push(format!("{identifier}/{label}: Rust 侧缺少该路由"));
                continue;
            };
            let query: Map<String, Value> = case["query"].as_object().cloned().unwrap_or_default();
            match routes::build(route, &query) {
                Err(error) if error.status == 400 => {}
                Err(error) => failures.push(format!(
                    "{identifier}/{label}: 预期 400，实际 {}",
                    error.status
                )),
                Ok(_) => failures.push(format!("{identifier}/{label}: 预期提前失败，实际成功")),
            }
            continue;
        };
        let Some(route) = routes::all()
            .into_iter()
            .find(|route| route.identifier == identifier)
        else {
            failures.push(format!("{identifier}/{label}: Rust 侧缺少该路由"));
            continue;
        };

        let query: Map<String, Value> = case["query"].as_object().cloned().unwrap_or_default();
        let (uri, data, options) = match routes::build(route, &query) {
            Ok(call) => call,
            Err(error) => {
                failures.push(format!(
                    "{identifier}/{label}: Rust 侧提前失败 {}",
                    error.body
                ));
                continue;
            }
        };

        if uri != expected_uri {
            failures.push(format!(
                "{identifier}/{label}: uri\n  rust = {uri}\n  js   = {expected_uri}"
            ));
        }
        let actual_data = text(&Value::Object(data.clone()));
        let expected_data = text(&case["data"]);
        if actual_data != expected_data {
            failures.push(format!(
                "{identifier}/{label}: data\n  rust = {actual_data}\n  js   = {expected_data}"
            ));
        }

        let expected_crypto = case["options"]["crypto"].as_str().unwrap_or("");
        let expected_crypto = if expected_crypto.is_empty() {
            "eapi"
        } else {
            expected_crypto
        };
        if options.crypto != expected_crypto {
            failures.push(format!(
                "{identifier}/{label}: crypto\n  rust = {}\n  js   = {expected_crypto}",
                options.crypto
            ));
        }

        checked += 1;
    }

    assert!(checked > 150, "用例太少: {checked}");
    assert!(
        failures.is_empty(),
        "共 {} 处不一致:\n{}",
        failures.len(),
        failures.join("\n")
    );
}
