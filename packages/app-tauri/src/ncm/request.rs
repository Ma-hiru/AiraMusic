//! 1:1 复刻上游 `util/request.js` 的 `createRequest`。
//!
//! 流程顺序完全照抄（每一步都能在源码里找到对应行）：
//! 1. 需要时先取反作弊 token（`options.checkToken`）
//! 2. 选加密方式：`''` → `APP_CONF.encrypt ? 'eapi' : 'api'`
//! 3. `X-Real-IP` / `X-Forwarded-For`
//! 4. cookie 归一化 + `processCookieObject`
//! 5. 按加密方式组 header / url / body
//! 6. 发请求，处理 set-cookie（含 NMTID 采集）
//! 7. 解密响应、`code` 数字化、特殊状态码折成 200、越界状态码折成 400
//! 8. 200 → Ok，其余 → Err（`server.js` 的 catch 分支靠这个区分）
//!
//! 第 1–5 步被单独抽成 `prepare`：它不碰网络，便于和 JS 版逐字段对拍。

use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex};

use futures_util::future::BoxFuture;
use indexmap::IndexMap;
use serde_json::{json, Map, Value};

use crate::ncm::config::{
    choose_user_agent, is_special_status, now_ms, now_secs, os_profile, wnmcid, APP_CONF,
    UA_EAPI_OSX,
};
use crate::ncm::crypto;
use crate::ncm::option::{CheckToken, Options};
use crate::ncm::util::{
    cookie_obj_to_string, cookie_to_json, js_string, to_boolean, url_search_params, Cookies,
};
use crate::ncm::xeapi::{self, PublicKeyState};

/// 反作弊 token 的获取方式由宿主注入（主窗口注入易盾 SDK 现场生成）
pub type AnticheatFn = Arc<dyn Fn(CheckToken) -> BoxFuture<'static, String> + Send + Sync>;

/// `createRequest` 的进程级状态：`global.deviceId`、`/tmp/anonymous_token`、
/// `global.cnIp`，以及 `NMTID` 的采集/重试计数
pub struct Ctx {
    pub http: reqwest::Client,
    pub device_id: String,
    pub anonymous_token: String,
    pub cn_ip: String,
    nmtid: Mutex<String>,
    nmtid_retries_left: AtomicU8,
    anticheat: AnticheatFn,
    /// xeapi 公钥（`/tmp/xeapi_public_key`），首次用到时同步拉取
    xeapi_key: Mutex<Option<PublicKeyState>>,
    /// xeapi 会话（`x-encr-ssid` / `x-encr-sskey`）
    xeapi_session: Mutex<(String, String)>,
    /// 测试用：把 `request` 的域名指向本地 mock
    pub api_base: Option<String>,
    /// 测试用：NOS 上传域名
    pub nos_base: Option<String>,
    /// 测试用：clientlog 上报域名
    pub log_base: Option<String>,
}

impl Ctx {
    pub fn new(
        http: reqwest::Client,
        device_id: String,
        anonymous_token: String,
        cn_ip: String,
    ) -> Self {
        Self {
            http,
            device_id,
            anonymous_token,
            cn_ip,
            nmtid: Mutex::new(String::new()),
            nmtid_retries_left: AtomicU8::new(3),
            anticheat: Arc::new(|_| Box::pin(async { String::new() })),
            xeapi_key: Mutex::new(None),
            xeapi_session: Mutex::new((String::new(), String::new())),
            api_base: None,
            nos_base: None,
            log_base: None,
        }
    }

    /// 测试用：三个外部域名都指向同一个本地 mock
    #[allow(dead_code)]
    pub fn with_endpoints(mut self, base: &str) -> Self {
        self.api_base = Some(base.to_string());
        self.nos_base = Some(base.to_string());
        self.log_base = Some(base.to_string());
        self
    }

    fn xeapi_key(&self) -> Option<PublicKeyState> {
        self.xeapi_key.lock().ok()?.clone()
    }

    fn set_xeapi_key(&self, key: PublicKeyState) {
        if let Ok(mut slot) = self.xeapi_key.lock() {
            *slot = Some(key);
        }
    }

    fn xeapi_session(&self) -> (String, String) {
        self.xeapi_session
            .lock()
            .map(|value| value.clone())
            .unwrap_or_default()
    }

    fn set_xeapi_session(&self, id: String, key: String) {
        if let Ok(mut slot) = self.xeapi_session.lock() {
            *slot = (id, key);
        }
    }

    /// `util/xeapiKey.js`：优先用落盘缓存，缺失或设备号不匹配时重新拉取
    pub(crate) async fn ensure_xeapi_key(&self) -> Option<PublicKeyState> {
        if let Some(key) = self.xeapi_key() {
            if !key.sk.is_empty() {
                return Some(key);
            }
        }
        if let Some(cached) = xeapi::load_cached() {
            if let Some(state) = PublicKeyState::from_json(&cached, &self.device_id) {
                if !state.sk.is_empty() {
                    self.set_xeapi_key(state.clone());
                    return Some(state);
                }
            }
        }
        let current = xeapi::load_cached()
            .and_then(|value| value.get("version").map(|v| v.to_string()))
            .unwrap_or_default();
        match xeapi::fetch_public_key(
            &self.http,
            APP_CONF.api_domain,
            &self.device_id,
            current.trim_matches('"'),
        )
        .await
        {
            Ok(value) => {
                xeapi::save_cached(&value);
                let state = PublicKeyState::from_json(&value, &self.device_id)?;
                self.set_xeapi_key(state.clone());
                Some(state)
            }
            Err(error) => {
                crate::host_err!("[ncm] xeapi 公钥获取失败: {error}");
                None
            }
        }
    }

    pub fn with_anticheat(mut self, anticheat: AnticheatFn) -> Self {
        self.anticheat = anticheat;
        self
    }

    fn nmtid(&self) -> String {
        self.nmtid
            .lock()
            .map(|value| value.clone())
            .unwrap_or_default()
    }

    pub(crate) fn set_nmtid(&self, value: String) {
        if let Ok(mut slot) = self.nmtid.lock() {
            *slot = value;
        }
    }

    fn retries_left(&self) -> u8 {
        self.nmtid_retries_left.load(Ordering::SeqCst)
    }

    fn consume_retry(&self) {
        let _ = self
            .nmtid_retries_left
            .try_update(Ordering::SeqCst, Ordering::SeqCst, |value| {
                Some(value.saturating_sub(1))
            });
    }
}

/// `answer`：上游把 `status/body/cookie` 三者一起返回，失败时也用同一个结构 reject
#[derive(Clone, Debug)]
pub struct Answer {
    pub status: u16,
    pub body: Value,
    pub cookie: Vec<String>,
}

impl Answer {
    pub fn error(status: u16, message: impl Into<String>) -> Self {
        Self {
            status,
            body: json!({ "code": status, "msg": message.into() }),
            cookie: Vec::new(),
        }
    }
}

/// 第 1–5 步的产物：一次请求的全部形状
#[derive(Debug)]
pub struct Prepared {
    pub url: String,
    pub headers: IndexMap<String, String>,
    pub body: String,
    /// 进入加密前的 `data`（含 `e_r` / `csrf_token` / `header`）；对拍测试用
    #[allow(dead_code)]
    pub plaintext: Value,
    pub crypto: String,
    pub e_r: bool,
    #[allow(dead_code)]
    pub cookie: Cookies,
    /// 本次请求是否"没带 NMTID"（决定响应里要不要采集）
    pub cookie_had_nmtid: bool,
}

/// `utils.cryptoObjToString(header)`：header 的值全部按字符串处理
fn header_cookie_string(header: &Map<String, Value>) -> String {
    let mut cookie = Cookies::new();
    for (key, value) in header {
        cookie.insert(key.clone(), js_string(value));
    }
    cookie_obj_to_string(&cookie)
}

/// `cleanCookie(x)`：`x.replace(/\s*Domain=[^(;|$)]+;*/, '')`
pub fn clean_cookie(cookie: &str) -> String {
    let Some(index) = cookie.find("Domain=") else {
        return cookie.to_string();
    };
    let bytes = cookie.as_bytes();
    let mut start = index;
    while start > 0 && bytes[start - 1].is_ascii_whitespace() {
        start -= 1;
    }
    let mut end = index + "Domain=".len();
    while end < bytes.len() && !matches!(bytes[end], b'(' | b';' | b'|' | b'$') {
        end += 1;
    }
    while end < bytes.len() && bytes[end] == b';' {
        end += 1;
    }
    format!("{}{}", &cookie[..start], &cookie[end..])
}

/// `generateRequestId()`：`${Date.now()}_${随机 0..999 左补零到 4 位}`
pub fn generate_request_id() -> String {
    format!("{}_{:04}", now_ms(), rand::random_range(0..1000))
}

/// `processCookieObject(cookie, crypto)`
pub fn process_cookie_object(ctx: &Ctx, cookie: &Cookies, crypto: &str) -> Cookies {
    let nuid = random_hex(32);
    let profile = cookie
        .get("os")
        .map(|value| os_profile(value))
        .unwrap_or_else(|| os_profile("pc"));

    let mut out = cookie.clone();
    out.insert("__remember_me".into(), "true".into());
    out.insert("ntes_kaola_ad".into(), "1".into());
    out.entry("_ntes_nuid".to_string()).or_insert(nuid.clone());
    out.entry("_ntes_nnid".to_string())
        .or_insert(format!("{nuid},{}", now_ms()));
    out.entry("WNMCID".to_string())
        .or_insert(wnmcid().to_string());
    out.entry("WEVNSM".to_string()).or_insert("1.0.0".into());
    out.entry("osver".to_string())
        .or_insert(profile.osver.to_string());
    out.entry("deviceId".to_string())
        .or_insert(ctx.device_id.clone());
    out.entry("os".to_string())
        .or_insert(profile.os.to_string());
    out.entry("channel".to_string())
        .or_insert(profile.channel.to_string());
    out.entry("appver".to_string())
        .or_insert(profile.appver.to_string());

    // 服务端下发条件为「不带 NMTID 请求任意 eapi 加密方式接口」
    if let Some(value) = cookie.get("NMTID") {
        out.insert("NMTID".into(), value.clone());
    } else {
        let captured = ctx.nmtid();
        if !captured.is_empty() {
            out.insert("NMTID".into(), captured);
        } else if ctx.retries_left() == 0 || crypto != "eapi" {
            out.insert("NMTID".into(), format!("00O{}", random_hex(19)));
        }
    }

    if !out.contains_key("MUSIC_U") {
        out.entry("MUSIC_A".to_string())
            .or_insert_with(|| ctx.anonymous_token.clone());
    }

    out
}

fn random_hex(length: usize) -> String {
    (0..length)
        .map(|_| format!("{:x}", rand::random_range(0..16)))
        .collect()
}

/// cookie 来源可以是对象（server.js 注入）也可以是字符串（`?cookie=` 查询串）
pub fn resolve_cookie(options: &Options) -> Cookies {
    match options.cookie.as_ref() {
        None | Some(Value::Null) => Cookies::new(),
        Some(Value::String(text)) => cookie_to_json(text),
        Some(Value::Object(map)) => map
            .iter()
            .map(|(key, value)| (key.clone(), js_string(value)))
            .collect(),
        Some(other) => cookie_to_json(&js_string(other)),
    }
}

/// 第 1–5 步：把 `(uri, data, options)` 变成可发送的请求（不含网络 IO）
pub fn prepare(
    ctx: &Ctx,
    uri: &str,
    mut data: Map<String, Value>,
    options: &Options,
    token: &str,
) -> Result<Prepared, Answer> {
    // 2. 加密方式
    let mut crypto = options.crypto.clone();
    if crypto.is_empty() {
        crypto = if APP_CONF.encrypt {
            "eapi".to_string()
        } else {
            "api".to_string()
        };
    }

    let mut headers: IndexMap<String, String> = options.headers.clone();

    // 3. IP 头
    let ip = options
        .real_ip
        .clone()
        .filter(|value| !value.is_empty())
        .or_else(|| Some(options.ip.clone()).filter(|value| !value.is_empty()))
        .unwrap_or_default();
    if !ip.is_empty() {
        headers.insert("X-Real-IP".into(), ip.clone());
        headers.insert("X-Forwarded-For".into(), ip);
    }

    // 4. cookie
    let cookie = process_cookie_object(ctx, &resolve_cookie(options), &crypto);
    headers.insert("Cookie".into(), cookie_obj_to_string(&cookie));
    let csrf = cookie.get("__csrf").cloned().unwrap_or_default();

    // 5. e_r：`options.e_r ?? data.e_r ?? ENCRYPT_RESPONSE`
    let e_r = match (&options.e_r, data.get("e_r")) {
        (Some(value), _) => to_boolean(value),
        (None, Some(value)) => to_boolean(value),
        (None, None) => APP_CONF.encrypt_response,
    };
    data.insert("e_r".into(), json!(e_r));

    let domain = options.domain.clone();
    let base = |fallback: &'static str| -> String {
        if domain.is_empty() {
            fallback.to_string()
        } else {
            domain.clone()
        }
    };
    let stripped: String = uri.chars().skip(5).collect();

    let url;
    let mut form: Map<String, Value> = Map::new();
    let plaintext;
    let cookie_had_nmtid = cookie.contains_key("NMTID");

    match crypto.as_str() {
        "weapi" => {
            headers.insert("Referer".into(), base(APP_CONF.domain));
            headers.insert(
                "User-Agent".into(),
                if options.ua.is_empty() {
                    choose_user_agent("weapi", "pc").to_string()
                } else {
                    options.ua.clone()
                },
            );
            data.insert("csrf_token".into(), json!(csrf));
            if options.check_token.is_truthy() {
                headers.insert("X-antiCheatToken".into(), token.to_string());
            }
            plaintext = Value::Object(data);
            let params = crypto::weapi(&plaintext);
            form.insert("params".into(), json!(params.params));
            form.insert("encSecKey".into(), json!(params.enc_sec_key));
            url = format!("{}/weapi/{stripped}", base(APP_CONF.domain));
        }
        "linuxapi" => {
            headers.insert(
                "User-Agent".into(),
                if options.ua.is_empty() {
                    choose_user_agent("linuxapi", "linux").to_string()
                } else {
                    options.ua.clone()
                },
            );
            plaintext = Value::Object(data.clone());
            let forward = json!({
                "method": "POST",
                "url": format!("{}{uri}", base(APP_CONF.domain)),
                "params": Value::Object(data),
            });
            form.insert("eparams".into(), json!(crypto::linuxapi(&forward)));
            url = format!("{}/api/linux/forward", base(APP_CONF.domain));
        }
        "xeapi" => {
            let state = ctx
                .xeapi_key()
                .or_else(|| {
                    xeapi::load_cached()
                        .and_then(|value| PublicKeyState::from_json(&value, &ctx.device_id))
                })
                .ok_or_else(|| Answer::error(502, "xeapi 公钥缺失"))?;

            let xeapi_os = "android";
            let xeapi_appver = if cookie.get("os").map(String::as_str) == Some("android") {
                cookie
                    .get("appver")
                    .filter(|value| !value.is_empty())
                    .cloned()
                    .unwrap_or_else(|| "9.1.65".to_string())
            } else {
                "9.1.65".to_string()
            };
            let xeapi_osver = if cookie.get("os").map(String::as_str) == Some("android") {
                cookie
                    .get("osver")
                    .filter(|value| !value.is_empty())
                    .cloned()
                    .unwrap_or_else(|| "16".to_string())
            } else {
                "16".to_string()
            };
            let buildver = cookie
                .get("buildver")
                .cloned()
                .unwrap_or_else(|| now_secs().to_string());
            let device = cookie.get("deviceId").cloned().unwrap_or_default();
            let sdevice = cookie
                .get("sDeviceId")
                .cloned()
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| device.clone());

            headers.insert(
                "User-Agent".into(),
                if options.ua.is_empty() {
                    choose_user_agent("api", "android").to_string()
                } else {
                    options.ua.clone()
                },
            );
            headers.insert("X-Client-Enc-State".into(), "ENCRYPTED".into());
            headers.insert("x-aeapi".into(), "true".into());
            headers.insert(
                "content-type".into(),
                "application/x-www-form-urlencoded;charset=utf-8".into(),
            );
            headers.insert("x-deviceid".into(), device.clone());
            headers.insert("x-os".into(), xeapi_os.into());
            headers.insert("x-osver".into(), xeapi_osver.clone());
            headers.insert("x-appver".into(), xeapi_appver.clone());
            headers.insert("x-sdeviceid".into(), sdevice.clone());
            headers.insert("x-buildver".into(), buildver.clone());
            if let Some(value) = cookie.get("MUSIC_U") {
                headers.insert("x-music-u".into(), value.clone());
            }
            if options.check_token.is_truthy() {
                headers.insert("X-antiCheatToken".into(), token.to_string());
            }

            let mut xeapi_cookie = cookie.clone();
            xeapi_cookie.insert("os".into(), xeapi_os.into());
            xeapi_cookie.insert("osver".into(), xeapi_osver);
            xeapi_cookie.insert("appver".into(), xeapi_appver);
            xeapi_cookie.insert("buildver".into(), buildver);
            xeapi_cookie.insert("deviceId".into(), device.clone());
            xeapi_cookie.insert("sDeviceId".into(), sdevice);
            headers.insert("Cookie".into(), cookie_obj_to_string(&xeapi_cookie));

            let mut body_data = data.clone();
            body_data.remove("e_r");
            let (session_id, session_key) = ctx.xeapi_session();
            plaintext = serde_json::from_str(&xeapi::build_plaintext(uri, &body_data))
                .unwrap_or_else(|_| Value::Object(body_data.clone()));

            let encrypted = xeapi::encrypt(uri, &body_data, &state, &session_id, &session_key)
                .ok_or_else(|| Answer::error(502, "xeapi 加密失败"))?;
            form.insert("C".into(), json!(encrypted.c));
            form.insert("S".into(), json!(encrypted.s));
            form.insert("R".into(), json!(encrypted.r));
            url = format!("{}/xeapi/{stripped}", base(APP_CONF.xeapi_domain));
        }
        "eapi" | "api" => {
            let now = now_secs().to_string();
            let mut header: Map<String, Value> = Map::new();
            header.insert(
                "osver".into(),
                json!(cookie.get("osver").cloned().unwrap_or_default()),
            );
            header.insert(
                "deviceId".into(),
                json!(cookie
                    .get("deviceId")
                    .cloned()
                    .unwrap_or_else(|| ctx.device_id.clone())),
            );
            header.insert(
                "os".into(),
                json!(cookie.get("os").cloned().unwrap_or_default()),
            );
            header.insert(
                "appver".into(),
                json!(cookie.get("appver").cloned().unwrap_or_default()),
            );
            header.insert(
                "versioncode".into(),
                json!(cookie
                    .get("versioncode")
                    .cloned()
                    .unwrap_or_else(|| "140".into())),
            );
            header.insert(
                "mobilename".into(),
                json!(cookie.get("mobilename").cloned().unwrap_or_default()),
            );
            header.insert(
                "buildver".into(),
                json!(cookie
                    .get("buildver")
                    .cloned()
                    .unwrap_or_else(|| now.clone())),
            );
            header.insert(
                "resolution".into(),
                json!(cookie
                    .get("resolution")
                    .cloned()
                    .unwrap_or_else(|| "1920x1080".into())),
            );
            header.insert("__csrf".into(), json!(csrf));
            header.insert(
                "channel".into(),
                json!(cookie.get("channel").cloned().unwrap_or_default()),
            );
            header.insert("requestId".into(), json!(generate_request_id()));

            if let Some(value) = cookie.get("MUSIC_U") {
                header.insert("MUSIC_U".into(), json!(value));
            }
            if let Some(value) = cookie.get("MUSIC_A") {
                header.insert("MUSIC_A".into(), json!(value));
            }
            if options.check_token.is_truthy() {
                header.insert("X-antiCheatToken".into(), json!(token));
            }
            if crypto == "eapi" {
                if let Some(value) = cookie.get("NMTID") {
                    header.insert("NMTID".into(), json!(value));
                }
            }

            headers.insert("Cookie".into(), header_cookie_string(&header));
            headers.insert(
                "User-Agent".into(),
                if !options.ua.is_empty() {
                    options.ua.clone()
                } else if cookie.get("os").map(String::as_str) == Some("osx") {
                    UA_EAPI_OSX.to_string()
                } else {
                    choose_user_agent("api", "iphone").to_string()
                },
            );

            if crypto == "eapi" {
                data.insert("header".into(), Value::Object(header));
                plaintext = Value::Object(data);
                form.insert("params".into(), json!(crypto::eapi(uri, &plaintext)));
                url = format!("{}/eapi/{stripped}", base(APP_CONF.eapi_domain));
            } else {
                plaintext = Value::Object(data.clone());
                form = data;
                url = format!("{}{uri}", base(APP_CONF.api_domain));
            }
        }
        other => {
            return Err(Answer::error(502, format!("暂不支持的加密方式: {other}")));
        }
    }

    // axios 对 URLSearchParams 请求体给出的默认头（xeapi 自己指定过 charset，不覆盖）
    if !headers
        .keys()
        .any(|key| key.eq_ignore_ascii_case("content-type"))
    {
        headers.insert(
            "Content-Type".into(),
            "application/x-www-form-urlencoded".into(),
        );
    }
    headers
        .entry("Accept".to_string())
        .or_insert_with(|| "application/json, text/plain, */*".to_string());

    let body = url_search_params(&form);
    if crypto != "api" && body.is_empty() {
        return Err(Answer::error(502, "加密结果为空"));
    }

    Ok(Prepared {
        url,
        headers,
        body,
        plaintext,
        crypto,
        e_r,
        cookie,
        cookie_had_nmtid,
    })
}

/// `createRequest(uri, data, options)`
pub async fn create_request(
    ctx: &Ctx,
    uri: &str,
    data: Map<String, Value>,
    options: Options,
) -> Result<Answer, Answer> {
    // 1. 反作弊 token（每次实时获取，不缓存）
    let mut token = String::new();
    if matches!(options.check_token, CheckToken::V2 | CheckToken::V3) {
        token = (ctx.anticheat)(options.check_token).await;
    }

    // xeapi 需要先拿到服务端下发的公钥
    let wants_xeapi = if options.crypto.is_empty() {
        !APP_CONF.encrypt
    } else {
        options.crypto == "xeapi"
    };
    if wants_xeapi {
        let _ = ctx.ensure_xeapi_key().await;
    }

    let prepared = prepare(ctx, uri, data, &options, &token)?;

    let mut request = ctx.http.post(&prepared.url).body(prepared.body.clone());

    for (key, value) in &prepared.headers {
        // Cookie 单独追加，避免被同名默认值覆盖
        if key.eq_ignore_ascii_case("cookie") {
            continue;
        }
        request = request.header(key, value);
    }
    if let Some(cookie_header) = prepared.headers.get("Cookie") {
        request = request.header(reqwest::header::COOKIE, cookie_header);
    }
    if options.timeout > 0 {
        request = request.timeout(std::time::Duration::from_millis(options.timeout));
    }

    // 6. 发送
    let response = match request.send().await {
        Ok(response) => response,
        Err(error) => {
            let mut answer = Answer::error(502, error.to_string());
            answer.body = json!({ "code": 502, "msg": error.to_string() });
            return Err(answer);
        }
    };

    let http_status = response.status().as_u16();
    let set_cookies: Vec<String> = response
        .headers()
        .get_all(reqwest::header::SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .map(str::to_string)
        .collect();
    let aeapi = response
        .headers()
        .get("x-aeapi")
        .and_then(|value| value.to_str().ok())
        .map(|value| value != "false" && !value.is_empty())
        .unwrap_or(false);
    // xeapi 会话号：服务端下发一次，后续请求复用它派生同一个 dynamic key
    if prepared.crypto == "xeapi" {
        let session_id = response
            .headers()
            .get("x-encr-ssid")
            .and_then(|value| value.to_str().ok())
            .map(str::to_string);
        let session_key = response
            .headers()
            .get("x-encr-sskey")
            .and_then(|value| value.to_str().ok())
            .map(str::to_string);
        if let (Some(id), Some(key)) = (session_id, session_key) {
            ctx.set_xeapi_session(id, key);
        }
    }

    let response_headers = response.headers().clone();
    let raw = match response.bytes().await {
        Ok(bytes) => bytes,
        Err(error) => return Err(Answer::error(502, error.to_string())),
    };

    let mut answer = Answer {
        status: http_status,
        body: Value::Null,
        cookie: Vec::new(),
    };

    // NMTID 采集：只有真正没带 NMTID 的 eapi 探测请求才消耗一次重试
    if prepared.crypto == "eapi"
        && ctx.nmtid().is_empty()
        && ctx.retries_left() > 0
        && !prepared.cookie_had_nmtid
    {
        ctx.consume_retry();
        for item in &set_cookies {
            let cleaned = clean_cookie(item);
            if let Some(value) = extract_cookie_value(item, "NMTID") {
                ctx.set_nmtid(value);
            }
            answer.cookie.push(cleaned);
        }
    } else {
        answer.cookie = set_cookies.iter().map(|item| clean_cookie(item)).collect();
    }

    // 7. 解析响应
    let text = String::from_utf8_lossy(&raw).into_owned();
    if std::env::var("AIRA_LOG_API").is_ok() {
        crate::host_err!(
            "[ncm] {} {} <- {} {}",
            prepared.crypto,
            prepared.url,
            http_status,
            text.chars().take(300).collect::<String>()
        );
        if prepared.crypto == "xeapi" && raw.len() < 64 {
            crate::host_err!(
                "[ncm] xeapi 响应异常 len={} headers={response_headers:?}",
                raw.len()
            );
        }
    }
    let parsed = if prepared.crypto == "xeapi" {
        xeapi::res_decrypt(&raw)
    } else if prepared.crypto == "eapi" && prepared.e_r {
        crypto::eapi_res_decrypt(&text.trim().to_uppercase(), aeapi)
    } else {
        parse_body(&text)
    };
    let Some(body) = parsed else {
        answer.status = http_status;
        return Err(answer);
    };
    answer.body = body;

    if let Some(code) = answer.body.get("code").and_then(js_code) {
        if let Some(object) = answer.body.as_object_mut() {
            object.insert("code".into(), json!(code));
        }
    }

    let code = answer
        .body
        .get("code")
        .and_then(Value::as_u64)
        .map(|value| value as u16);
    let mut status = code.unwrap_or(http_status);
    if is_special_status(code.unwrap_or(0)) {
        status = 200;
    }
    answer.status = if status > 100 && status < 600 {
        status
    } else {
        400
    };

    if answer.status == 200 {
        Ok(answer)
    } else {
        Err(answer)
    }
}

/// `Number(code)`：`true` → 1、`"301"` → 301、非数字 → NaN（这里视为缺失）
fn js_code(value: &Value) -> Option<u64> {
    match value {
        Value::Number(number) => number.as_u64(),
        Value::String(text) => text.trim().parse::<f64>().ok().map(|value| value as u64),
        Value::Bool(value) => Some(u64::from(*value)),
        _ => None,
    }
}

fn extract_cookie_value(cookie: &str, name: &str) -> Option<String> {
    for part in cookie.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix(&format!("{name}=")) {
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

/// `parseBody(text)`：上游偶发把同一份 JSON 连写两遍（`{...}{...}`）
pub fn parse_body(text: &str) -> Option<Value> {
    if let Ok(value) = serde_json::from_str::<Value>(text) {
        return Some(value);
    }
    let index = text.find("}{")?;
    serde_json::from_str::<Value>(&text[..index + 1]).ok()
}

/// 测试/调试用：把 eapi 请求体解回明文
#[allow(dead_code)]
pub fn peek_eapi_body(body: &str) -> Option<Value> {
    let params = url::form_urlencoded::parse(body.as_bytes())
        .find(|(key, _)| key == "params")
        .map(|(_, value)| value.into_owned())?;
    match crypto::eapi_req_decrypt(&params) {
        Some((_, data)) => Some(Value::Object(data.as_object()?.clone())),
        None => crypto::eapi_res_decrypt(&params, false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ncm::option::CheckToken;
    use crate::ncm::xeapi::PublicKeyState;

    fn ctx() -> Ctx {
        Ctx::new(
            reqwest::Client::builder().no_proxy().build().unwrap(),
            "DEVICE".to_string(),
            "guest".to_string(),
            "1.2.4.8".to_string(),
        )
    }

    fn options(crypto: &str) -> Options {
        Options {
            crypto: crypto.to_string(),
            cookie: Some(serde_json::json!({})),
            ip: "127.0.0.1".to_string(),
            ..Default::default()
        }
    }

    #[test]
    fn api_crypto_posts_raw_form() {
        let prepared = prepare(&ctx(), "/api/x", Map::new(), &options("api"), "").unwrap();
        assert_eq!(prepared.url, "https://interface.music.163.com/api/x");
        assert!(prepared.body.contains("e_r=false"));
        assert!(prepared.headers.get("Cookie").is_some());
        assert!(prepared.headers.get("Referer").is_none());
    }

    #[test]
    fn unknown_crypto_is_rejected() {
        let error = prepare(&ctx(), "/api/x", Map::new(), &options("ncbl"), "").unwrap_err();
        assert_eq!(error.status, 502);
    }

    #[test]
    fn weapi_with_check_token_sets_anticheat_header() {
        let mut options = options("weapi");
        options.check_token = CheckToken::V2;
        let prepared = prepare(&ctx(), "/api/x", Map::new(), &options, "TOKEN").unwrap();
        assert_eq!(
            prepared.headers.get("X-antiCheatToken").map(String::as_str),
            Some("TOKEN")
        );
        assert_eq!(
            prepared.headers.get("Referer").map(String::as_str),
            Some("https://music.163.com")
        );
    }

    #[test]
    fn eapi_puts_token_in_header_object_too() {
        let mut options = options("eapi");
        options.check_token = CheckToken::V3;
        let prepared = prepare(&ctx(), "/api/x", Map::new(), &options, "TOKEN").unwrap();
        assert_eq!(prepared.plaintext["header"]["X-antiCheatToken"], "TOKEN");
    }

    #[test]
    fn xeapi_uses_injected_key_and_android_identity() {
        let ctx = ctx();
        ctx.set_xeapi_key(PublicKeyState {
            version: serde_json::json!("1000000000000"),
            public_key: base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                [7u8; 32],
            ),
            sk: "sk".into(),
            device_id: "DEVICE".into(),
        });

        let prepared = prepare(&ctx, "/api/x", Map::new(), &options("xeapi"), "").unwrap();
        assert!(prepared
            .url
            .starts_with("https://interface3.music.163.com/xeapi/"));
        assert_eq!(
            prepared.headers.get("x-aeapi").map(String::as_str),
            Some("true")
        );
        assert_eq!(
            prepared.headers.get("x-os").map(String::as_str),
            Some("android")
        );
        // C / S / R 三个字段
        let mut keys: Vec<&str> = prepared
            .body
            .split('&')
            .filter_map(|pair| pair.split_once('=').map(|(key, _)| key))
            .collect();
        keys.sort_unstable();
        assert_eq!(keys, vec!["C", "R", "S"]);
    }

    #[test]
    fn xeapi_without_key_fails_cleanly() {
        // 没有缓存也没有注入时给出明确错误，而不是 panic
        let ctx = Ctx::new(
            reqwest::Client::builder().no_proxy().build().unwrap(),
            "DEVICE".to_string(),
            String::new(),
            String::new(),
        );
        let result = prepare(&ctx, "/api/x", Map::new(), &options("xeapi"), "");
        if let Ok(prepared) = result {
            // 机器上可能已有 /tmp/xeapi_public_key 缓存
            assert!(prepared.url.contains("/xeapi/"));
        } else {
            assert_eq!(result.unwrap_err().status, 502);
        }
    }

    #[test]
    fn nmtid_is_random_after_retries_are_exhausted() {
        let ctx = ctx();
        for _ in 0..3 {
            ctx.consume_retry();
        }
        let cookie = process_cookie_object(&ctx, &Cookies::new(), "eapi");
        assert!(cookie
            .get("NMTID")
            .map(|value| value.starts_with("00O"))
            .unwrap_or(false));
    }

    #[test]
    fn nmtid_is_masked_when_already_captured() {
        let ctx = ctx();
        ctx.set_nmtid("captured".into());
        let cookie = process_cookie_object(&ctx, &Cookies::new(), "eapi");
        assert_eq!(cookie.get("NMTID").map(String::as_str), Some("captured"));
    }

    #[test]
    fn cookie_string_source_is_parsed() {
        let mut options = options("weapi");
        options.cookie = Some(serde_json::json!("MUSIC_U=abc; __csrf=xyz"));
        let prepared = prepare(&ctx(), "/api/x", Map::new(), &options, "").unwrap();
        assert!(prepared
            .headers
            .get("Cookie")
            .map(|value| value.contains("MUSIC_U=abc"))
            .unwrap_or(false));
        assert_eq!(prepared.plaintext["csrf_token"], "xyz");
    }

    #[test]
    fn clean_cookie_removes_domain_attribute() {
        assert_eq!(
            clean_cookie("MUSIC_U=abc; Domain=.music.163.com; Path=/"),
            "MUSIC_U=abc; Path=/"
        );
        assert_eq!(clean_cookie("a=1; Path=/"), "a=1; Path=/");
        // 与 JS 正则一致：只吃掉 ` Domain=...`，结尾的分号保留
        assert_eq!(clean_cookie("a=1; Domain=music.163.com"), "a=1;");
    }

    #[test]
    fn request_id_has_expected_shape() {
        let id = generate_request_id();
        let (millis, suffix) = id.split_once('_').expect("下划线分隔");
        assert_eq!(millis.len(), 13);
        assert_eq!(suffix.len(), 4);
    }
}
