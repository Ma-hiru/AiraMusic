//! 路由表与模块参数构造。
//!
//! 路由清单来自 Electron 侧的 `packages/app/src/services/ncm/ncmModDef.ts`——
//! 那份文件决定了"哪些接口被试听环境真正用到"，不在其中的接口没有必要移植。
//!
//! 两条来源：
//! 1. `modules.rs`：有额外逻辑的接口，一个接口几行，与 `module/*.js` 一一对应；
//! 2. 声明式表（`routes.generated.rs`）：`key: query.field || 默认值` 这种形态，
//!    由脚本从模块源码抽取，等价于源码里的对象字面量。
//!
//! 真正的请求 / 加密 / 解密都在 `request.rs`，本模块只负责"把 query 变成 data"。

mod modules;

pub use modules::postprocess;

use serde_json::{Map, Value};

use crate::ncm::option::{create_option, Options};
use crate::ncm::request::Answer;
use crate::ncm::util::js_string;

#[allow(dead_code)]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Crypto {
    Weapi,
    Eapi,
    LinuxApi,
    Xeapi,
}

impl Crypto {
    pub fn as_str(self) -> &'static str {
        match self {
            Crypto::Weapi => "weapi",
            Crypto::Eapi => "eapi",
            Crypto::LinuxApi => "linuxapi",
            Crypto::Xeapi => "xeapi",
        }
    }
}

/// 一条路由：对外暴露的 path + 上游 uri + 加密方式 + 路径参数名
pub struct Route {
    pub identifier: &'static str,
    pub route: &'static str,
    pub uri: &'static str,
    pub crypto: Crypto,
    pub path: &'static [&'static str],
}

include!("routes.generated.rs");

/// 生成器覆盖不了的少量路由（动态 uri / 特殊参数），手工登记。
pub const EXTRA: &[Route] = &[Route {
    identifier: "playlist_subscribe",
    route: "/playlist/subscribe",
    uri: "/api/playlist/{action}",
    crypto: Crypto::Eapi,
    path: &[],
}];

pub fn all() -> Vec<&'static Route> {
    GENERATED.iter().chain(EXTRA.iter()).collect()
}

/// 与 `server.js` 一致：这些是宿主控制项，不会被模块写进 data
static CONTROL_PARAMS: &[&str] = &[
    "cookie",
    "ua",
    "crypto",
    "proxy",
    "realIP",
    "realIp",
    "randomCNIP",
    "e_r",
    "domain",
    "checkToken",
    "timeout",
    "noCookie",
    "headers",
    "path",
    "check_token",
];

/// 构造一次上游调用所需的 `(uri, data, options)`
pub fn build(
    route: &Route,
    query: &Map<String, Value>,
) -> Result<(String, Map<String, Value>, Options), Answer> {
    let mut crypto = route.crypto.as_str().to_string();
    let mut check_token: Option<&'static str> = None;
    let mut cookie_patch: Option<Map<String, Value>> = None;

    let (uri, data) = match modules::build(route.identifier, query) {
        Some(Ok(module)) => {
            if let Some(value) = module.crypto {
                crypto = value.to_string();
            }
            check_token = module.check_token;
            cookie_patch = module.cookie_patch;
            (
                module.uri.unwrap_or_else(|| resolve_uri(route, query)),
                module.data,
            )
        }
        Some(Err(answer)) => return Err(answer),
        None => (
            resolve_uri(route, query),
            declared_data(route.identifier, query),
        ),
    };

    let mut options = create_option(query, &crypto, check_token);
    if let Some(patch) = cookie_patch {
        let mut cookie = match options.cookie.take() {
            Some(Value::Object(map)) => map,
            _ => Map::new(),
        };
        for (key, value) in patch {
            cookie.insert(key, value);
        }
        options.cookie = Some(Value::Object(cookie));
    }
    Ok((uri, data, options))
}

/// `request(\`/api/xxx/${query.id}\`)` 的路径参数替换
fn resolve_uri(route: &Route, query: &Map<String, Value>) -> String {
    let mut uri = route.uri.to_string();
    for name in route.path {
        let value = query.get(*name).map(js_string).unwrap_or_default();
        uri = uri.replace(&format!("{{{name}}}"), &value);
    }
    // playlist_subscribe：`?t=1` → subscribe，其余 → unsubscribe
    if uri.contains("{action}") {
        let action = if query
            .get("t")
            .map(|value| js_string(value) == "1")
            .unwrap_or(false)
        {
            "subscribe"
        } else {
            "unsubscribe"
        };
        uri = uri.replace("{action}", action);
    }
    uri
}

/// 声明式表：query 透传（去掉宿主控制项）+ 生成器抽出的改名/默认值 + 少量手写补丁
fn declared_data(identifier: &str, query: &Map<String, Value>) -> Map<String, Value> {
    let mut data: Map<String, Value> = query
        .iter()
        .filter(|(key, _)| !CONTROL_PARAMS.contains(&key.as_str()))
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect();
    apply_spec(identifier, &mut data);
    patch(identifier, query, &mut data);
    data
}

/// 仍有真逻辑、但不在 `modules.rs` 里的少数模块（拼串 / 结构化参数 / 条件字段）
fn patch(identifier: &str, query: &Map<String, Value>, data: &mut Map<String, Value>) {
    match identifier {
        // module/song_detail.js：`c: '[{"id":1},{"id":2}]'`
        "song_detail" => {
            let ids = query
                .get("ids")
                .or_else(|| query.get("id"))
                .map(js_string)
                .unwrap_or_default();
            let payload = ids
                .split(',')
                .filter(|item| !item.trim().is_empty())
                .map(|item| format!("{{\"id\":{}}}", item.trim()))
                .collect::<Vec<_>>()
                .join(",");
            data.clear();
            data.insert("c".into(), Value::String(format!("[{payload}]")));
        }
        // module/banner.js：type → clientType
        "banner" => {
            let client = match query.get("type").map(js_string).as_deref() {
                Some("1") => "android",
                Some("2") => "iphone",
                Some("3") => "ipad",
                _ => "pc",
            };
            data.clear();
            data.insert("clientType".into(), Value::String(client.into()));
        }
        _ => {}
    }
}

/// 纯本地接口：`login_qr_create` 在 JS 版里用 `qrcode` 库生成 data URL，
/// 渲染层自己会用 qrcode 渲染，所以这里只回 `qrurl`。
pub fn local(path: &str, query: &Map<String, Value>) -> Option<Value> {
    match path {
        "/login/qr/create" => {
            let key = query.get("key").map(js_string).unwrap_or_default();
            Some(serde_json::json!({
                "code": 200,
                "data": {
                    "qrurl": format!("https://music.163.com/login?codekey={key}"),
                    "qrimg": ""
                }
            }))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn route(identifier: &str) -> &'static Route {
        all()
            .into_iter()
            .find(|route| route.identifier == identifier)
            .unwrap_or_else(|| panic!("缺少路由 {identifier}"))
    }

    fn query(value: Value) -> Map<String, Value> {
        value.as_object().cloned().unwrap_or_default()
    }

    #[test]
    fn local_qr_create_builds_url() {
        let body = local("/login/qr/create", &query(json!({"key": "abc"}))).unwrap();
        assert_eq!(
            body["data"]["qrurl"],
            json!("https://music.163.com/login?codekey=abc")
        );
        assert!(local("/album", &query(json!({}))).is_none());
    }

    #[test]
    fn song_detail_builds_c_payload() {
        let (uri, data, _) = build(route("song_detail"), &query(json!({"ids": "1, 2"}))).unwrap();
        assert_eq!(uri, "/api/v3/song/detail");
        assert_eq!(data["c"], json!("[{\"id\":1},{\"id\":2}]"));
    }

    #[test]
    fn banner_maps_type_to_client_type() {
        for (kind, client) in [
            ("0", "pc"),
            ("1", "android"),
            ("2", "iphone"),
            ("3", "ipad"),
        ] {
            let (uri, data, _) = build(route("banner"), &query(json!({"type": kind}))).unwrap();
            assert_eq!(uri, "/api/v2/banner/get");
            assert_eq!(data["clientType"], json!(client));
        }
    }

    #[test]
    fn playlist_subscribe_switches_action() {
        let (uri, data, options) = build(
            route("playlist_subscribe"),
            &query(json!({"id": "9", "t": "1"})),
        )
        .unwrap();
        assert_eq!(uri, "/api/playlist/subscribe");
        assert_eq!(data["id"], json!("9"));
        assert!(!data.contains_key("t"));
        assert_eq!(options.check_token, crate::ncm::option::CheckToken::V2);

        let (uri, _, _) = build(
            route("playlist_subscribe"),
            &query(json!({"id": "9", "t": "0"})),
        )
        .unwrap();
        assert_eq!(uri, "/api/playlist/unsubscribe");
    }

    #[test]
    fn declared_table_covers_plain_modules() {
        // mv/detail 没有手写分支，走「透传 + spec」
        let (uri, data, options) =
            build(route("mv_detail"), &query(json!({"mvid": "55"}))).unwrap();
        assert_eq!(uri, "/api/v1/mv/detail");
        // module/mv_detail.js：`id: query.mvid`
        assert_eq!(data["id"], json!("55"));
        assert_eq!(options.crypto, "weapi");
    }

    #[test]
    fn control_params_are_not_forwarded() {
        let (_, data, _) = build(
            route("mv_detail"),
            &query(json!({"mvid": "55", "cookie": {"a": "1"}, "domain": "x", "e_r": "true"})),
        )
        .unwrap();
        assert!(!data.contains_key("cookie"));
        assert!(!data.contains_key("domain"));
        assert!(!data.contains_key("e_r"));
    }

    #[test]
    fn missing_path_param_becomes_empty() {
        let (uri, _, _) = build(route("album"), &query(json!({}))).unwrap();
        assert_eq!(uri, "/api/v1/album/");
    }

    #[test]
    fn cookie_patch_is_merged_for_vivid() {
        let (_, data, options) = build(
            route("song_url_v1"),
            &query(json!({"id": "1", "level": "vivid"})),
        )
        .unwrap();
        assert_eq!(data["encodeType"], json!("mp3"));
        let cookie = options.cookie.unwrap();
        assert_eq!(cookie["os"], json!("android"));
        assert_eq!(cookie["appver"], json!("9.5.61"));
    }

    #[test]
    fn sky_level_adds_immerse_type() {
        let (_, data, _) = build(
            route("song_url_v1"),
            &query(json!({"id": "1", "level": "sky"})),
        )
        .unwrap();
        assert_eq!(data["immerseType"], json!("c51"));
    }
}
