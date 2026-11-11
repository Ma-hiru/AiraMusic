//! 1:1 复刻上游 `util/option.js` 的 `createOption`。
//!
//! ```js
//! const createOption = (query, crypto = '', checkToken = false) => ({
//!   crypto: query.crypto || crypto || '',
//!   cookie: query.cookie || process.env.NETEASE_COOKIE,
//!   ua: query.ua || '',
//!   proxy: query.proxy,
//!   realIP: query.realIP,
//!   randomCNIP: process.env.ENABLE_RANDOM_CN_IP === 'true'
//!     ? !['false', false].includes(query.randomCNIP)
//!     : ['true', true].includes(query.randomCNIP),
//!   e_r: query.e_r || undefined,
//!   domain: query.domain || '',
//!   checkToken: query.checkToken || checkToken,
//!   headers: query.headers || {},
//!   timeout: query.timeout || 0,
//! })
//! ```

use indexmap::IndexMap;
use serde_json::{Map, Value};

/// `options.checkToken` 的取值：上游用 `'v2' / 'v3'` 字符串区分取 token 的方式
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum CheckToken {
    /// 不取反作弊 token
    Off,
    /// 易盾 Watchman（JS 里跑在 jsdom；这里由主窗口注入 SDK 现场生成）
    V2,
    /// 易盾 v3（上游 `register_checktoken_v3`）
    V3,
    /// 传了真值但不是 `'v2'/'v3'`：上游不会去取 token，却仍会写一个空 header
    Other,
}

impl CheckToken {
    pub fn is_truthy(self) -> bool {
        !matches!(self, CheckToken::Off)
    }
}

#[derive(Clone, Debug)]
pub struct Options {
    /// 空串表示"用默认"，由 `request` 决定（`APP_CONF.encrypt` → eapi）
    pub crypto: String,
    pub cookie: Option<Value>,
    pub ua: String,
    /// 上游支持 `?proxy=`，宿主目前不使用（请求统一走 `http::client`）
    #[allow(dead_code)]
    pub proxy: Option<String>,
    pub real_ip: Option<String>,
    pub random_cn_ip: bool,
    pub e_r: Option<Value>,
    pub domain: String,
    pub check_token: CheckToken,
    pub headers: IndexMap<String, String>,
    pub timeout: u64,
    /// 由 `server.js` 注入的客户端 IP（`req.ip`），用于 `X-Real-IP`
    pub ip: String,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            crypto: String::new(),
            cookie: None,
            ua: String::new(),
            proxy: None,
            real_ip: None,
            random_cn_ip: false,
            e_r: None,
            domain: String::new(),
            check_token: CheckToken::Off,
            headers: IndexMap::new(),
            timeout: 0,
            ip: String::new(),
        }
    }
}

impl Options {
    /// 只在测试里用：把上游域名指向本地 mock
    #[allow(dead_code)]
    pub fn with_domain(mut self, domain: &str) -> Self {
        self.domain = domain.to_string();
        self
    }
}

fn truthy_string(query: &Map<String, Value>, key: &str) -> Option<String> {
    match query.get(key)? {
        Value::String(text) if text.is_empty() => None,
        Value::String(text) => Some(text.clone()),
        Value::Bool(true) => Some("true".to_string()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

fn is_flag(query: &Map<String, Value>, key: &str, needle: &str) -> bool {
    match query.get(key) {
        Some(Value::String(text)) => text == needle,
        Some(Value::Bool(value)) => (*value && needle == "true") || (!*value && needle == "false"),
        _ => false,
    }
}

/// `process.env.ENABLE_RANDOM_CN_IP === 'true'`
fn random_cn_ip_enabled() -> bool {
    std::env::var("ENABLE_RANDOM_CN_IP")
        .map(|value| value == "true")
        .unwrap_or(false)
}

/// `createOption(query, crypto, checkToken)`
///
/// `check_token` 对应源码里的第三个参数，取值是 `'v2' / 'v3'` 字符串。
pub fn create_option(
    query: &Map<String, Value>,
    crypto: &str,
    check_token: Option<&str>,
) -> Options {
    let resolved_crypto = truthy_string(query, "crypto").unwrap_or_else(|| crypto.to_string());

    let random_cn_ip = if random_cn_ip_enabled() {
        !is_flag(query, "randomCNIP", "false")
    } else {
        is_flag(query, "randomCNIP", "true")
    };

    let check_token = match truthy_string(query, "checkToken")
        .or_else(|| check_token.map(str::to_string))
        .as_deref()
    {
        Some("v2") => CheckToken::V2,
        Some("v3") => CheckToken::V3,
        Some(_) => CheckToken::Other,
        None => CheckToken::Off,
    };

    let mut headers = IndexMap::new();
    if let Some(Value::Object(map)) = query.get("headers") {
        for (key, value) in map {
            headers.insert(key.clone(), crate::ncm::util::js_string(value));
        }
    }

    Options {
        crypto: resolved_crypto,
        cookie: query.get("cookie").cloned().or_else(|| {
            std::env::var("NETEASE_COOKIE")
                .ok()
                .filter(|value| !value.is_empty())
                .map(Value::String)
        }),
        ua: truthy_string(query, "ua").unwrap_or_default(),
        proxy: truthy_string(query, "proxy"),
        real_ip: truthy_string(query, "realIP"),
        random_cn_ip,
        e_r: query
            .get("e_r")
            .filter(|value| is_js_truthy(value))
            .cloned(),
        domain: truthy_string(query, "domain").unwrap_or_default(),
        check_token,
        headers,
        timeout: query
            .get("timeout")
            .and_then(Value::as_str)
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(0),
        ip: String::new(),
    }
}

fn is_js_truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(value) => *value,
        Value::Number(number) => number.as_f64().map(|value| value != 0.0).unwrap_or(false),
        Value::String(text) => !text.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn map(value: Value) -> Map<String, Value> {
        value.as_object().cloned().unwrap_or_default()
    }

    #[test]
    fn defaults_match_js() {
        let options = create_option(&map(json!({})), "", None);
        assert_eq!(options.crypto, "");
        assert!(options.cookie.is_none());
        assert_eq!(options.ua, "");
        assert!(!options.random_cn_ip);
        assert!(options.e_r.is_none());
        assert_eq!(options.domain, "");
        assert_eq!(options.check_token, CheckToken::Off);
        assert_eq!(options.timeout, 0);
    }

    #[test]
    fn crypto_prefers_query_then_default() {
        let query = map(json!({ "crypto": "xeapi" }));
        assert_eq!(create_option(&query, "weapi", None).crypto, "xeapi");
        assert_eq!(
            create_option(&map(json!({})), "weapi", None).crypto,
            "weapi"
        );
        assert_eq!(create_option(&map(json!({})), "", None).crypto, "");
    }

    #[test]
    fn check_token_reads_query_values() {
        assert_eq!(
            create_option(&map(json!({"checkToken": "v2"})), "", None).check_token,
            CheckToken::V2
        );
        assert_eq!(
            create_option(&map(json!({"checkToken": "v3"})), "", None).check_token,
            CheckToken::V3
        );
        assert_eq!(
            create_option(&map(json!({"checkToken": "yes"})), "", None).check_token,
            CheckToken::Other
        );
        assert_eq!(
            create_option(&map(json!({})), "", Some("v2")).check_token,
            CheckToken::V2
        );
    }

    #[test]
    fn random_cn_ip_follows_env_switch() {
        // 默认（未设置 ENABLE_RANDOM_CN_IP）时只有显式 "true" 才开启
        assert!(create_option(&map(json!({"randomCNIP": "true"})), "", None).random_cn_ip);
        assert!(!create_option(&map(json!({"randomCNIP": "false"})), "", None).random_cn_ip);
        assert!(!create_option(&map(json!({})), "", None).random_cn_ip);
    }

    #[test]
    fn e_r_only_kept_when_truthy() {
        assert!(create_option(&map(json!({"e_r": "false"})), "", None)
            .e_r
            .is_some());
        assert!(create_option(&map(json!({"e_r": ""})), "", None)
            .e_r
            .is_none());
    }

    #[test]
    fn timeout_parses_number_string() {
        assert_eq!(
            create_option(&map(json!({"timeout": "5000"})), "", None).timeout,
            5000
        );
    }
}
