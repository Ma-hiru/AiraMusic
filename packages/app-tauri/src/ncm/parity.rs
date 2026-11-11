//! 与 JS 版逐字段对拍。
//!
//! `tests/fixtures/ncm-request-cases.json` 由 `temp/ncm-oracle-request.mjs` 生成：
//! 它把真实的 `util/request.js` 指向一个本地 mock server，记录下
//! method / url / headers / body，以及**进入加密前**的 `data`。
//!
//! 本模块用同样的输入跑 `prepare`，逐项比对。随机量（`_ntes_nuid`、
//! `WNMCID`、`requestId`、`00O` 开头的 NMTID）按 key 归一化后比较，
//! 其余必须完全一致（包括 Cookie 的键顺序、JSON 的键顺序）。

#![cfg(test)]

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use serde_json::{json, Map, Value};

use crate::ncm::crypto::{self, AesMode};
use crate::ncm::option::Options;
use crate::ncm::request::{create_request, prepare, Ctx};

const FIXTURE: &str = include_str!("../../tests/fixtures/ncm-request-cases.json");

fn fixture() -> Value {
    serde_json::from_str(FIXTURE).expect("fixture 解析")
}

fn device_id(fixture: &Value) -> String {
    fixture["deviceId"].as_str().unwrap_or_default().to_string()
}

fn guest_token(fixture: &Value) -> String {
    fixture["guestToken"]
        .as_str()
        .unwrap_or_default()
        .to_string()
}

fn build_ctx(fixture: &Value) -> Ctx {
    Ctx::new(
        test_client(),
        device_id(fixture),
        guest_token(fixture),
        "1.2.4.8".to_string(),
    )
}

/// 测试环境里有 `HTTP_PROXY`，必须显式关掉，否则 localhost 也会被代理
fn test_client() -> reqwest::Client {
    reqwest::Client::builder()
        .no_proxy()
        .build()
        .expect("client")
}

fn options_for(input: &Value, domain: &str) -> Options {
    let mut headers = indexmap::IndexMap::new();
    if let Some(map) = input["headers"].as_object() {
        for (key, value) in map {
            headers.insert(key.clone(), value.as_str().unwrap_or_default().to_string());
        }
    }
    Options {
        crypto: input["crypto"].as_str().unwrap_or_default().to_string(),
        cookie: Some(input["cookie"].clone()),
        ua: input["ua"].as_str().unwrap_or_default().to_string(),
        domain: domain.to_string(),
        e_r: if input["e_r"].is_null() {
            None
        } else {
            Some(input["e_r"].clone())
        },
        headers,
        // server.js 注入的 req.ip
        ip: "127.0.0.1".to_string(),
        ..Default::default()
    }
}

/// 随机量按 key 归一化；键顺序保持不变，因此顺序差异也会被发现
fn normalize_cookie(cookie: &str) -> String {
    cookie
        .split("; ")
        .filter(|part| !part.is_empty())
        .map(|part| {
            let (key, value) = part.split_once('=').unwrap_or((part, ""));
            match key {
                "_ntes_nuid" | "_ntes_nnid" | "WNMCID" | "buildver" | "requestId" => {
                    format!("{key}=<random>")
                }
                "NMTID" if value.starts_with("00O") => format!("{key}=<random>"),
                _ => format!("{key}={value}"),
            }
        })
        .collect::<Vec<_>>()
        .join("; ")
}

/// 归一化随机字段（保持键顺序；其余字段必须逐字节一致）
fn normalize_value(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut out = Map::new();
            for (key, item) in map {
                let mask = matches!(key.as_str(), "requestId" | "buildver")
                    || (key == "NMTID"
                        && item
                            .as_str()
                            .map(|text| text.starts_with("00O"))
                            .unwrap_or(false));
                out.insert(
                    key.clone(),
                    if mask {
                        Value::String("<random>".to_string())
                    } else {
                        normalize_value(item)
                    },
                );
            }
            Value::Object(out)
        }
        Value::Array(items) => Value::Array(items.iter().map(normalize_value).collect()),
        other => other.clone(),
    }
}

fn norm(value: &Value) -> String {
    serde_json::to_string(&normalize_value(value)).unwrap()
}

fn norm_text(text: &str) -> String {
    let Ok(value) = serde_json::from_str::<Value>(text) else {
        return text.to_string();
    };
    norm(&value)
}

fn header<'a>(request: &'a Value, name: &str) -> Option<&'a str> {
    request["headers"][name].as_str()
}

#[test]
fn prepare_matches_js_request_construction() {
    let fixture = fixture();
    let ctx = build_ctx(&fixture);
    let cases = fixture["cases"].as_array().expect("cases");
    let mut checked = 0;

    for case in cases {
        let name = case["name"].as_str().unwrap_or("?");
        let input = &case["input"];
        let expected = &case["request"];
        if expected.is_null() {
            continue;
        }
        let domain = fixture["domain"].as_str().expect("domain").to_string();
        let expected_url = format!("{domain}{}", expected["url"].as_str().expect("url"));
        let uri = input["uri"].as_str().expect("uri");
        let data: Map<String, Value> = input["data"].as_object().cloned().unwrap_or_default();
        let options = options_for(input, &domain);

        let prepared = prepare(&ctx, uri, data, &options, "").unwrap_or_else(|error| {
            panic!("{name}: prepare 失败 {error:?}");
        });

        // 1. URL（含 /weapi/ 前缀与 uri.substr(5) 的裁剪规则）
        assert_eq!(prepared.url, expected_url, "{name}: URL 不一致");
        assert_eq!(expected["method"].as_str(), Some("POST"), "{name}: 方法");

        // 2. 关键 header 逐个比对
        assert_eq!(
            normalize_cookie(
                prepared
                    .headers
                    .get("Cookie")
                    .map(String::as_str)
                    .unwrap_or("")
            ),
            normalize_cookie(header(expected, "cookie").unwrap_or("")),
            "{name}: Cookie 不一致"
        );
        for name_in_header in [
            "user-agent",
            "referer",
            "x-real-ip",
            "x-forwarded-for",
            "content-type",
        ] {
            let actual = prepared.headers.iter().find_map(|(key, value)| {
                if key.eq_ignore_ascii_case(name_in_header) {
                    Some(value.clone())
                } else {
                    None
                }
            });
            let wanted = header(expected, name_in_header).map(str::to_string);
            assert_eq!(actual, wanted, "{name}: header {name_in_header} 不一致");
        }

        // 3. 进入加密前的 data（含 e_r / csrf_token / header）
        let mut expected_plaintext = case["plaintext"].clone();
        if prepared.crypto == "linuxapi" {
            // linuxapi 的入参是 {method,url,params}
            expected_plaintext = case["plaintext"]["params"].clone();
        }
        assert_eq!(
            norm(&prepared.plaintext),
            norm(&expected_plaintext),
            "{name}: 加密前 data 不一致"
        );

        // 4. 请求体：eapi / linuxapi 解密回明文再比一次，weapi 只校验结构
        match prepared.crypto.as_str() {
            "eapi" => {
                let params = form_value(&prepared.body, "params");
                assert_eq!(
                    params,
                    params.to_uppercase(),
                    "{name}: eapi params 应为大写 hex"
                );
                let (decrypted_uri, plain) =
                    crypto::eapi_req_decrypt(&params).expect("解密 eapi 请求体");
                assert_eq!(decrypted_uri, uri, "{name}: 密文里的 uri 不一致");
                assert_eq!(
                    norm(&plain),
                    norm(&expected_plaintext),
                    "{name}: eapi 密文内容不一致"
                );
                assert!(form_value(&prepared.body, "encSecKey").is_empty());
            }
            "linuxapi" => {
                let params = form_value(&prepared.body, "eparams");
                let plain =
                    crypto::aes_decrypt_hex(&params, AesMode::Ecb, b"rFgB&h#%2?^eDg:Q", b"")
                        .expect("解密");
                assert_eq!(
                    norm_text(&String::from_utf8(plain).unwrap()),
                    norm(&case["plaintext"]),
                    "{name}: linuxapi 转发体不一致"
                );
            }
            "weapi" => {
                let params = form_value(&prepared.body, "params");
                let key = form_value(&prepared.body, "encSecKey");
                assert!(!params.is_empty(), "{name}: weapi params 缺失");
                assert_eq!(key.len(), 256, "{name}: encSecKey 长度");
                assert!(
                    prepared.body.starts_with("params=") && prepared.body.contains("&encSecKey="),
                    "{name}: weapi 表单顺序应为 params 在前"
                );
            }
            other => panic!("{name}: 未预期的 crypto {other}"),
        }

        // 5. 复刻 NMTID 的进程级采集：首次 eapi 请求之后，后续请求会带上它
        if let Some(captured) = case["answer"]["cookie"]
            .as_array()
            .and_then(|cookies| cookies.iter().find_map(|item| item.as_str()))
        {
            if let Some(value) = captured
                .split(';')
                .find_map(|part| part.trim().strip_prefix("NMTID=").map(str::to_string))
            {
                if prepared.crypto == "eapi" && !prepared.cookie_had_nmtid {
                    ctx.set_nmtid(value);
                }
            }
        }

        checked += 1;
    }

    assert!(checked >= 10, "应覆盖全部用例，实际 {checked}");
}

fn form_value(body: &str, name: &str) -> String {
    url::form_urlencoded::parse(body.as_bytes())
        .find(|(key, _)| key == name)
        .map(|(_, value)| value.into_owned())
        .unwrap_or_default()
}

// ---------------------------------------------------------------------------
// 网络路径：用本地 mock upstream 验证状态码映射 / set-cookie / NMTID 采集
// ---------------------------------------------------------------------------

struct Mock {
    base: String,
    received: Arc<Mutex<Vec<(String, String)>>>,
}

#[derive(Clone)]
enum Canned {
    Json {
        status: u16,
        body: String,
        cookies: Vec<String>,
    },
}

type MockState = (
    Arc<Mutex<VecDeque<Canned>>>,
    Arc<Mutex<Vec<(String, String)>>>,
);

async fn mock_server(responses: Vec<Canned>) -> Mock {
    use axum::extract::State;
    use axum::response::IntoResponse;

    let queue = Arc::new(Mutex::new(VecDeque::from(responses)));
    let received: Arc<Mutex<Vec<(String, String)>>> = Arc::new(Mutex::new(Vec::new()));
    let state = (queue, received.clone());

    let app = axum::Router::new()
        .fallback(
            |State((queue, received)): State<MockState>,
             request: axum::extract::Request| async move {
                let (parts, body) = request.into_parts();
                let bytes = axum::body::to_bytes(body, 1024 * 1024).await.unwrap_or_default();
                received.lock().unwrap().push((
                    parts.uri.path().to_string(),
                    String::from_utf8_lossy(&bytes).into_owned(),
                ));
                let canned = queue
                    .lock()
                    .unwrap()
                    .pop_front()
                    .unwrap_or(Canned::Json {
                        status: 200,
                        body: "{\"code\":200}".to_string(),
                        cookies: Vec::new(),
                    });
                match canned {
                    Canned::Json {
                        status,
                        body,
                        cookies,
                    } => {
                        let mut response = (
                            axum::http::StatusCode::from_u16(status).unwrap(),
                            body,
                        )
                            .into_response();
                        for cookie in cookies {
                            response.headers_mut().append(
                                axum::http::header::SET_COOKIE,
                                cookie.parse().unwrap(),
                            );
                        }
                        response
                    }
                }
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
    Mock {
        base: format!("http://{address}"),
        received,
    }
}

fn options_for_mock(domain: &str, crypto_kind: &str) -> Options {
    Options {
        crypto: crypto_kind.to_string(),
        cookie: Some(json!({})),
        domain: domain.to_string(),
        ip: "127.0.0.1".to_string(),
        ..Default::default()
    }
}

fn ctx_for_mock() -> Ctx {
    Ctx::new(
        test_client(),
        "A1B2C3D4E5F60718293A4B5C6D7E8F90123456789ABCDEF0123456789ABCDEF0".to_string(),
        "guest".to_string(),
        "1.2.4.8".to_string(),
    )
}

#[tokio::test]
async fn special_status_codes_are_flattened_to_200() {
    let mock = mock_server(vec![
        Canned::Json {
            status: 200,
            body: "{\"code\":400,\"msg\":\"bad\"}".into(),
            cookies: vec![],
        },
        Canned::Json {
            status: 200,
            body: "{\"code\":800}".into(),
            cookies: vec![],
        },
    ])
    .await;
    let ctx = ctx_for_mock();
    for _ in 0..2 {
        let answer = create_request(
            &ctx,
            "/api/test",
            Map::new(),
            options_for_mock(&mock.base, "eapi"),
        )
        .await
        .expect("特殊状态码应被视为成功");
        assert_eq!(answer.status, 200);
    }
}

#[tokio::test]
async fn non_special_error_codes_surface_as_http_status() {
    let mock = mock_server(vec![
        Canned::Json {
            status: 200,
            body: "{\"code\":301}".into(),
            cookies: vec![],
        },
        Canned::Json {
            status: 200,
            body: "{\"code\":999}".into(),
            cookies: vec![],
        },
    ])
    .await;
    let ctx = ctx_for_mock();

    let login_required = create_request(
        &ctx,
        "/api/test",
        Map::new(),
        options_for_mock(&mock.base, "eapi"),
    )
    .await
    .expect_err("301 应失败");
    assert_eq!(login_required.status, 301);

    let out_of_range = create_request(
        &ctx,
        "/api/test",
        Map::new(),
        options_for_mock(&mock.base, "eapi"),
    )
    .await
    .expect_err("999 越界");
    assert_eq!(out_of_range.status, 400);
}

#[tokio::test]
async fn nmtid_is_captured_from_set_cookie_once() {
    let mock = mock_server(vec![
        Canned::Json {
            status: 200,
            body: "{\"code\":200}".into(),
            cookies: vec!["NMTID=captured-nmtid; Domain=.music.163.com; Path=/".into()],
        },
        Canned::Json {
            status: 200,
            body: "{\"code\":200}".into(),
            cookies: vec![],
        },
    ])
    .await;
    let ctx = ctx_for_mock();

    create_request(
        &ctx,
        "/api/test",
        Map::new(),
        options_for_mock(&mock.base, "eapi"),
    )
    .await
    .expect("first");

    create_request(
        &ctx,
        "/api/test",
        Map::new(),
        options_for_mock(&mock.base, "eapi"),
    )
    .await
    .expect("second");

    let received = mock.received.lock().unwrap().clone();
    let first_plain = crate::ncm::request::peek_eapi_body(&received[0].1).expect("first body");
    assert!(
        first_plain["header"].get("NMTID").is_none(),
        "首次 eapi 请求不应带 NMTID：{first_plain}"
    );
    let second_plain = crate::ncm::request::peek_eapi_body(&received[1].1).expect("second body");
    assert_eq!(
        second_plain["header"]["NMTID"], "captured-nmtid",
        "后续请求应复用采集到的 NMTID"
    );
}

#[tokio::test]
async fn e_r_decrypts_hex_response() {
    let payload = json!({"code": 200, "data": {"secret": true}});
    let text = serde_json::to_string(&payload).unwrap();
    let encrypted = hex::encode_upper(crypto::ecb_encrypt(text.as_bytes(), b"e82ckenh8dichen8"));
    let mock = mock_server(vec![Canned::Json {
        status: 200,
        body: encrypted,
        cookies: vec![],
    }])
    .await;
    let ctx = ctx_for_mock();
    let mut options = options_for_mock(&mock.base, "eapi");
    options.e_r = Some(json!("true"));
    let answer = create_request(&ctx, "/api/test", Map::new(), options)
        .await
        .expect("decrypt");
    assert_eq!(answer.body, payload);
}

#[tokio::test]
async fn duplicated_json_document_is_tolerated() {
    let mock = mock_server(vec![Canned::Json {
        status: 200,
        body: "{\"code\":200,\"a\":1}{\"code\":500}".into(),
        cookies: vec![],
    }])
    .await;
    let ctx = ctx_for_mock();
    let answer = create_request(
        &ctx,
        "/api/test",
        Map::new(),
        options_for_mock(&mock.base, "eapi"),
    )
    .await
    .expect("应取第一段");
    assert_eq!(answer.body, json!({"code": 200, "a": 1}));
}

#[tokio::test]
async fn transport_failure_becomes_502() {
    let ctx = ctx_for_mock();
    let answer = create_request(
        &ctx,
        "/api/test",
        Map::new(),
        options_for_mock("http://127.0.0.1:1", "eapi"),
    )
    .await
    .expect_err("连接失败");
    crate::host_log!("DEBUG body = {answer:?}");
    assert_eq!(answer.status, 502);
    assert_eq!(answer.body["code"], 502);
}
