//! `module/*.js` 的 Rust 版：每个接口只做一件事——把 query 变成 data。
//!
//! 只覆盖 `ncmModDef.ts` 里声明的接口（那份清单就是 Electron 版实际会调用的集合）。
//! 每个分支与源码一一对应，注释里标出源文件名；没有额外逻辑的接口不需要出现在这里，
//! 会走 `routes/mod.rs` 的声明式表（`key: query.field || 默认值`）。
//!
//! 约定：
//! - `undefined` 不写进 data（`JSON.stringify` 会丢掉它），所以用 `D::set`/`D::opt`；
//! - `query.x || 默认值` 用 `D::opt`，保留 JS 的 falsy 语义；
//! - `parseInt` 用 `parse_int`，`JSON.stringify(array)` 用 `json_string`。

use md5::{Digest, Md5};
use serde_json::{json, Map, Value};

use crate::ncm::config::resource_type_prefix;
use crate::ncm::request::Answer;
use crate::ncm::util::js_string;

pub type Data = Map<String, Value>;

/// 模块的产物：自定义 uri / data / 加密方式 / checkToken
#[derive(Debug)]
pub struct Module {
    pub uri: Option<String>,
    pub data: Data,
    pub crypto: Option<&'static str>,
    pub check_token: Option<&'static str>,
    /// 少数模块会改写 cookie（`song_url_v1` 的 vivid 分支要求 android 身份）
    pub cookie_patch: Option<Data>,
}

#[derive(Default)]
struct D(Data);

impl D {
    fn put(mut self, key: &str, value: Value) -> Self {
        self.0.insert(key.to_string(), value);
        self
    }

    /// `data.key = query.field`：undefined 时整条不写
    fn set(mut self, key: &str, value: Option<Value>) -> Self {
        if let Some(value) = value {
            if !value.is_null() {
                self.0.insert(key.to_string(), value);
            }
        }
        self
    }

    /// `key: query.field || 默认值`
    fn opt(mut self, key: &str, value: Option<Value>, default: Value) -> Self {
        let value = match value {
            Some(value) if js_truthy(&value) => value,
            _ => default,
        };
        self.0.insert(key.to_string(), value);
        self
    }

    fn done(self) -> Data {
        self.0
    }
}

fn js_truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(value) => *value,
        Value::Number(number) => number.as_f64().map(|v| v != 0.0).unwrap_or(false),
        Value::String(text) => !text.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

fn get(query: &Map<String, Value>, key: &str) -> Option<Value> {
    query.get(key).cloned()
}

fn text(query: &Map<String, Value>, key: &str) -> String {
    query.get(key).map(js_string).unwrap_or_default()
}

/// `parseInt(query.x || default)`
fn parse_int(query: &Map<String, Value>, key: &str, default: i64) -> Value {
    match query.get(key) {
        Some(Value::String(raw)) if !raw.is_empty() => {
            let digits: String = raw
                .trim()
                .chars()
                .take_while(|ch| ch.is_ascii_digit() || *ch == '-')
                .collect();
            match digits.parse::<i64>() {
                Ok(value) => json!(value),
                Err(_) => Value::Null,
            }
        }
        Some(Value::Number(number)) => json!(number),
        _ => json!(default),
    }
}

/// `query.t == 1`
fn is_one(query: &Map<String, Value>, key: &str) -> bool {
    match query.get(key) {
        Some(Value::String(text)) => text == "1",
        Some(Value::Number(number)) => number.as_f64() == Some(1.0),
        _ => false,
    }
}

fn json_string(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "null".into())
}

/// `query.type` → `resourceTypeMap[...]`，未知时保持 JS 的 `undefined` 拼接结果
fn resource_prefix(query: &Map<String, Value>) -> &'static str {
    let kind = query
        .get("type")
        .map(js_string)
        .unwrap_or_else(|| "0".to_string());
    resource_type_prefix(&kind).unwrap_or("undefined")
}

/// `prefix.replace(/_$/, '').split('_').pop()`
fn resource_type_id(kind: &str) -> String {
    let prefix = resource_type_prefix(kind).unwrap_or("");
    prefix
        .trim_end_matches('_')
        .rsplit('_')
        .next()
        .unwrap_or("")
        .to_string()
}

fn thread_id(query: &Map<String, Value>) -> String {
    format!("{}{}", resource_prefix(query), text(query, "id"))
}

fn md5_hex(text: &str) -> String {
    hex::encode(Md5::digest(text.as_bytes()))
}

/// 返回 `None` 表示"该接口没有额外逻辑，走声明式表"
pub fn build(identifier: &str, query: &Map<String, Value>) -> Option<Result<Module, Answer>> {
    let simple = |data: Data| {
        Ok(Module {
            uri: None,
            data,
            crypto: None,
            check_token: None,
            cookie_patch: None,
        })
    };
    let with_uri = |uri: String, data: Data| {
        Ok(Module {
            uri: Some(uri),
            data,
            crypto: None,
            check_token: None,
            cookie_patch: None,
        })
    };

    Some(match identifier {
        // module/album.js：`request(`/api/v1/album/${query.id}`, {})`
        "album" => simple(D::default().done()),

        // module/album_new.js
        "album_new" => simple(
            D::default()
                .opt("limit", get(query, "limit"), json!(30))
                .opt("offset", get(query, "offset"), json!(0))
                .put("total", json!(true))
                .opt("area", get(query, "area"), json!("ALL"))
                .done(),
        ),

        // module/album_sub.js：`query.t = query.t == 1 ? 'sub' : 'unsub'`
        "album_sub" => with_uri(
            format!(
                "/api/album/{}",
                if is_one(query, "t") { "sub" } else { "unsub" }
            ),
            D::default().set("id", get(query, "id")).done(),
        ),

        // module/album_sublist.js
        "album_sublist" => simple(
            D::default()
                .opt("limit", get(query, "limit"), json!(25))
                .opt("offset", get(query, "offset"), json!(0))
                .put("total", json!(true))
                .done(),
        ),

        // module/artist_album.js
        "artist_album" => simple(
            D::default()
                .opt("limit", get(query, "limit"), json!(30))
                .opt("offset", get(query, "offset"), json!(0))
                .put("total", json!(true))
                .done(),
        ),

        // module/artist_sub.js
        "artist_sub" => with_uri(
            format!(
                "/api/artist/{}",
                if is_one(query, "t") { "sub" } else { "unsub" }
            ),
            D::default()
                .set("artistId", get(query, "id"))
                .put("artistIds", json!(format!("[{}]", text(query, "id"))))
                .done(),
        ),

        // module/artist_sublist.js
        "artist_sublist" => simple(
            D::default()
                .opt("limit", get(query, "limit"), json!(25))
                .opt("offset", get(query, "offset"), json!(0))
                .put("total", json!(true))
                .done(),
        ),

        // module/captcha_sent.js
        "captcha_sent" => simple(
            D::default()
                .opt("ctcode", get(query, "ctcode"), json!("86"))
                .put("secrete", json!("music_middleuser_pclogin"))
                .set("cellphone", get(query, "phone"))
                .done(),
        ),

        // module/check_music.js
        "check_music" => simple(
            D::default()
                .put("ids", json!(format!("[{}]", text(query, "id"))))
                .put("br", parse_int(query, "br", 999_000))
                .done(),
        ),

        // module/cloudsearch.js
        "cloudsearch" => simple(
            D::default()
                .set("s", get(query, "keywords"))
                .opt("type", get(query, "type"), json!(1))
                .opt("limit", get(query, "limit"), json!(30))
                .opt("offset", get(query, "offset"), json!(0))
                .put("total", json!(true))
                .done(),
        ),

        // module/comment.js
        "comment" => {
            let raw_action = text(query, "t");
            let action = match raw_action.as_str() {
                "1" => "add",
                "0" => "delete",
                "2" => "reply",
                other => other,
            };
            let prefix = resource_prefix(query);
            let mut thread = format!("{prefix}{}", text(query, "id"));
            if prefix == "A_EV_2_" {
                thread = text(query, "threadId");
            }
            let mut data = D::default().put("threadId", json!(thread));
            match action {
                "add" => data = data.set("content", get(query, "content")),
                "delete" => data = data.set("commentId", get(query, "commentId")),
                "reply" => {
                    data = data
                        .set("commentId", get(query, "commentId"))
                        .set("content", get(query, "content"));
                }
                _ => {}
            }
            Ok(Module {
                uri: Some(format!("/api/resource/comments/{action}")),
                data: data.done(),
                crypto: Some("eapi"),
                check_token: Some("v2"),
                cookie_patch: None,
            })
        }

        // module/comment_floor.js
        "comment_floor" => simple(
            D::default()
                .set("parentCommentId", get(query, "parentCommentId"))
                .put("threadId", json!(thread_id(query)))
                .opt("time", get(query, "time"), json!(-1))
                .opt("limit", get(query, "limit"), json!(20))
                .done(),
        ),

        // module/comment_info_list.js
        "comment_info_list" => {
            let raw = {
                let ids = get(query, "ids")
                    .filter(|value| !value.is_null() && value.as_str() != Some(""));
                ids.or_else(|| get(query, "id")).unwrap_or(json!(""))
            };
            let ids: Vec<String> = js_string(&raw)
                .split(',')
                .map(|id| id.trim().to_string())
                .filter(|id| !id.is_empty())
                .collect();
            simple(
                D::default()
                    .put(
                        "resourceType",
                        json!(resource_type_id(
                            &query
                                .get("type")
                                .map(js_string)
                                .unwrap_or_else(|| "0".into())
                        )),
                    )
                    .put("resourceIds", json!(json_string(&json!(ids))))
                    .done(),
            )
        }

        // module/comment_like.js
        "comment_like" => {
            let action = if is_one(query, "t") { "like" } else { "unlike" };
            let prefix = resource_prefix(query);
            let thread = if prefix == "A_EV_2_" {
                text(query, "threadId")
            } else {
                format!("{prefix}{}", text(query, "id"))
            };
            with_uri(
                format!("/api/v1/comment/{action}"),
                D::default()
                    .put("threadId", json!(thread))
                    .set("commentId", get(query, "cid"))
                    .done(),
            )
        }

        // module/comment_new.js
        "comment_new" => {
            let mut sort_type = parse_int(query, "sortType", 99).as_i64().unwrap_or(99);
            if sort_type == 1 {
                sort_type = 99;
            }
            let page_size = parse_int(query, "pageSize", 20).as_i64().unwrap_or(20);
            let page_no = parse_int(query, "pageNo", 1).as_i64().unwrap_or(1);
            let cursor = match sort_type {
                99 => json!((page_no - 1) * page_size),
                2 => json!(format!("normalHot#{}", (page_no - 1) * page_size)),
                3 => get(query, "cursor").unwrap_or(json!("0")),
                _ => json!(""),
            };
            simple(
                D::default()
                    .put("threadId", json!(thread_id(query)))
                    .opt("pageNo", get(query, "pageNo"), json!(1))
                    .opt("showInner", get(query, "showInner"), json!(true))
                    .opt("pageSize", get(query, "pageSize"), json!(20))
                    .put("cursor", cursor)
                    .put("sortType", json!(sort_type))
                    .done(),
            )
        }

        // module/deviceinfo_center_upload.js
        "deviceinfo_center_upload" => {
            let name = get(query, "deviceName")
                .or_else(|| get(query, "name"))
                .map(|value| js_string(&value).trim().to_string())
                .unwrap_or_default();
            if name.is_empty() {
                Err(Answer::error(400, "缺少必要参数: deviceName"))
            } else {
                simple(D::default().put("deviceName", json!(name)).done())
            }
        }

        // module/fm_trash.js
        "fm_trash" => simple(
            D::default()
                .set("songId", get(query, "id"))
                .put("alg", json!("RT"))
                .opt("time", get(query, "time"), json!(25))
                .done(),
        ),

        // module/hug_comment.js
        "hug_comment" => {
            let prefix = {
                let kind = get(query, "type")
                    .map(|value| js_string(&value))
                    .unwrap_or_else(|| "0".into());
                resource_type_prefix(&kind).unwrap_or("undefined")
            };
            simple(
                D::default()
                    .set("targetUserId", get(query, "uid"))
                    .set("commentId", get(query, "cid"))
                    .put("threadId", json!(format!("{prefix}{}", text(query, "sid"))))
                    .done(),
            )
        }

        // module/like.js：`query.like = query.like == 'false' ? false : true`
        "like" => simple(
            D::default()
                .put("alg", json!("itembased"))
                .set("trackId", get(query, "id"))
                .put("like", json!(text(query, "like") != "false"))
                .put("time", json!("3"))
                .done(),
        ),

        // module/login.js
        "login" => {
            let password = get(query, "md5_password")
                .filter(|value| !value.is_null())
                .map(|value| js_string(&value))
                .unwrap_or_else(|| md5_hex(&text(query, "password")));
            simple(
                D::default()
                    .put("type", json!("0"))
                    .put("https", json!("true"))
                    .set("username", get(query, "email"))
                    .put("password", json!(password))
                    .put("rememberLogin", json!("true"))
                    .done(),
            )
        }

        // module/login_cellphone.js
        "login_cellphone" => {
            let captcha = get(query, "captcha").filter(js_truthy);
            let password = get(query, "md5_password")
                .filter(|value| !value.is_null())
                .map(|value| js_string(&value))
                .unwrap_or_else(|| md5_hex(&text(query, "password")));
            let mut data = D::default()
                .put("type", json!("1"))
                .put("https", json!("true"))
                .set("phone", get(query, "phone"))
                .opt("countrycode", get(query, "countrycode"), json!("86"));
            data = match &captcha {
                Some(value) => data.put("captcha", value.clone()),
                None => data.put("password", json!(password)),
            };
            simple(
                data.put("remember", json!("true"))
                    .opt("secureCaptcha", get(query, "sca"), json!(""))
                    .done(),
            )
        }

        // module/login_qr_key.js
        "login_qr_key" => simple(D::default().put("type", json!(3)).done()),

        // module/login_qr_check.js
        "login_qr_check" => simple(
            D::default()
                .set("key", get(query, "key"))
                .put("type", json!(3))
                .done(),
        ),

        // module/lyric_new.js
        "lyric_new" => simple(
            D::default()
                .set("id", get(query, "id"))
                .put("cp", json!(false))
                .put("tv", json!(0))
                .put("lv", json!(0))
                .put("rv", json!(0))
                .put("kv", json!(0))
                .put("yv", json!(0))
                .put("ytv", json!(0))
                .put("yrv", json!(0))
                .done(),
        ),

        // module/mv_sub.js
        "mv_sub" => with_uri(
            format!(
                "/api/mv/{}",
                if is_one(query, "t") { "sub" } else { "unsub" }
            ),
            D::default()
                .set("mvId", get(query, "mvid"))
                .put("mvIds", json!(format!("[\"{}\"]", text(query, "mvid"))))
                .done(),
        ),

        // module/mv_sublist.js
        "mv_sublist" => simple(
            D::default()
                .opt("limit", get(query, "limit"), json!(25))
                .opt("offset", get(query, "offset"), json!(0))
                .put("total", json!(true))
                .done(),
        ),

        // module/personalized.js
        "personalized" => simple(
            D::default()
                .opt("limit", get(query, "limit"), json!(30))
                .put("total", json!(true))
                .put("n", json!(1000))
                .done(),
        ),

        // module/playlist_cover_update.js：token alloc → NOS 上传 → 更新封面，
        // 属于另一套分片上传链路（plugins/upload），本阶段不做
        "playlist_cover_update" => Err(Answer::error(
            501,
            "歌单封面上传需要 NOS 分片上传，暂未实现",
        )),

        // module/playlist_delete.js
        "playlist_delete" => simple(
            D::default()
                .put("ids", json!(format!("[{}]", text(query, "id"))))
                .done(),
        ),

        // module/playlist_detail.js
        "playlist_detail" => simple(
            D::default()
                .set("id", get(query, "id"))
                .put("n", json!(100_000))
                .opt("s", get(query, "s"), json!(8))
                .done(),
        ),

        // module/playlist_detail_rcmd_get.js
        "playlist_detail_rcmd_get" => simple(
            D::default()
                .put("scene", json!("playlist_head"))
                .set("playlistId", get(query, "id"))
                .put("newStyle", json!("true"))
                .done(),
        ),

        // module/playlist_privacy.js
        "playlist_privacy" => simple(
            D::default()
                .set("id", get(query, "id"))
                .put("privacy", json!(0))
                .done(),
        ),

        // module/playlist_subscribe.js
        "playlist_subscribe" => Ok(Module {
            uri: Some(format!(
                "/api/playlist/{}",
                if is_one(query, "t") {
                    "subscribe"
                } else {
                    "unsubscribe"
                }
            )),
            data: D::default().set("id", get(query, "id")).done(),
            crypto: Some("eapi"),
            check_token: Some("v2"),
            cookie_patch: None,
        }),

        // module/playlist_tracks.js
        "playlist_tracks" => {
            let tracks: Vec<String> = text(query, "tracks")
                .split(',')
                .map(|item| item.to_string())
                .collect();
            simple(
                D::default()
                    .set("op", get(query, "op"))
                    .set("pid", get(query, "pid"))
                    .put("trackIds", json!(json_string(&json!(tracks))))
                    .put("imme", json!("true"))
                    .done(),
            )
        }

        // module/playlist_update.js：一次 /api/batch 提交三个子请求
        "playlist_update" => {
            let id = text(query, "id");
            simple(
                D::default()
                    .put(
                        "/api/playlist/desc/update",
                        json!(format!(
                            "{{\"id\":{id},\"desc\":\"{}\"}}",
                            text(query, "desc")
                        )),
                    )
                    .put(
                        "/api/playlist/tags/update",
                        json!(format!(
                            "{{\"id\":{id},\"tags\":\"{}\"}}",
                            text(query, "tags")
                        )),
                    )
                    .put(
                        "/api/playlist/update/name",
                        json!(format!(
                            "{{\"id\":{id},\"name\":\"{}\"}}",
                            text(query, "name")
                        )),
                    )
                    .done(),
            )
        }

        // module/playmode_intelligence_list.js
        "playmode_intelligence_list" => simple(
            D::default()
                .set("songId", get(query, "id"))
                .put("type", json!("fromPlayOne"))
                .set("playlistId", get(query, "pid"))
                .opt(
                    "startMusicId",
                    get(query, "sid").or_else(|| get(query, "id")),
                    json!(""),
                )
                .opt("count", get(query, "count"), json!(1))
                .done(),
        ),

        // module/recommend_songs_dislike.js
        "recommend_songs_dislike" => simple(
            D::default()
                .set("resId", get(query, "id"))
                .put("resType", json!(4))
                .put("sceneType", json!(1))
                .done(),
        ),

        // module/search.js：type=2000 走语音搜索分支
        "search" => {
            if text(query, "type") == "2000" {
                with_uri(
                    "/api/search/voice/get".to_string(),
                    D::default()
                        .set("keyword", get(query, "keywords"))
                        .put("scene", json!("normal"))
                        .opt("limit", get(query, "limit"), json!(30))
                        .opt("offset", get(query, "offset"), json!(0))
                        .done(),
                )
            } else {
                simple(
                    D::default()
                        .set("s", get(query, "keywords"))
                        .opt("type", get(query, "type"), json!(1))
                        .opt("limit", get(query, "limit"), json!(30))
                        .opt("offset", get(query, "offset"), json!(0))
                        .done(),
                )
            }
        }

        // module/search_hot.js
        "search_hot" => simple(D::default().put("type", json!(1111)).done()),

        // module/search_suggest.js
        "search_suggest" => {
            let kind = if text(query, "type") == "mobile" {
                "keyword"
            } else {
                "web"
            };
            with_uri(
                format!("/api/search/suggest/{kind}"),
                D::default()
                    .opt("s", get(query, "keywords"), json!(""))
                    .done(),
            )
        }

        // module/relay_play_state_submit.js
        "relay_play_state_submit" => {
            let id = text(query, "id");
            if id.is_empty() {
                Err(Answer::error(400, "缺少必要参数：id"))
            } else {
                let session = {
                    let given = text(query, "sessionId");
                    if given.is_empty() {
                        const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                        (0..12)
                            .map(|_| CHARS[rand::random_range(0..CHARS.len())] as char)
                            .collect::<String>()
                    } else {
                        given
                    }
                };
                let kind = {
                    let kind = text(query, "type");
                    if kind.is_empty() {
                        "song".to_string()
                    } else {
                        kind
                    }
                };
                let mode = {
                    let mode = text(query, "playMode");
                    if mode.is_empty() {
                        "list_loop".to_string()
                    } else {
                        mode
                    }
                };
                let play_state = json!({
                    "resource": { "id": id, "type": kind },
                    "progress": parse_int(query, "progress", 0),
                    "sessionId": session,
                    "playMode": mode,
                });
                simple(
                    D::default()
                        .put("playStateSubmitReq", json!(json_string(&play_state)))
                        .done(),
                )
            }
        }

        // module/simi_playlist.js / simi_song.js
        "simi_playlist" | "simi_song" => simple(
            D::default()
                .set("songid", get(query, "id"))
                .opt("limit", get(query, "limit"), json!(50))
                .opt("offset", get(query, "offset"), json!(0))
                .done(),
        ),

        // module/song_chorus.js
        "song_chorus" => simple(
            D::default()
                .put("ids", json!(json_string(&json!([text(query, "id")]))))
                .done(),
        ),

        // module/song_order_update.js
        "song_order_update" => simple(
            D::default()
                .set("pid", get(query, "pid"))
                .set("trackIds", get(query, "ids"))
                .put("op", json!("update"))
                .done(),
        ),

        // module/song_url.js
        "song_url" => {
            let ids: Vec<String> = text(query, "id")
                .split(',')
                .map(|item| item.to_string())
                .collect();
            simple(
                D::default()
                    .put("ids", json!(json_string(&json!(ids))))
                    .put("br", parse_int(query, "br", 999_000))
                    .done(),
            )
        }

        // module/song_url_v1.js
        "song_url_v1" => {
            let level = text(query, "level");
            let mut data = D::default()
                .put("ids", json!(format!("[{}]", text(query, "id"))))
                .set("level", get(query, "level"))
                .put("encodeType", json!("flac"));
            if level == "sky" {
                data = data.opt("immerseType", get(query, "immerseType"), json!("c51"));
            }
            let cookie_patch = if level == "vivid" {
                data = data.put("encodeType", json!("mp3"));
                Some(
                    D::default()
                        .put("os", json!("android"))
                        .put("appver", json!("9.5.61"))
                        .done(),
                )
            } else {
                None
            };
            Ok(Module {
                uri: None,
                data: data.done(),
                crypto: Some("xeapi"),
                check_token: None,
                cookie_patch,
            })
        }

        // module/top_playlist.js
        "top_playlist" => simple(
            D::default()
                .opt("cat", get(query, "cat"), json!("全部"))
                .opt("order", get(query, "order"), json!("hot"))
                .opt("limit", get(query, "limit"), json!(50))
                .opt("offset", get(query, "offset"), json!(0))
                .put("total", json!(true))
                .done(),
        ),

        // module/top_playlist_highquality.js
        "top_playlist_highquality" => simple(
            D::default()
                .opt("cat", get(query, "cat"), json!("全部"))
                .opt("limit", get(query, "limit"), json!(50))
                .opt("lasttime", get(query, "before"), json!(0))
                .put("total", json!(true))
                .done(),
        ),

        // module/top_song.js
        "top_song" => simple(
            D::default()
                .opt("areaId", get(query, "type"), json!(0))
                .put("total", json!(true))
                .done(),
        ),

        // module/toplist_artist.js
        "toplist_artist" => simple(
            D::default()
                .opt("type", get(query, "type"), json!(1))
                .put("limit", json!(100))
                .put("offset", json!(0))
                .put("total", json!(true))
                .done(),
        ),

        // module/user_detail.js：`request(`/api/v1/user/detail/${query.uid}`, {})`
        "user_detail" => simple(D::default().done()),

        // module/user_playlist.js
        "user_playlist" => simple(
            D::default()
                .set("uid", get(query, "uid"))
                .opt("limit", get(query, "limit"), json!(30))
                .opt("offset", get(query, "offset"), json!(0))
                .put("includeVideo", json!(true))
                .done(),
        ),

        _ => return None,
    })
}

/// 少数模块会把响应再加工一次（`login` 回填 cookie 字符串、`song_url` 按入参排序等）
pub fn postprocess(identifier: &str, query: &Map<String, Value>, answer: &mut Answer) {
    match identifier {
        "login" | "login_cellphone" => {
            let login_ok = answer.body.get("code").and_then(Value::as_u64) == Some(200);
            if login_ok {
                rename_avatar(&mut answer.body);
                let joined = answer.cookie.join(";");
                if let Some(object) = answer.body.as_object_mut() {
                    object.insert("cookie".into(), json!(joined));
                }
            } else if identifier == "login"
                && answer.body.get("code").and_then(Value::as_u64) == Some(502)
            {
                answer.body = json!({
                    "msg": "账号或密码错误",
                    "code": 502,
                    "message": "账号或密码错误",
                });
            }
        }
        // module/login_qr_key.js：`body: { data: result.body, code: 200 }`
        // 上游 returns `{code:200, unikey}`，但 ncm 再包一层 → 前端读 `data.unikey`
        "login_qr_key" => {
            answer.body = json!({ "data": answer.body, "code": 200 });
        }
        "login_qr_check" => {
            let joined = answer.cookie.join(";");
            if let Some(object) = answer.body.as_object_mut() {
                object.insert("cookie".into(), json!(joined));
            }
        }
        "user_detail" | "top_playlist" => rename_avatar(&mut answer.body),
        // module/song_url.js：`result.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))`
        "song_url" => {
            let order: Vec<String> = text(query, "id")
                .split(',')
                .map(|item| item.trim().to_string())
                .collect();
            if let Some(items) = answer.body.get_mut("data").and_then(Value::as_array_mut) {
                items.sort_by_key(|item| {
                    let id = item.get("id").map(js_string).unwrap_or_default();
                    order
                        .iter()
                        .position(|value| *value == id)
                        .unwrap_or(usize::MAX)
                });
            }
        }
        "check_music" => {
            let playable = answer.body.get("code").and_then(Value::as_u64) == Some(200)
                && answer
                    .body
                    .get("data")
                    .and_then(|data| data.get(0))
                    .and_then(|song| song.get("code"))
                    .and_then(Value::as_u64)
                    == Some(200);
            answer.body = if playable {
                json!({ "code": 200, "success": true, "message": "ok" })
            } else {
                json!({ "code": 200, "success": false, "message": "亲爱的,暂无版权" })
            };
        }
        _ => {}
    }
}

/// 上游把 `avatarImgId_str` 拼错成下划线版本，JS 版统一改名
fn rename_avatar(value: &mut Value) {
    match value {
        Value::Object(map) => {
            if let Some(item) = map.shift_remove("avatarImgId_str") {
                map.insert("avatarImgIdStr".into(), item);
            }
            for (_, item) in map.iter_mut() {
                rename_avatar(item);
            }
        }
        Value::Array(items) => {
            for item in items {
                rename_avatar(item);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn query(value: Value) -> Map<String, Value> {
        value.as_object().cloned().unwrap_or_default()
    }

    #[test]
    fn search_switches_to_voice_branch() {
        let module = build("search", &query(json!({"keywords": "x", "type": "2000"})))
            .unwrap()
            .unwrap();
        assert_eq!(module.uri.as_deref(), Some("/api/search/voice/get"));
        assert_eq!(module.data["keyword"], json!("x"));
    }

    #[test]
    fn album_sub_maps_t_to_action() {
        let module = build("album_sub", &query(json!({"id": "9", "t": "1"})))
            .unwrap()
            .unwrap();
        assert_eq!(module.uri.as_deref(), Some("/api/album/sub"));
        assert_eq!(module.data["id"], json!("9"));
    }

    #[test]
    fn comment_builds_thread_id_from_resource_type() {
        let module = build(
            "comment",
            &query(json!({"id": "9", "t": "1", "type": "1", "content": "hi"})),
        )
        .unwrap()
        .unwrap();
        assert_eq!(module.uri.as_deref(), Some("/api/resource/comments/add"));
        assert_eq!(module.data["threadId"], json!("R_MV_5_9"));
        assert_eq!(module.data["content"], json!("hi"));
        assert_eq!(module.check_token, Some("v2"));
    }

    #[test]
    fn comment_reply_keeps_both_fields() {
        let module = build(
            "comment",
            &query(json!({"id": "9", "t": "2", "type": "0", "commentId": "5", "content": "hi"})),
        )
        .unwrap()
        .unwrap();
        assert_eq!(module.data["threadId"], json!("R_SO_4_9"));
        assert_eq!(module.data["commentId"], json!("5"));
        assert_eq!(module.data["content"], json!("hi"));
    }

    #[test]
    fn deviceinfo_requires_name() {
        let error = build("deviceinfo_center_upload", &query(json!({})))
            .unwrap()
            .unwrap_err();
        assert_eq!(error.status, 400);
    }

    #[test]
    fn login_cellphone_prefers_captcha_over_password() {
        let with_captcha = build(
            "login_cellphone",
            &query(json!({"phone": "1", "captcha": "1234", "password": "x"})),
        )
        .unwrap()
        .unwrap();
        assert_eq!(with_captcha.data["captcha"], json!("1234"));
        assert!(!with_captcha.data.contains_key("password"));

        let with_password = build(
            "login_cellphone",
            &query(json!({"phone": "1", "password": "x"})),
        )
        .unwrap()
        .unwrap();
        assert_eq!(with_password.data["password"], json!(md5_hex("x")));
    }

    #[test]
    fn playlist_tracks_stringifies_ids() {
        let module = build(
            "playlist_tracks",
            &query(json!({"tracks": "1,2", "op": "add", "pid": "9"})),
        )
        .unwrap()
        .unwrap();
        assert_eq!(module.data["trackIds"], json!("[\"1\",\"2\"]"));
    }

    #[test]
    fn check_music_parses_br() {
        let module = build("check_music", &query(json!({"id": "9", "br": "128000"})))
            .unwrap()
            .unwrap();
        assert_eq!(module.data["ids"], json!("[9]"));
        assert_eq!(module.data["br"], json!(128000));
        let default = build("check_music", &query(json!({"id": "9"})))
            .unwrap()
            .unwrap();
        assert_eq!(default.data["br"], json!(999000));
    }
}
