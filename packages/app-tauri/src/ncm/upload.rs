//! `module/playlist_cover_update.js` + `plugins/upload.js` 的 Rust 版。
//!
//! 三步（第二步不在 `request` 管线上）：
//! 1. weapi `/api/nos/token/alloc` 申请 NOS 上传凭证
//! 2. 直接 POST 到 `nosup-hz1.127.net`（带 `x-nos-token`）
//! 3. weapi `/api/playlist/cover/update` 用拿到的 `docId` 更新封面

use serde_json::{json, Map, Value};

use crate::ncm::option::Options;
use crate::ncm::request::{create_request, Answer, Ctx};
use crate::ncm::server::UploadFile;
use crate::ncm::util::{js_string, Cookies};

fn weapi_options(cookies: &Cookies, ctx: &Ctx) -> Options {
    let cookie: Map<String, Value> = cookies
        .iter()
        .map(|(key, value)| (key.clone(), Value::String(value.clone())))
        .collect();
    Options {
        crypto: "weapi".to_string(),
        cookie: Some(Value::Object(cookie)),
        ip: "127.0.0.1".to_string(),
        domain: ctx.api_base.clone().unwrap_or_default(),
        ..Default::default()
    }
}

pub async fn playlist_cover(
    ctx: &Ctx,
    cookies: &Cookies,
    query: &Map<String, Value>,
    file: &UploadFile,
) -> Result<Value, Answer> {
    // 1. 申请上传凭证（字段顺序与插件一致）
    let mut alloc = Map::new();
    alloc.insert("bucket".into(), json!("yyimgs"));
    alloc.insert("ext".into(), json!("jpg"));
    alloc.insert("filename".into(), json!(file.filename));
    alloc.insert("local".into(), json!(false));
    alloc.insert("nos_product".into(), json!(0));
    alloc.insert(
        "return_body".into(),
        json!("{\"code\":200,\"size\":\"$(ObjectSize)\"}"),
    );
    alloc.insert("type".into(), json!("other"));

    let answer = create_request(
        ctx,
        "/api/nos/token/alloc",
        alloc,
        weapi_options(cookies, ctx),
    )
    .await?;
    let result = answer.body.get("result").cloned().unwrap_or(Value::Null);
    let object_key = result
        .get("objectKey")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let token = result
        .get("token")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let doc_id = result.get("docId").cloned().unwrap_or(Value::Null);

    if object_key.is_empty() || token.is_empty() {
        return Err(Answer::error(502, "NOS 上传凭证缺失"));
    }

    // 2. 直传 NOS（截图/封面字节原样作为 body）
    let nos_base = ctx
        .nos_base
        .clone()
        .unwrap_or_else(|| "https://nosup-hz1.127.net".to_string());
    let url = format!("{nos_base}/yyimgs/{object_key}?offset=0&complete=true&version=1.0");
    let mime = if file.content_type.is_empty() {
        "image/jpeg"
    } else {
        file.content_type.as_str()
    };
    let response = ctx
        .http
        .post(&url)
        .header("x-nos-token", &token)
        .header(reqwest::header::CONTENT_TYPE, mime)
        .body(file.data.clone())
        .send()
        .await
        .map_err(|error| Answer::error(502, format!("NOS 上传失败: {error}")))?;
    if !response.status().is_success() {
        return Err(Answer::error(
            502,
            format!("NOS 上传失败: HTTP {}", response.status().as_u16()),
        ));
    }

    // 3. 更新封面
    let mut update = Map::new();
    if let Some(id) = query.get("id") {
        update.insert("id".into(), json!(js_string(id)));
    }
    update.insert("coverImgId".into(), doc_id.clone());

    let answer = create_request(
        ctx,
        "/api/playlist/cover/update",
        update,
        weapi_options(cookies, ctx),
    )
    .await?;

    // 与 JS 一致：`{code:200, data:{...uploadInfo, ...res.body}}`
    let mut data = Map::new();
    data.insert(
        "url_pre".into(),
        json!(format!("https://p1.music.126.net/{object_key}")),
    );
    data.insert("imgId".into(), doc_id);
    if let Value::Object(body) = answer.body {
        for (key, value) in body {
            data.insert(key, value);
        }
    }

    Ok(json!({ "code": 200, "data": data }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ncm::testkit::{MockUpstream, Reply};
    use crate::ncm::util::Cookies;

    fn ctx(base: &str) -> Ctx {
        Ctx::new(
            reqwest::Client::builder().no_proxy().build().unwrap(),
            "DEVICE".into(),
            String::new(),
            String::new(),
        )
        .with_endpoints(base)
    }

    #[tokio::test]
    async fn playlist_cover_runs_alloc_nos_then_update() {
        let mock = MockUpstream::start(vec![
            Reply::json(json!({
                "code": 200,
                "result": { "objectKey": "cover.jpg", "token": "nos-token", "docId": 12345 }
            })),
            Reply::json(json!({ "code": 200, "size": "3" })),
            Reply::json(json!({ "code": 200 })),
        ])
        .await;

        let mut cookies = Cookies::new();
        cookies.insert("MUSIC_U".into(), "u".into());
        let mut query = Map::new();
        query.insert("id".into(), json!("3778678"));

        let file = UploadFile {
            field: "imgFile".into(),
            filename: "cover.jpg".into(),
            content_type: "image/jpeg".into(),
            data: vec![1, 2, 3],
        };

        let body = playlist_cover(&ctx(&mock.base), &cookies, &query, &file)
            .await
            .expect("成功");
        assert_eq!(body["code"], json!(200));
        assert_eq!(body["data"]["imgId"], json!(12345));
        assert_eq!(
            body["data"]["url_pre"],
            json!("https://p1.music.126.net/cover.jpg")
        );

        let requests = mock.requests();
        assert_eq!(requests.len(), 3, "token alloc / NOS / cover update");
        assert_eq!(requests[0].path, "/weapi/nos/token/alloc");
        // mock 只记 path（query 在 uri 里，不单独记录）
        assert_eq!(requests[1].path, "/yyimgs/cover.jpg");
        assert_eq!(
            requests[1]
                .headers
                .get("x-nos-token")
                .and_then(|value| value.to_str().ok()),
            Some("nos-token")
        );
        assert_eq!(requests[1].body.as_bytes(), &[1, 2, 3]);
        assert_eq!(requests[2].path, "/weapi/playlist/cover/update");
    }

    #[tokio::test]
    async fn playlist_cover_reports_missing_credentials() {
        let mock = MockUpstream::start(vec![Reply::json(json!({
            "code": 200,
            "result": { "objectKey": "", "token": "" }
        }))])
        .await;
        let file = UploadFile {
            field: "imgFile".into(),
            filename: "cover.jpg".into(),
            content_type: "image/jpeg".into(),
            data: vec![0],
        };
        let error = playlist_cover(&ctx(&mock.base), &Cookies::new(), &Map::new(), &file)
            .await
            .expect_err("应当失败");
        assert_eq!(error.status, 502);
    }
}
