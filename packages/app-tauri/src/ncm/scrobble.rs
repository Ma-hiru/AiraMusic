//! `module/scrobble_v1.js` 的 Rust 版：听歌打卡（PLV + PLD 两次 NCBL 上报）。
//!
//! 与 `request` 管线无关，直接向 `clientlog3.music.163.com` 上传加密日志。

use serde_json::{json, Map, Value};

use crate::ncm::config::now_ms;
use crate::ncm::ncbl::{self, ReportContext, Song, Source};
use crate::ncm::request::{Answer, Ctx};
use crate::ncm::util::{js_string, Cookies};

fn number(value: Option<&Value>) -> Option<f64> {
    match value? {
        Value::Number(number) => number.as_f64(),
        Value::String(text) if !text.trim().is_empty() => text.trim().parse::<f64>().ok(),
        _ => None,
    }
}

fn cookie_map(value: Option<&Value>) -> Cookies {
    match value {
        Some(Value::Object(map)) => map
            .iter()
            .map(|(key, value)| (key.clone(), js_string(value)))
            .collect(),
        Some(Value::String(text)) => ncbl::parse_cookie(text),
        _ => Cookies::new(),
    }
}

pub async fn handle(
    ctx: &Ctx,
    header_cookies: &Cookies,
    query: &Map<String, Value>,
) -> Result<Value, Answer> {
    let Some(song_id) = number(query.get("id")).filter(|value| *value > 0.0) else {
        return Err(Answer {
            status: 400,
            body: json!({ "code": 400, "msg": "缺少有效的 id (歌曲ID)" }),
            cookie: Vec::new(),
        });
    };
    let song_id = song_id as u64;

    let Some(play_time) = number(query.get("time")).filter(|value| *value > 0.0) else {
        return Err(Answer {
            status: 400,
            body: json!({ "code": 400, "msg": "缺少有效的 time (播放时长)" }),
            cookie: Vec::new(),
        });
    };
    let play_time = play_time as u64;
    let total_time = number(query.get("total"))
        .map(|value| value as u64)
        .unwrap_or(play_time);

    let source_id = query
        .get("sourceid")
        .or_else(|| query.get("sourceId"))
        .map(js_string)
        .unwrap_or_default();
    let source_name = query
        .get("source")
        .map(js_string)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "list".to_string());

    // cookie 优先用 query 里的（渲染层会带上完整 cookie 串）
    let mut cookies = cookie_map(query.get("cookie"));
    if cookies.is_empty() {
        cookies = header_cookies.clone();
    }
    // JS：`cookieObj.os = 'pc'`
    cookies.insert("os".into(), "pc".into());

    let mut context: ReportContext = ncbl::extract_context(&cookies);
    if context.auth.token.is_empty() {
        context.auth.token = cookies.get("MUSIC_U").cloned().unwrap_or_default();
    }
    if context.auth.token.is_empty() {
        return Err(Answer {
            status: 401,
            body: json!({ "code": 401, "msg": "缺少 MUSIC_U 鉴权令牌" }),
            cookie: Vec::new(),
        });
    }

    let song = Song {
        id: song_id,
        name: query.get("name").map(js_string).unwrap_or_default(),
        artist: query.get("artist").map(js_string).unwrap_or_default(),
        bitrate: number(query.get("bitrate"))
            .map(|value| value as u64)
            .unwrap_or(320),
        level: query
            .get("level")
            .map(js_string)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "exhigh".to_string()),
        vip: matches!(query.get("vip"), Some(Value::Bool(true)))
            || query.get("vip").map(js_string).as_deref() == Some("true"),
        time: total_time,
    };
    let source = Source {
        id: if source_id.is_empty() {
            song_id.to_string()
        } else {
            source_id
        },
        kind: "track".to_string(),
        name: source_name,
    };

    let meta_json = ncbl::build_meta_json(&context);
    let cookie_str = ncbl::build_cookie_str(&context);
    let ts = (now_ms() / 1000) as u64;
    let played = play_time.min(total_time);

    let plv_body = ncbl::build_records(&[(ts, "_plv", ncbl::build_plv(&context, &song, &source))]);
    let pld_body = ncbl::build_records(&[(
        ts,
        "_pld",
        ncbl::build_pld(&context, &song, &source, played),
    )]);

    let log_base = ctx
        .log_base
        .clone()
        .unwrap_or_else(|| "https://clientlog3.music.163.com".to_string());
    let plv = match ncbl::do_upload(
        &ctx.http,
        &log_base,
        &context,
        &meta_json,
        &plv_body,
        &cookie_str,
        "PLV",
    )
    .await
    {
        Ok(outcome) => outcome,
        Err(error) => {
            return Err(Answer {
                status: 502,
                body: json!({ "code": 502, "msg": format!("请求异常: {error}") }),
                cookie: Vec::new(),
            })
        }
    };
    if !plv.success {
        let rate = plv
            .response
            .get("data")
            .and_then(|data| data.get("rate"))
            .map(|value| format!(" (rate={value})"))
            .unwrap_or_default();
        return Ok(json!({
            "code": plv.response.get("code").cloned().unwrap_or(json!(-1)),
            "msg": format!("PLV 上报失败{rate}"),
            "details": plv.response,
        }));
    }

    let pld = match ncbl::do_upload(
        &ctx.http,
        &log_base,
        &context,
        &meta_json,
        &pld_body,
        &cookie_str,
        "PLD",
    )
    .await
    {
        Ok(outcome) => outcome,
        Err(error) => {
            return Err(Answer {
                status: 502,
                body: json!({ "code": 502, "msg": format!("请求异常: {error}") }),
                cookie: Vec::new(),
            })
        }
    };
    if !pld.success {
        return Ok(json!({
            "code": pld.response.get("code").cloned().unwrap_or(json!(-1)),
            "msg": "PLV 成功但 PLD 失败",
            "details": { "plv": plv.response, "pld": pld.response },
        }));
    }

    Ok(json!({
        "code": 200,
        "data": "scrobble_v1 上报成功",
        "details": {
            "plv": { "fileName": plv.file_name, "payloadSize": plv.payload_len },
            "pld": { "fileName": pld.file_name, "payloadSize": pld.payload_len },
        },
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx() -> Ctx {
        Ctx::new(
            reqwest::Client::builder().no_proxy().build().unwrap(),
            "DEVICE".into(),
            String::new(),
            String::new(),
        )
    }

    #[tokio::test]
    async fn rejects_missing_song_id() {
        let error = handle(&ctx(), &Cookies::new(), &Map::new())
            .await
            .unwrap_err();
        assert_eq!(error.status, 400);
        assert_eq!(error.body["code"], json!(400));
    }

    #[tokio::test]
    async fn rejects_missing_play_time() {
        let mut query = Map::new();
        query.insert("id".into(), json!("1"));
        let error = handle(&ctx(), &Cookies::new(), &query).await.unwrap_err();
        assert_eq!(error.status, 400);
        assert!(error.body["msg"].as_str().unwrap().contains("time"));
    }

    /// 假 clientlog：按 multipart 里的 filename 回 successfiles
    async fn log_server() -> String {
        use axum::response::IntoResponse;
        use axum::Json;

        let app = axum::Router::new().fallback(|request: axum::extract::Request| async move {
            let body = axum::body::to_bytes(request.into_body(), 4 * 1024 * 1024)
                .await
                .unwrap_or_default();
            let text = String::from_utf8_lossy(&body).into_owned();
            let file_name = text
                .split("filename=\"")
                .nth(1)
                .and_then(|rest| rest.split('"').next())
                .unwrap_or_default()
                .to_string();
            Json(json!({
                "code": 200,
                "data": { "successfiles": [file_name] }
            }))
            .into_response()
        });
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.ok();
        });
        format!("http://{address}")
    }

    #[tokio::test]
    async fn uploads_plv_and_pld_with_ncbl_payload() {
        let base = log_server().await;
        let ctx = Ctx::new(
            reqwest::Client::builder().no_proxy().build().unwrap(),
            "DEVICE".into(),
            String::new(),
            String::new(),
        )
        .with_endpoints(&base);

        let mut cookies = Cookies::new();
        cookies.insert("MUSIC_U".into(), "u".into());
        cookies.insert("__csrf".into(), "c".into());

        let mut query = Map::new();
        query.insert("id".into(), json!("1974443814"));
        query.insert("time".into(), json!("42"));
        query.insert("total".into(), json!("240"));
        query.insert("name".into(), json!("我记得"));
        query.insert("source".into(), json!("playlist"));
        query.insert("sourceid".into(), json!("3778678"));

        let body = handle(&ctx, &cookies, &query).await.expect("上报成功");
        assert_eq!(body["code"], json!(200));
        assert_eq!(body["data"], json!("scrobble_v1 上报成功"));
        assert!(body["details"]["plv"]["payloadSize"].as_u64().unwrap() > 0);
        assert!(body["details"]["pld"]["payloadSize"].as_u64().unwrap() > 0);
    }

    #[tokio::test]
    async fn plv_failure_is_reported_without_throwing() {
        // 返回 code 200 但没有 successfiles → JS 视为失败
        let base = log_server_without_success().await;
        let ctx = Ctx::new(
            reqwest::Client::builder().no_proxy().build().unwrap(),
            "DEVICE".into(),
            String::new(),
            String::new(),
        )
        .with_endpoints(&base);

        let mut cookies = Cookies::new();
        cookies.insert("MUSIC_U".into(), "u".into());
        let mut query = Map::new();
        query.insert("id".into(), json!("1"));
        query.insert("time".into(), json!("10"));

        let body = handle(&ctx, &cookies, &query).await.expect("返回错误体");
        assert!(body["msg"].as_str().unwrap().contains("PLV 上报失败"));
        assert!(body["details"].is_object());
    }

    async fn log_server_without_success() -> String {
        use axum::response::IntoResponse;
        use axum::Json;
        let app = axum::Router::new()
            .fallback(|| async { Json(json!({"code": 200, "data": {}})).into_response() });
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.ok();
        });
        format!("http://{address}")
    }

    #[tokio::test]
    async fn rejects_without_token() {
        let mut query = Map::new();
        query.insert("id".into(), json!("1"));
        query.insert("time".into(), json!("30"));
        let error = handle(&ctx(), &Cookies::new(), &query).await.unwrap_err();
        assert_eq!(error.status, 401);
        assert_eq!(error.body["code"], json!(401));
    }
}
