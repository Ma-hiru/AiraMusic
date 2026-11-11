//! 1:1 复刻上游 `server.js` 的 `constructServer` 请求入口。
//!
//! 顺序与源码一致：静态/CORS 之后是
//! 1. cookie 解析（`req.cookies`）
//! 2. body 解析（json / urlencoded）
//! 3. `Object.assign({}, { cookie: req.cookies }, req.query, req.body)`
//! 4. 路由分发 → 模块构造 `(uri, data, options)` → `createRequest`
//! 5. 成功：回写 `Set-Cookie`，按 `answer.status` 返回 body
//! 6. 失败：`body` 为空 → 404；`code == '301'` → `msg = '需要登录'`；回写 cookie
//!
//! 与 Electron 版的差异只在"没有的东西"（express 静态目录、文件上传、CORS 中间件），
//! 因为宿主是 Tauri 自己的 HTTP 服务和本地渲染进程。

use std::collections::HashMap;
use std::sync::{Arc, OnceLock};

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Router;
use serde_json::{json, Map, Value};

use crate::ncm::request::{create_request, Ctx};
use crate::ncm::routes::{self, Route};
use crate::ncm::util::{cookie_to_json, safe_decode, Cookies};

pub struct AppState {
    pub ctx: Arc<Ctx>,
}

pub fn router(ctx: Arc<Ctx>) -> Router {
    Router::new()
        .fallback(handle)
        .with_state(Arc::new(AppState { ctx }))
}

fn route_table() -> &'static HashMap<&'static str, &'static Route> {
    static TABLE: OnceLock<HashMap<&'static str, &'static Route>> = OnceLock::new();
    TABLE.get_or_init(|| {
        routes::all()
            .iter()
            .map(|route| (route.route, *route))
            .collect()
    })
}

async fn handle(State(state): State<Arc<AppState>>, req: Request) -> Response {
    let (parts, body) = req.into_parts();
    let path = parts.uri.path().to_string();

    // 1. cookie 解析
    let cookies = parse_cookie_header(&parts.headers);

    // 2. query / body 解析
    let mut query = parse_query(parts.uri.query().unwrap_or_default());
    let parsed = read_body(body, &parts.headers).await;
    for (key, value) in parsed.params {
        query.insert(key, value);
    }
    let upload = parsed.file;

    // 3. `Object.assign({}, { cookie: req.cookies }, req.query, req.body)`
    let mut merged = Map::new();
    merged.insert("cookie".into(), Value::Object(cookies_to_json(&cookies)));
    for (key, value) in query {
        merged.insert(key, value);
    }
    // query 里的 `cookie` 是字符串，按 cookieToJson(decode(...)) 转成对象
    if let Some(Value::String(text)) = merged.get("cookie").cloned() {
        merged.insert(
            "cookie".into(),
            Value::Object(cookies_to_json(&cookie_to_json(&safe_decode(&text)))),
        );
    }

    // 4. 路由分发
    if let Some(body) = routes::local(&path, &merged) {
        return reply(StatusCode::OK, body);
    }

    // 歌单封面上传：multipart + NOS 分片上传，走独立链路（不经过单次 request）
    if path == "/playlist/cover/update" {
        let Some(file) = upload.as_ref() else {
            return reply(
                StatusCode::BAD_REQUEST,
                json!({ "code": 400, "msg": "imgFile is required" }),
            );
        };
        return match crate::ncm::upload::playlist_cover(&state.ctx, &cookies, &merged, file).await {
            Ok(body) => reply(StatusCode::OK, body),
            Err(answer) => reply(
                StatusCode::from_u16(answer.status).unwrap_or(StatusCode::OK),
                answer.body,
            ),
        };
    }

    // 听歌打卡：NCBL 加密后直接传 clientlog，与 request 管线无关
    if path == "/scrobble/v1" {
        return match crate::ncm::scrobble::handle(&state.ctx, &cookies, &merged).await {
            Ok(body) => reply(StatusCode::OK, body),
            Err(answer) => reply(
                StatusCode::from_u16(answer.status).unwrap_or(StatusCode::OK),
                answer.body,
            ),
        };
    }

    let Some(route) = route_table().get(path.as_str()).copied() else {
        return reply(
            StatusCode::NOT_FOUND,
            json!({ "code": 404, "msg": "unknown route", "path": path }),
        );
    };

    let (uri, data, mut options) = match routes::build(route, &merged) {
        Ok(call) => call,
        Err(answer) => {
            return reply(
                StatusCode::from_u16(answer.status).unwrap_or(StatusCode::BAD_REQUEST),
                answer.body,
            )
        }
    };

    // `server.js` 注入 `req.ip`：本地连接即 127.0.0.1；
    // `randomCNIP` 时换成进程级随机中国 IP（`global.cnIp`）。
    options.ip = if options.random_cn_ip {
        state.ctx.cn_ip.clone()
    } else {
        "127.0.0.1".to_string()
    };

    let no_cookie = merged
        .get("noCookie")
        .map(crate::ncm::util::to_boolean)
        .unwrap_or(false);

    // 保留一份原始入参：playlist_tracks 的 512 重试需要它
    match create_request(&state.ctx, &uri, data.clone(), options.clone()).await {
        Ok(mut answer) => {
            // 少数模块会把响应再加工一次（login 回填 cookie 串、song_url 按入参排序）
            routes::postprocess(route.identifier, &merged, &mut answer);
            let mut response = reply(
                StatusCode::from_u16(answer.status).unwrap_or(StatusCode::OK),
                answer.body,
            );
            if !no_cookie {
                append_cookies(&mut response, &answer.cookie);
            }
            response
        }
        Err(answer) => {
            // module/playlist_tracks.js：512 表示曲目重复，复制一份再提交一次
            if route.identifier == "playlist_tracks"
                && answer.body.get("code").and_then(Value::as_u64) == Some(512)
                && merged.get("tracks").is_some()
            {
                let tracks: Vec<String> = merged
                    .get("tracks")
                    .map(crate::ncm::util::js_string)
                    .unwrap_or_default()
                    .split(',')
                    .map(str::to_string)
                    .collect();
                let mut doubled = tracks.clone();
                doubled.extend(tracks);
                let mut retry = data.clone();
                retry.insert(
                    "trackIds".into(),
                    json!(serde_json::to_string(&doubled).unwrap_or_default()),
                );
                if let Ok(retried) = create_request(&state.ctx, &uri, retry, options).await {
                    let mut answer = retried;
                    routes::postprocess(route.identifier, &merged, &mut answer);
                    let mut response = reply(
                        StatusCode::from_u16(answer.status).unwrap_or(StatusCode::OK),
                        answer.body,
                    );
                    if !no_cookie {
                        append_cookies(&mut response, &answer.cookie);
                    }
                    return response;
                }
            }

            let mut body = answer.body;
            if body.is_null() {
                return reply(
                    StatusCode::NOT_FOUND,
                    json!({ "code": 404, "data": null, "msg": "Not Found" }),
                );
            }
            // `moduleResponse.body.code == '301'` → 需要登录
            if body.get("code").map(is_301).unwrap_or(false) {
                if let Some(object) = body.as_object_mut() {
                    object.insert("msg".into(), json!("需要登录"));
                }
            }
            let mut response = reply(
                StatusCode::from_u16(answer.status).unwrap_or(StatusCode::OK),
                body,
            );
            if !no_cookie {
                append_cookies(&mut response, &answer.cookie);
            }
            response
        }
    }
}

fn is_301(value: &Value) -> bool {
    match value {
        Value::Number(number) => number.as_u64() == Some(301),
        Value::String(text) => text == "301",
        _ => false,
    }
}

fn append_cookies(response: &mut Response, cookies: &[String]) {
    for cookie in cookies {
        if let Ok(value) = header::HeaderValue::from_str(cookie) {
            response.headers_mut().append(header::SET_COOKIE, value);
        }
    }
}

fn reply(status: StatusCode, body: Value) -> Response {
    let mut response = (status, axum::Json(body)).into_response();
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("no-store"),
    );
    response
}

/// `server.js` 的 cookie 中间件：
/// ```js
/// ;(req.headers.cookie || '').split(/;\s+|(?<!\s)\s+$/g).forEach((pair) => {
///   const crack = pair.indexOf('=')
///   if (crack < 1 || crack == pair.length - 1) return
///   req.cookies[decode(pair.slice(0, crack)).trim()] = decode(pair.slice(crack + 1)).trim()
/// })
/// ```
pub fn parse_cookie_header(headers: &HeaderMap) -> Cookies {
    let mut cookies = Cookies::new();
    let Some(raw) = headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok())
    else {
        return cookies;
    };
    for pair in split_cookie_header(raw) {
        let Some(index) = pair.find('=') else {
            continue;
        };
        if index < 1 || index == pair.len() - 1 {
            continue;
        }
        let key = safe_decode(&pair[..index]).trim().to_string();
        let value = safe_decode(&pair[index + 1..]).trim().to_string();
        cookies.insert(key, value);
    }
    cookies
}

/// `/;\s+|(?<!\s)\s+$/g`：分号 + 空白，或结尾处的空白
fn split_cookie_header(raw: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let chars: Vec<char> = raw.chars().collect();
    let mut index = 0;
    while index < chars.len() {
        let ch = chars[index];
        if ch == ';' {
            parts.push(current.trim().to_string());
            current.clear();
            index += 1;
            while index < chars.len() && chars[index].is_whitespace() {
                index += 1;
            }
            continue;
        }
        current.push(ch);
        index += 1;
    }
    // 结尾空白整体丢弃（对应 `(?<!\s)\s+$`）
    parts.push(current.trim().to_string());
    parts.retain(|part| !part.is_empty());
    parts
}

pub fn cookies_to_json(cookies: &Cookies) -> Map<String, Value> {
    cookies
        .iter()
        .map(|(key, value)| (key.clone(), Value::String(value.clone())))
        .collect()
}

/// `req.query`（express 默认 qs）：同名参数聚合为数组
pub fn parse_query(raw: &str) -> Map<String, Value> {
    let mut query = Map::new();
    for (key, value) in url::form_urlencoded::parse(raw.as_bytes()) {
        let key = key.into_owned();
        let value = Value::String(value.into_owned());
        match query.get_mut(&key) {
            Some(Value::Array(items)) => items.push(value),
            Some(existing) => {
                let first = std::mem::replace(existing, Value::Null);
                *existing = Value::Array(vec![first, value]);
            }
            None => {
                query.insert(key, value);
            }
        }
    }
    query
}

/// 一次请求体解析的产物：表单字段 + 可选的上传文件
#[derive(Default)]
pub struct ParsedBody {
    pub params: Vec<(String, Value)>,
    pub file: Option<UploadFile>,
}

/// multipart 里第一个文件字段（歌单封面只用到 `imgFile`）
#[derive(Clone, Debug)]
pub struct UploadFile {
    #[allow(dead_code)] // multipart 字段名，保留以便将来支持多文件
    pub field: String,
    pub filename: String,
    pub content_type: String,
    pub data: Vec<u8>,
}

/// `express.json()` + `express.urlencoded({ extended: false })` + `express-fileupload`
pub async fn read_body(body: Body, headers: &HeaderMap) -> ParsedBody {
    // 封面上传允许更大的体积（与服务端 500MB 上限对齐，这里取 32MB 足够）
    let Ok(bytes) = axum::body::to_bytes(body, 32 * 1024 * 1024).await else {
        return ParsedBody::default();
    };
    if bytes.is_empty() {
        return ParsedBody::default();
    }
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();

    if content_type.starts_with("multipart/form-data") {
        return read_multipart(bytes, &content_type).await;
    }

    if content_type.contains("application/json") {
        let Ok(Value::Object(map)) = serde_json::from_slice::<Value>(&bytes) else {
            return ParsedBody::default();
        };
        return ParsedBody {
            params: map.into_iter().collect(),
            file: None,
        };
    }

    let mut params: Vec<(String, Value)> = Vec::new();
    let mut seen: HashMap<String, usize> = HashMap::new();
    for (key, value) in url::form_urlencoded::parse(&bytes) {
        let key = key.into_owned();
        let value = Value::String(value.into_owned());
        match seen.get(&key).copied() {
            Some(index) => match &mut params[index].1 {
                Value::Array(items) => items.push(value),
                existing => {
                    let first = std::mem::replace(existing, Value::Null);
                    params[index].1 = Value::Array(vec![first, value]);
                }
            },
            None => {
                seen.insert(key.clone(), params.len());
                params.push((key, value));
            }
        }
    }
    ParsedBody { params, file: None }
}

async fn read_multipart(bytes: axum::body::Bytes, content_type: &str) -> ParsedBody {
    let Ok(boundary) = multer::parse_boundary(content_type) else {
        return ParsedBody::default();
    };
    let stream = futures_util::stream::once(async move { Ok::<_, std::io::Error>(bytes) });
    let mut multipart = multer::Multipart::new(stream, boundary);
    let mut out = ParsedBody::default();

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or_default().to_string();
        let filename = field.file_name().map(str::to_string);
        let mime = field
            .content_type()
            .map(|value| value.to_string())
            .unwrap_or_default();
        match filename {
            Some(filename) if !filename.is_empty() => {
                let Ok(data) = field.bytes().await else {
                    continue;
                };
                out.file = Some(UploadFile {
                    field: name,
                    filename,
                    content_type: mime,
                    data: data.to_vec(),
                });
            }
            _ => {
                let Ok(text) = field.text().await else {
                    continue;
                };
                out.params.push((name, Value::String(text)));
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ncm::testkit::{ctx, serve, MockUpstream, Reply};
    use serde_json::json;

    fn domain_query(base: &str) -> String {
        url::form_urlencoded::byte_serialize(base.as_bytes()).collect()
    }

    #[tokio::test]
    async fn album_proxies_weapi_and_forwards_set_cookie() {
        let mock = MockUpstream::start(vec![Reply::json(json!({"code": 200, "album": {"id": 1}}))
            .with_cookie("NMTID=abc; Domain=.music.163.com; Path=/")])
        .await;
        let app = serve(ctx()).await;

        let response = crate::ncm::testkit::test_client()
            .get(format!(
                "{app}/album?id=1&domain={}",
                domain_query(&mock.base)
            ))
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 200);
        assert_eq!(
            response
                .headers()
                .get_all(header::SET_COOKIE)
                .iter()
                .count(),
            1
        );
        let request = mock.last();
        assert_eq!(request.method, "POST");
        assert_eq!(request.path, "/weapi/v1/album/1");
        // weapi 一定带 Referer（eapi 不带）
        assert_eq!(
            request.headers.get("referer").and_then(|v| v.to_str().ok()),
            Some(mock.base.as_str())
        );
    }

    #[tokio::test]
    async fn banner_goes_through_eapi_with_client_type() {
        let mock =
            MockUpstream::start(vec![Reply::json(json!({"code": 200, "banners": []}))]).await;
        let app = serve(ctx()).await;

        let response = crate::ncm::testkit::test_client()
            .get(format!(
                "{app}/banner?type=0&domain={}",
                domain_query(&mock.base)
            ))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);

        let request = mock.last();
        assert_eq!(request.path, "/eapi/v2/banner/get");
        assert!(
            request.headers.get("referer").is_none(),
            "eapi 不应带 Referer"
        );
        let plaintext = request.plaintext();
        assert_eq!(plaintext["clientType"], json!("pc"));
        assert_eq!(plaintext["e_r"], json!(false));
        // 首个 eapi 请求不带 NMTID
        assert!(plaintext["header"].get("NMTID").is_none());
    }

    #[tokio::test]
    async fn post_json_body_wins_over_query() {
        let mock = MockUpstream::start(vec![Reply::json(json!({"code": 200, "songs": []}))]).await;
        let app = serve(ctx()).await;

        let response = crate::ncm::testkit::test_client()
            .post(format!(
                "{app}/likelist?domain={}",
                domain_query(&mock.base)
            ))
            .json(&json!({"uid": "123"}))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);

        let request = mock.last();
        assert_eq!(request.path, "/eapi/song/like/get");
        assert_eq!(request.plaintext()["uid"], json!("123"));
    }

    #[tokio::test]
    async fn login_code_301_is_rewritten_to_需要登录() {
        let mock =
            MockUpstream::start(vec![Reply::json(json!({"code": 301, "msg": "nope"}))]).await;
        let app = serve(ctx()).await;

        let response = crate::ncm::testkit::test_client()
            .get(format!(
                "{app}/user/account?domain={}",
                domain_query(&mock.base)
            ))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 301);
        let body: Value = response.json().await.unwrap();
        assert_eq!(body["msg"], json!("需要登录"));
    }

    #[tokio::test]
    async fn no_cookie_skips_set_cookie() {
        let mock = MockUpstream::start(vec![
            Reply::json(json!({"code": 200})).with_cookie("MUSIC_A=x; Path=/")
        ])
        .await;
        let app = serve(ctx()).await;

        let response = crate::ncm::testkit::test_client()
            .get(format!(
                "{app}/album?id=1&noCookie=true&domain={}",
                domain_query(&mock.base)
            ))
            .send()
            .await
            .unwrap();
        assert_eq!(
            response
                .headers()
                .get_all(header::SET_COOKIE)
                .iter()
                .count(),
            0
        );
    }

    #[tokio::test]
    async fn login_response_carries_joined_cookie_string() {
        let mock = MockUpstream::start(vec![Reply::json(
            json!({"code": 200, "profile": {"userId": 1}}),
        )
        .with_cookie("MUSIC_U=abc; Path=/")
        .with_cookie("__csrf=xyz; Path=/")])
        .await;
        let app = serve(ctx()).await;

        let response = crate::ncm::testkit::test_client()
            .post(format!(
                "{app}/login/cellphone?domain={}",
                domain_query(&mock.base)
            ))
            .json(&json!({"phone": "13800000000", "password": "x"}))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        let body: Value = response.json().await.unwrap();
        assert_eq!(
            body["cookie"],
            json!("MUSIC_U=abc; Path=/;__csrf=xyz; Path=/")
        );
    }

    #[tokio::test]
    async fn playlist_tracks_retries_with_doubled_ids_on_512() {
        let mock = MockUpstream::start(vec![
            Reply::json(json!({"code": 512, "msg": "duplicate"})),
            Reply::json(json!({"code": 200})),
        ])
        .await;
        let app = serve(ctx()).await;

        let response = crate::ncm::testkit::test_client()
            .post(format!(
                "{app}/playlist/tracks?domain={}",
                domain_query(&mock.base)
            ))
            .json(&json!({"tracks": "1,2", "op": "add", "pid": "9"}))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);

        let requests = mock.requests();
        assert_eq!(requests.len(), 2, "512 之后应重试一次");
        assert_eq!(
            requests[1].plaintext()["trackIds"],
            json!("[\"1\",\"2\",\"1\",\"2\"]")
        );
    }

    #[tokio::test]
    async fn song_url_keeps_request_order() {
        let mock = MockUpstream::start(vec![Reply::json(json!({
            "code": 200,
            "data": [{"id": 1, "url": "a"}, {"id": 2, "url": "b"}]
        }))])
        .await;
        let app = serve(ctx()).await;

        let body: Value = crate::ncm::testkit::test_client()
            .get(format!(
                "{app}/song/url?id=2,1&domain={}",
                domain_query(&mock.base)
            ))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        assert_eq!(body["data"][0]["id"], json!(2));
        assert_eq!(body["data"][1]["id"], json!(1));
    }

    #[tokio::test]
    async fn unknown_route_returns_json_404() {
        let app = serve(ctx()).await;
        let response = crate::ncm::testkit::test_client()
            .get(format!("{app}/not-exist"))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 404);
        let body: Value = response.json().await.unwrap();
        assert_eq!(body["code"], json!(404));
    }

    #[tokio::test]
    async fn local_qr_create_does_not_hit_upstream() {
        let mock = MockUpstream::start(vec![]).await;
        let app = serve(ctx()).await;
        let response = crate::ncm::testkit::test_client()
            .get(format!(
                "{app}/login/qr/create?key=abc&domain={}",
                domain_query(&mock.base)
            ))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        let body: Value = response.json().await.unwrap();
        assert_eq!(
            body["data"]["qrurl"],
            json!("https://music.163.com/login?codekey=abc")
        );
        assert!(mock.requests().is_empty());
    }

    #[test]
    fn cookie_header_parsing_matches_express_middleware() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::COOKIE,
            header::HeaderValue::from_static("MUSIC_U=abc; __csrf=def; empty=; =bad; a=b=c"),
        );
        let cookies = parse_cookie_header(&headers);
        assert_eq!(cookies.get("MUSIC_U").map(String::as_str), Some("abc"));
        assert_eq!(cookies.get("__csrf").map(String::as_str), Some("def"));
        // `empty=` / `=bad` 被 indexOf 规则挡掉；`a=b=c` 保留后半段
        assert!(!cookies.contains_key("empty"));
        assert!(!cookies.contains_key(""));
        assert_eq!(cookies.get("a").map(String::as_str), Some("b=c"));
    }

    #[test]
    fn cookie_header_decodes_percent_escapes() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::COOKIE,
            header::HeaderValue::from_static("k=%E4%B8%AD"),
        );
        let cookies = parse_cookie_header(&headers);
        assert_eq!(cookies.get("k").map(String::as_str), Some("中"));
    }

    #[test]
    fn query_repeats_become_arrays() {
        let query = parse_query("ids=1&ids=2&single=x&empty=");
        assert_eq!(query.get("ids"), Some(&json!(["1", "2"])));
        assert_eq!(query.get("single"), Some(&json!("x")));
        assert_eq!(query.get("empty"), Some(&json!("")));
    }

    #[test]
    fn query_decodes_chinese() {
        let query = parse_query("keywords=%E5%91%A8%E6%9D%B0%E4%BC%A6");
        assert_eq!(query.get("keywords"), Some(&json!("周杰伦")));
    }
}
