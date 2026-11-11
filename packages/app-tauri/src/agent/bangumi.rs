//! `lib/bangumi.ts` + `lib/bangumi-format.ts` 的 Rust 版。
//!
//! 只做匿名读取：搜索（条目/角色/人物）与三类详情，按 `detail` 预算裁剪输出。
//! 接口要求带 User-Agent，否则 403。

use std::collections::BTreeSet;
use std::sync::OnceLock;
use std::time::Duration;

use serde_json::{json, Map, Value};

use crate::agent::bridge::ToolError;

const API_ORIGIN: &str = "https://api.bgm.tv";
const SITE_ORIGIN: &str = "https://bgm.tv";
const USER_AGENT: &str = "AiraMusic/1.4.0 (+https://github.com/mahiru/AiraMusic)";

const SEARCH_PAGE_MAX: usize = 20;
const SEARCH_TOTAL_MAX: u64 = 1_000;
const SEARCH_OFFSET_MAX: u64 = SEARCH_TOTAL_MAX - 1;
const CHINESE_NAME_MAX: usize = 60;
const META_TAG_LIMIT: usize = 8;
const ACTOR_LIMIT: usize = 4;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Detail {
    Compact,
    Standard,
    Detailed,
}

impl Detail {
    pub fn parse(value: Option<&str>) -> Self {
        match value {
            Some("compact") => Detail::Compact,
            Some("detailed") => Detail::Detailed,
            _ => Detail::Standard,
        }
    }
}

struct Limits {
    items: usize,
    summary: usize,
    tags: usize,
    infobox_keys: usize,
    infobox_value: usize,
    related: usize,
}

fn search_limits(detail: Detail) -> Limits {
    match detail {
        Detail::Compact => Limits {
            items: SEARCH_PAGE_MAX,
            summary: 0,
            tags: 3,
            infobox_keys: 0,
            infobox_value: 0,
            related: 0,
        },
        Detail::Standard => Limits {
            items: SEARCH_PAGE_MAX,
            summary: 180,
            tags: 5,
            infobox_keys: 0,
            infobox_value: 0,
            related: 0,
        },
        Detail::Detailed => Limits {
            items: SEARCH_PAGE_MAX / 2,
            summary: 320,
            tags: 8,
            infobox_keys: 6,
            infobox_value: 100,
            related: 0,
        },
    }
}

fn detail_limits(detail: Detail) -> Limits {
    match detail {
        Detail::Compact => Limits {
            items: 0,
            summary: 240,
            tags: 6,
            infobox_keys: 10,
            infobox_value: 80,
            related: 6,
        },
        Detail::Standard => Limits {
            items: 0,
            summary: 800,
            tags: 10,
            infobox_keys: 18,
            infobox_value: 120,
            related: 12,
        },
        Detail::Detailed => Limits {
            items: 0,
            summary: 1_600,
            tags: 16,
            infobox_keys: 40,
            infobox_value: 180,
            related: 24,
        },
    }
}

fn subject_type_label(kind: u64) -> &'static str {
    match kind {
        1 => "书籍",
        2 => "动画",
        3 => "音乐",
        4 => "游戏",
        6 => "三次元",
        _ => "未知",
    }
}

fn character_type_label(kind: u64) -> &'static str {
    match kind {
        1 => "角色",
        2 => "机体",
        3 => "舰船",
        4 => "组织",
        _ => "未知",
    }
}

fn person_type_label(kind: u64) -> &'static str {
    match kind {
        1 => "个人",
        2 => "公司",
        3 => "组合",
        _ => "未知",
    }
}

fn career_label(value: &str) -> &str {
    match value {
        "actor" => "演员",
        "artist" => "艺术家",
        "illustrator" => "插画师",
        "mangaka" => "漫画家",
        "producer" => "制作人",
        "seiyu" => "声优",
        "writer" => "作家",
        other => other,
    }
}

const INFOBOX_PRIORITIES: &[&str] = &[
    "简体中文名",
    "中文名",
    "别名",
    "艺术家",
    "作曲",
    "编曲",
    "厂牌",
    "发售日期",
    "播放时长",
    "性别",
    "生日",
    "血型",
    "身高",
    "体重",
    "话数",
    "集数",
    "导演",
    "原作",
    "动画制作",
    "制作公司",
    "引用来源",
];

/// 测试用：把 API 域名指向本地 mock
static TEST_BASE: std::sync::OnceLock<String> = std::sync::OnceLock::new();

fn api_base() -> String {
    TEST_BASE
        .get()
        .cloned()
        .unwrap_or_else(|| API_ORIGIN.to_string())
}

#[cfg(test)]
fn set_base(base: &str) {
    let _ = TEST_BASE.set(base.to_string());
}

fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| crate::http::external_client(Duration::from_secs(6)))
}

/// `clampText`：压成单行后按字符数截断（省略号计入长度）
fn clamp_text(value: Option<&str>, limit: usize) -> Option<String> {
    let collapsed = value?.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.is_empty() || limit == 0 {
        return None;
    }
    if collapsed.chars().count() <= limit {
        return Some(collapsed);
    }
    let keep: String = collapsed.chars().take(limit.saturating_sub(1)).collect();
    Some(format!("{keep}…"))
}

fn pick_image(value: &Value) -> Option<String> {
    for key in ["large", "medium", "common", "small", "grid"] {
        if let Some(text) = value.get(key).and_then(Value::as_str) {
            if !text.is_empty() {
                return Some(text.to_string());
            }
        }
    }
    None
}

fn pick_strings(values: impl Iterator<Item = String>, limit: usize) -> Option<Vec<String>> {
    let mut seen = BTreeSet::new();
    let mut out = Vec::new();
    for value in values {
        if value.is_empty() || !seen.insert(value.clone()) {
            continue;
        }
        out.push(value);
        if out.len() >= limit {
            break;
        }
    }
    (!out.is_empty()).then_some(out)
}

fn pick_tags(value: &Value, limit: usize) -> Option<Vec<String>> {
    let items = value.as_array()?;
    pick_strings(
        items
            .iter()
            .filter_map(|item| item.get("name").and_then(Value::as_str).map(str::to_string)),
        limit,
    )
}

fn infobox_value_text(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Array(items)) => items
            .iter()
            .map(|item| {
                let key = item.get("k").and_then(Value::as_str).unwrap_or_default();
                let value = item.get("v").and_then(Value::as_str).unwrap_or_default();
                if key.is_empty() {
                    value.to_string()
                } else {
                    format!("{key}: {value}")
                }
            })
            .filter(|text| !text.is_empty())
            .collect::<Vec<_>>()
            .join("；"),
        _ => String::new(),
    }
}

fn pick_chinese_name(infobox: &Value) -> Option<String> {
    let items = infobox.as_array()?;
    for key in ["简体中文名", "中文名", "第二中文名"] {
        if let Some(item) = items
            .iter()
            .find(|item| item.get("key").and_then(Value::as_str) == Some(key))
        {
            if let Some(name) = clamp_text(
                Some(&infobox_value_text(item.get("value"))),
                CHINESE_NAME_MAX,
            ) {
                return Some(name);
            }
        }
    }
    None
}

fn pick_infobox(infobox: &Value, keys: usize, value_limit: usize) -> Option<Value> {
    if keys == 0 || value_limit == 0 {
        return None;
    }
    let items = infobox.as_array()?;
    let mut entries: Vec<(usize, String, String)> = Vec::new();
    for (index, item) in items.iter().enumerate() {
        let Some(key) = item.get("key").and_then(Value::as_str) else {
            continue;
        };
        let raw = infobox_value_text(item.get("value"));
        let Some(value) = clamp_text(Some(&raw), value_limit) else {
            continue;
        };
        let priority = INFOBOX_PRIORITIES
            .iter()
            .position(|item| *item == key)
            .unwrap_or(INFOBOX_PRIORITIES.len());
        entries.push((priority * 1000 + index, key.to_string(), value));
    }
    if entries.is_empty() {
        return None;
    }
    entries.sort_by_key(|entry| entry.0);
    let mut map = Map::new();
    for (_, key, value) in entries.into_iter().take(keys) {
        map.insert(key, json!(value));
    }
    Some(Value::Object(map))
}

fn format_birthday(value: &Value) -> Option<String> {
    let month = value.get("birth_mon").and_then(Value::as_u64)?;
    let day = value.get("birth_day").and_then(Value::as_u64)?;
    let year = value.get("birth_year").and_then(Value::as_u64);
    Some(match year {
        Some(year) => format!("{year}-{month:02}-{day:02}"),
        None => format!("{month:02}-{day:02}"),
    })
}

fn pick_numbers(pairs: &[(&str, Option<u64>)]) -> Option<Value> {
    let mut map = Map::new();
    for (key, value) in pairs {
        if let Some(value) = value {
            map.insert((*key).to_string(), json!(value));
        }
    }
    (!map.is_empty()).then_some(Value::Object(map))
}

fn site_url(path: &str, id: u64) -> String {
    format!("{SITE_ORIGIN}/{path}/{id}")
}

async fn request(
    path: &str,
    method: &str,
    query: &[(&str, String)],
    body: Option<&Value>,
) -> Result<Value, ToolError> {
    let mut url = format!("{}{path}", api_base());
    if !query.is_empty() {
        let mut serializer = url::form_urlencoded::Serializer::new(String::new());
        for (key, value) in query {
            serializer.append_pair(key, value);
        }
        url = format!("{url}?{}", serializer.finish());
    }

    let mut builder = client()
        .request(
            if method == "POST" {
                reqwest::Method::POST
            } else {
                reqwest::Method::GET
            },
            &url,
        )
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .header(reqwest::header::ACCEPT, "application/json");
    if let Some(body) = body {
        builder = builder.json(body);
    }

    let response = builder
        .send()
        .await
        .map_err(|error| ToolError::new("network", format!("Bangumi 请求失败: {error}")))?;
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    if status.as_u16() == 404 {
        return Err(ToolError::new("not_found", "Bangumi 没有这条记录"));
    }
    if !status.is_success() {
        let description = serde_json::from_str::<Value>(&text)
            .ok()
            .and_then(|value| {
                value
                    .get("description")
                    .or_else(|| value.get("title"))
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
            .unwrap_or_else(|| format!("HTTP {}", status.as_u16()));
        return Err(ToolError::new("network", description));
    }
    serde_json::from_str(&text)
        .map_err(|error| ToolError::new("network", format!("Bangumi 响应不是 JSON: {error}")))
}

fn subject_brief(value: &Value, limits: &Limits) -> Option<Value> {
    let id = value
        .get("id")
        .and_then(Value::as_u64)
        .filter(|id| *id > 0)?;
    let name = value.get("name").and_then(Value::as_str)?;
    if name.is_empty() {
        return None;
    }
    let mut out = Map::new();
    out.insert("id".into(), json!(id));
    out.insert("url".into(), json!(site_url("subject", id)));
    out.insert(
        "type".into(),
        json!(subject_type_label(
            value.get("type").and_then(Value::as_u64).unwrap_or(0)
        )),
    );
    out.insert("name".into(), json!(name));
    if let Some(text) = value.get("name_cn").and_then(Value::as_str) {
        if !text.is_empty() {
            out.insert("nameCn".into(), json!(text));
        }
    }
    for key in ["date", "platform"] {
        if let Some(text) = value.get(key).and_then(Value::as_str) {
            if !text.is_empty() {
                out.insert(key.into(), json!(text));
            }
        }
    }
    let rating = value.get("rating");
    if let Some(score) = rating
        .and_then(|rating| rating.get("score"))
        .and_then(Value::as_f64)
    {
        if score > 0.0 {
            out.insert("score".into(), json!(score));
        }
    }
    if let Some(rank) = rating
        .and_then(|rating| rating.get("rank"))
        .and_then(Value::as_u64)
        .filter(|rank| *rank > 0)
    {
        out.insert("rank".into(), json!(rank));
    }
    if let Some(total) = rating
        .and_then(|rating| rating.get("total"))
        .and_then(Value::as_u64)
        .filter(|total| *total > 0)
    {
        out.insert("ratingCount".into(), json!(total));
    }
    if let Some(tags) = value
        .get("tags")
        .and_then(|tags| pick_tags(tags, limits.tags))
    {
        out.insert("tags".into(), json!(tags));
    }
    if let Some(image) = value.get("images").and_then(pick_image) {
        out.insert("image".into(), json!(image));
    } else if let Some(image) = value.get("image").and_then(Value::as_str) {
        if !image.is_empty() {
            out.insert("image".into(), json!(image));
        }
    }
    if let Some(summary) = clamp_text(value.get("summary").and_then(Value::as_str), limits.summary)
    {
        out.insert("summary".into(), json!(summary));
    }
    if let Some(infobox) = value
        .get("infobox")
        .and_then(|infobox| pick_infobox(infobox, limits.infobox_keys, limits.infobox_value))
    {
        out.insert("infobox".into(), infobox);
    }
    Some(Value::Object(out))
}

fn character_brief(value: &Value, limits: &Limits) -> Option<Value> {
    let id = value
        .get("id")
        .and_then(Value::as_u64)
        .filter(|id| *id > 0)?;
    let name = value.get("name").and_then(Value::as_str)?;
    if name.is_empty() {
        return None;
    }
    let mut out = Map::new();
    out.insert("id".into(), json!(id));
    out.insert("url".into(), json!(site_url("character", id)));
    out.insert(
        "type".into(),
        json!(character_type_label(
            value.get("type").and_then(Value::as_u64).unwrap_or(0)
        )),
    );
    out.insert("name".into(), json!(name));
    if let Some(name_cn) = value.get("infobox").and_then(pick_chinese_name) {
        out.insert("nameCn".into(), json!(name_cn));
    }
    if let Some(image) = value.get("images").and_then(pick_image) {
        out.insert("image".into(), json!(image));
    }
    if let Some(summary) = clamp_text(value.get("summary").and_then(Value::as_str), limits.summary)
    {
        out.insert("summary".into(), json!(summary));
    }
    if let Some(infobox) = value
        .get("infobox")
        .and_then(|infobox| pick_infobox(infobox, limits.infobox_keys, limits.infobox_value))
    {
        out.insert("infobox".into(), infobox);
    }
    Some(Value::Object(out))
}

fn person_brief(value: &Value, limits: &Limits) -> Option<Value> {
    let id = value
        .get("id")
        .and_then(Value::as_u64)
        .filter(|id| *id > 0)?;
    let name = value.get("name").and_then(Value::as_str)?;
    if name.is_empty() {
        return None;
    }
    let mut out = Map::new();
    out.insert("id".into(), json!(id));
    out.insert("url".into(), json!(site_url("person", id)));
    out.insert(
        "type".into(),
        json!(person_type_label(
            value.get("type").and_then(Value::as_u64).unwrap_or(0)
        )),
    );
    out.insert("name".into(), json!(name));
    if let Some(name_cn) = value.get("infobox").and_then(pick_chinese_name) {
        out.insert("nameCn".into(), json!(name_cn));
    }
    if let Some(career) = value.get("career").and_then(Value::as_array) {
        let labels: Vec<String> = career
            .iter()
            .filter_map(Value::as_str)
            .map(|value| career_label(value).to_string())
            .collect();
        if let Some(career) = pick_strings(labels.into_iter(), usize::MAX) {
            out.insert("career".into(), json!(career));
        }
    }
    if let Some(image) = value.get("images").and_then(pick_image) {
        out.insert("image".into(), json!(image));
    }
    if let Some(summary) = clamp_text(value.get("summary").and_then(Value::as_str), limits.summary)
    {
        out.insert("summary".into(), json!(summary));
    }
    if let Some(infobox) = value
        .get("infobox")
        .and_then(|infobox| pick_infobox(infobox, limits.infobox_keys, limits.infobox_value))
    {
        out.insert("infobox".into(), infobox);
    }
    Some(Value::Object(out))
}

fn related_list(value: &Value, limit: usize, build: impl Fn(&Value) -> Option<Value>) -> Value {
    let mut seen = BTreeSet::new();
    let mut items = Vec::new();
    let mut total = 0usize;
    for row in value.as_array().map(Vec::as_slice).unwrap_or_default() {
        let Some(item) = build(row) else {
            continue;
        };
        let id = item.get("id").and_then(Value::as_u64).unwrap_or(0);
        if !seen.insert(id) {
            continue;
        }
        total += 1;
        if items.len() < limit {
            items.push(item);
        }
    }
    json!({
        "total": total,
        "omitted": total.saturating_sub(items.len()),
        "items": items,
    })
}

fn related_item(row: &Value, path: &str, relation: Option<&str>) -> Option<Value> {
    let id = row.get("id").and_then(Value::as_u64).filter(|id| *id > 0)?;
    let name = row.get("name").and_then(Value::as_str)?;
    if name.is_empty() {
        return None;
    }
    let mut out = Map::new();
    out.insert("id".into(), json!(id));
    out.insert("url".into(), json!(site_url(path, id)));
    out.insert("name".into(), json!(name));
    if let Some(name_cn) = row.get("name_cn").and_then(Value::as_str) {
        if !name_cn.is_empty() {
            out.insert("nameCn".into(), json!(name_cn));
        }
    }
    if let Some(relation) = relation {
        out.insert("relation".into(), json!(relation));
    }
    Some(Value::Object(out))
}

fn format_works(value: &Value, limit: usize) -> Value {
    related_list(value, limit, |row| {
        let mut item = related_item(row, "subject", row.get("staff").and_then(Value::as_str))?;
        if let Some(kind) = row.get("type").and_then(Value::as_u64) {
            if let Some(object) = item.as_object_mut() {
                object.insert("type".into(), json!(subject_type_label(kind)));
            }
        }
        Some(item)
    })
}

fn format_subject_characters(value: &Value, limit: usize) -> Value {
    // 角色列表允许同一角色多次出现（不同关系），因此不去重
    let mut items = Vec::new();
    let mut total = 0usize;
    for row in value.as_array().map(Vec::as_slice).unwrap_or_default() {
        let Some(mut item) = related_item(
            row,
            "character",
            row.get("relation").and_then(Value::as_str),
        ) else {
            continue;
        };
        total += 1;
        if items.len() >= limit {
            continue;
        }
        let actors: Vec<Value> = row
            .get("actors")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|actor| {
                        actor.as_str().map(str::to_string).or_else(|| {
                            actor
                                .get("name")
                                .and_then(Value::as_str)
                                .map(str::to_string)
                        })
                    })
                    .filter(|name| !name.is_empty())
                    .take(ACTOR_LIMIT)
                    .map(|name| json!(name))
                    .collect()
            })
            .unwrap_or_default();
        if !actors.is_empty() {
            if let Some(object) = item.as_object_mut() {
                object.insert("actors".into(), Value::Array(actors));
            }
        }
        items.push(item);
    }
    json!({ "total": total, "omitted": total.saturating_sub(items.len()), "items": items })
}

fn format_subject_persons(value: &Value, limit: usize) -> Value {
    related_list(value, limit, |row| {
        related_item(row, "person", row.get("relation").and_then(Value::as_str))
    })
}

fn format_character_actors(value: &Value, limit: usize) -> Value {
    related_list(value, limit, |row| {
        related_item(row, "person", row.get("staff").and_then(Value::as_str))
    })
}

fn format_person_roles(value: &Value, limit: usize) -> Value {
    related_list(value, limit, |row| {
        related_item(row, "character", row.get("staff").and_then(Value::as_str))
    })
}

fn subject_kind_code(kind: &str) -> Option<u64> {
    match kind {
        "book" => Some(1),
        "anime" => Some(2),
        "music" => Some(3),
        "game" => Some(4),
        "real" => Some(6),
        _ => None,
    }
}

/// `BangumiAPI.search`
pub async fn search(
    kind: &str,
    query: &str,
    args: &Map<String, Value>,
    detail: Detail,
) -> Result<Value, ToolError> {
    let keyword = query.trim();
    if keyword.is_empty() {
        return Err(ToolError::new("invalid_input", "搜索关键词不能为空"));
    }
    let limits = search_limits(detail);
    let limit = args
        .get("limit")
        .and_then(Value::as_u64)
        .unwrap_or(limits.items as u64)
        .clamp(1, limits.items as u64);
    let offset = args
        .get("offset")
        .and_then(Value::as_u64)
        .unwrap_or(0)
        .min(SEARCH_OFFSET_MAX);

    let mut body = Map::new();
    body.insert("keyword".into(), json!(keyword));
    if let Some(sort) = args.get("sort").and_then(Value::as_str) {
        body.insert("sort".into(), json!(sort));
    }
    if kind == "subject" {
        let types: Vec<u64> = args
            .get("types")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .filter_map(subject_kind_code)
                    .collect()
            })
            .unwrap_or_default();
        if !types.is_empty() {
            body.insert("filter".into(), json!({ "type": types }));
        }
    } else if kind == "person" {
        if let Some(career) = args.get("career").and_then(Value::as_array) {
            if !career.is_empty() {
                body.insert("filter".into(), json!({ "career": career }));
            }
        }
    }

    let path = match kind {
        "character" => "/v0/search/characters",
        "person" => "/v0/search/persons",
        _ => "/v0/search/subjects",
    };
    let raw = request(
        path,
        "POST",
        &[("limit", limit.to_string()), ("offset", offset.to_string())],
        Some(&Value::Object(body)),
    )
    .await?;

    let rows = raw
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let total = raw
        .get("total")
        .and_then(Value::as_u64)
        .unwrap_or(rows.len() as u64);

    let items: Vec<Value> = rows
        .iter()
        .filter_map(|row| match kind {
            "character" => character_brief(row, &limits),
            "person" => person_brief(row, &limits),
            _ => subject_brief(row, &limits),
        })
        .take(limit as usize)
        .collect();

    let mut out = Map::new();
    out.insert("kind".into(), json!(kind));
    out.insert("query".into(), json!(keyword));
    out.insert("total".into(), json!(total));
    out.insert("offset".into(), json!(offset));
    out.insert("returned".into(), json!(items.len()));
    let has_more = offset + (items.len() as u64) < total.min(SEARCH_TOTAL_MAX);
    out.insert("hasMore".into(), json!(has_more));
    if total >= SEARCH_TOTAL_MAX {
        out.insert("totalCapped".into(), json!(true));
    }
    out.insert("items".into(), Value::Array(items));
    Ok(Value::Object(out))
}

/// `BangumiAPI.subject/character/person`
pub async fn detail(
    kind: &str,
    id: u64,
    level: Detail,
    includes: &[String],
) -> Result<Value, ToolError> {
    let limits = detail_limits(level);
    let path = match kind {
        "character" => format!("/v0/characters/{id}"),
        "person" => format!("/v0/persons/{id}"),
        _ => format!("/v0/subjects/{id}"),
    };
    let raw = request(&path, "GET", &[], None).await?;
    let has = |name: &str| includes.iter().any(|item| item == name);

    let (mut body, extra_a, extra_b) = match kind {
        "character" => {
            let brief = character_brief(&raw, &limits).ok_or_else(|| {
                ToolError::new("not_found", format!("Bangumi 没有 id={id} 的角色"))
            })?;
            let works = if has("works") {
                Some(request(&format!("/v0/characters/{id}/subjects"), "GET", &[], None).await?)
            } else {
                None
            };
            let actors = if has("actors") {
                Some(request(&format!("/v0/characters/{id}/persons"), "GET", &[], None).await?)
            } else {
                None
            };
            (brief, works, actors)
        }
        "person" => {
            let brief = person_brief(&raw, &limits).ok_or_else(|| {
                ToolError::new("not_found", format!("Bangumi 没有 id={id} 的人物"))
            })?;
            let works = if has("works") {
                Some(request(&format!("/v0/persons/{id}/subjects"), "GET", &[], None).await?)
            } else {
                None
            };
            let roles = if has("roles") {
                Some(request(&format!("/v0/persons/{id}/characters"), "GET", &[], None).await?)
            } else {
                None
            };
            (brief, works, roles)
        }
        _ => {
            let brief = subject_brief(&raw, &limits).ok_or_else(|| {
                ToolError::new("not_found", format!("Bangumi 没有 id={id} 的条目"))
            })?;
            let characters = if has("characters") {
                Some(request(&format!("/v0/subjects/{id}/characters"), "GET", &[], None).await?)
            } else {
                None
            };
            let staff = if has("staff") {
                Some(request(&format!("/v0/subjects/{id}/persons"), "GET", &[], None).await?)
            } else {
                None
            };
            (brief, characters, staff)
        }
    };

    let object = body
        .as_object_mut()
        .ok_or_else(|| ToolError::new("network", "投影结果异常"))?;

    match kind {
        "character" => {
            if let Some(birthday) = format_birthday(&raw) {
                object.insert("birthday".into(), json!(birthday));
            }
            if let Some(blood) = raw.get("blood_type").and_then(Value::as_str) {
                if !blood.is_empty() {
                    object.insert("bloodType".into(), json!(blood));
                }
            }
            if let Some(stat) = raw.get("stat") {
                if let Some(numbers) = pick_numbers(&[
                    ("comments", stat.get("comments").and_then(Value::as_u64)),
                    ("collects", stat.get("collects").and_then(Value::as_u64)),
                ]) {
                    object.insert("stat".into(), numbers);
                }
            }
            if let Some(works) = extra_a {
                object.insert("works".into(), format_works(&works, limits.related.min(20)));
            }
            if let Some(actors) = extra_b {
                object.insert(
                    "actors".into(),
                    format_character_actors(&actors, limits.related.min(16)),
                );
            }
        }
        "person" => {
            if let Some(birthday) = format_birthday(&raw) {
                object.insert("birthday".into(), json!(birthday));
            }
            if let Some(blood) = raw.get("blood_type").and_then(Value::as_str) {
                if !blood.is_empty() {
                    object.insert("bloodType".into(), json!(blood));
                }
            }
            if let Some(stat) = raw.get("stat") {
                if let Some(numbers) = pick_numbers(&[
                    ("comments", stat.get("comments").and_then(Value::as_u64)),
                    ("collects", stat.get("collects").and_then(Value::as_u64)),
                ]) {
                    object.insert("stat".into(), numbers);
                }
            }
            if let Some(works) = extra_a {
                object.insert("works".into(), format_works(&works, limits.related.min(20)));
            }
            if let Some(roles) = extra_b {
                object.insert(
                    "roles".into(),
                    format_person_roles(&roles, limits.related.min(20)),
                );
            }
        }
        _ => {
            for (key, value) in [
                ("eps", raw.get("eps").and_then(Value::as_u64)),
                (
                    "totalEpisodes",
                    raw.get("total_episodes").and_then(Value::as_u64),
                ),
                ("volumes", raw.get("volumes").and_then(Value::as_u64)),
            ] {
                if let Some(value) = value.filter(|value| *value > 0) {
                    object.insert(key.into(), json!(value));
                }
            }
            if raw.get("series").and_then(Value::as_bool) == Some(true) {
                object.insert("series".into(), json!(true));
            }
            if let Some(meta) = raw.get("meta_tags").and_then(Value::as_array) {
                if let Some(tags) = pick_strings(
                    meta.iter().filter_map(Value::as_str).map(str::to_string),
                    META_TAG_LIMIT,
                ) {
                    object.insert("metaTags".into(), json!(tags));
                }
            }
            if let Some(count) = raw
                .get("rating")
                .and_then(|rating| rating.get("count"))
                .cloned()
            {
                object.insert("ratingDistribution".into(), count);
            }
            if let Some(collection) = raw.get("collection") {
                if let Some(numbers) = pick_numbers(&[
                    ("collect", collection.get("collect").and_then(Value::as_u64)),
                    ("doing", collection.get("doing").and_then(Value::as_u64)),
                    ("dropped", collection.get("dropped").and_then(Value::as_u64)),
                    ("onHold", collection.get("on_hold").and_then(Value::as_u64)),
                    ("wish", collection.get("wish").and_then(Value::as_u64)),
                ]) {
                    object.insert("collection".into(), numbers);
                }
            }
            if let Some(characters) = extra_a {
                object.insert(
                    "characters".into(),
                    format_subject_characters(&characters, limits.related.min(24)),
                );
            }
            if let Some(staff) = extra_b {
                object.insert(
                    "staff".into(),
                    format_subject_persons(&staff, limits.related.min(30)),
                );
            }
        }
    }

    Ok(body)
}

/// 工具入口：按 `action` 分派
pub async fn call(args: &Map<String, Value>) -> Result<Value, ToolError> {
    let action = args
        .get("action")
        .and_then(Value::as_str)
        .unwrap_or("search");
    let level = Detail::parse(args.get("detail").and_then(Value::as_str));

    if action == "search" {
        let query = args
            .get("query")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| ToolError::new("invalid_input", "action=search 需要 query 关键词"))?;
        let kind = args
            .get("kind")
            .and_then(Value::as_str)
            .unwrap_or("subject");
        return search(kind, query, args, level).await;
    }

    let id = args
        .get("id")
        .and_then(Value::as_u64)
        .filter(|id| *id > 0)
        .ok_or_else(|| ToolError::new("invalid_input", format!("action={action} 需要 id")))?;
    let includes: Vec<String> = args
        .get("include")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    detail(action, id, level, &includes).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_clamping_matches_js() {
        assert_eq!(clamp_text(Some("  a \n b  "), 10), Some("a b".into()));
        assert_eq!(clamp_text(Some(""), 10), None);
        assert_eq!(clamp_text(Some("abcdef"), 4), Some("abc…".into()));
        assert_eq!(clamp_text(Some("abc"), 0), None);
    }

    #[test]
    fn infobox_respects_priority_and_budget() {
        let infobox = json!([
            {"key": "别名", "value": "alias"},
            {"key": "简体中文名", "value": "中文名"},
            {"key": "导演", "value": [{"k": "k1", "v": "v1"}, {"v": "v2"}]}
        ]);
        let picked = pick_infobox(&infobox, 2, 50).unwrap();
        let keys: Vec<&String> = picked.as_object().unwrap().keys().collect();
        assert_eq!(keys, vec!["简体中文名", "别名"]);
        assert_eq!(pick_infobox(&infobox, 0, 10), None);
    }

    #[test]
    fn infobox_value_joins_key_value_pairs() {
        assert_eq!(
            infobox_value_text(Some(&json!([{"k": "a", "v": "1"}, {"v": "2"}]))),
            "a: 1；2"
        );
        assert_eq!(infobox_value_text(Some(&json!("text"))), "text");
        assert_eq!(infobox_value_text(None), "");
    }

    #[test]
    fn chinese_name_reads_infobox() {
        let infobox = json!([{"key": "简体中文名", "value": "夜神月"}]);
        assert_eq!(pick_chinese_name(&infobox), Some("夜神月".into()));
        assert_eq!(pick_chinese_name(&json!([])), None);
    }

    #[test]
    fn birthday_formats_with_and_without_year() {
        assert_eq!(
            format_birthday(&json!({"birth_year": 1989, "birth_mon": 2, "birth_day": 28})),
            Some("1989-02-28".into())
        );
        assert_eq!(
            format_birthday(&json!({"birth_mon": 2, "birth_day": 28})),
            Some("02-28".into())
        );
        assert_eq!(format_birthday(&json!({"birth_mon": 2})), None);
    }

    #[test]
    fn subject_brief_picks_core_fields() {
        let raw = json!({
            "id": 12,
            "name": "君の名は。",
            "name_cn": "你的名字。",
            "type": 2,
            "date": "2016-08-26",
            "platform": "剧场版",
            "rating": { "score": 8.1, "rank": 100, "total": 1000 },
            "tags": [{"name": "动画"}, {"name": "剧场版"}],
            "images": { "large": "https://img/l.jpg" },
            "summary": "简介",
            "infobox": []
        });
        let brief = subject_brief(&raw, &detail_limits(Detail::Standard)).unwrap();
        assert_eq!(brief["type"], json!("动画"));
        assert_eq!(brief["nameCn"], json!("你的名字。"));
        assert_eq!(brief["score"], json!(8.1));
        assert_eq!(brief["tags"], json!(["动画", "剧场版"]));
        assert_eq!(brief["image"], json!("https://img/l.jpg"));
    }

    #[test]
    fn related_list_dedupes_and_reports_omitted() {
        let rows = json!([
            {"id": 1, "name": "a", "relation": "主角"},
            {"id": 1, "name": "a", "relation": "配角"},
            {"id": 2, "name": "b"}
        ]);
        let list = related_list(&rows, 1, |row| {
            related_item(
                row,
                "character",
                row.get("relation").and_then(Value::as_str),
            )
        });
        assert_eq!(list["total"], json!(2));
        assert_eq!(list["omitted"], json!(1));
        assert_eq!(list["items"][0]["id"], json!(1));
    }

    async fn mock_api() -> String {
        use axum::response::IntoResponse;
        use axum::Json;

        let app = axum::Router::new().fallback(
            |request: axum::extract::Request| async move {
                let path = request.uri().path().to_string();
                if path.ends_with("/subjects/13") {
                    return (
                        axum::http::StatusCode::NOT_FOUND,
                        Json(json!({"description": "not found"})),
                    )
                        .into_response();
                }
                if path.ends_with("/subjects/12") {
                    return Json(json!({
                        "id": 12,
                        "name": "君の名は。",
                        "name_cn": "你的名字。",
                        "type": 2,
                        "summary": "简介",
                        "rating": {"score": 8.1, "rank": 10, "total": 100},
                        "tags": [{"name": "动画"}],
                        "images": {"large": "https://img/l.jpg"},
                        "collection": {"collect": 1, "doing": 2},
                        "eps": 1
                    }))
                    .into_response();
                }
                if path.ends_with("/characters") {
                    return Json(json!([
                        {"id": 5, "name": "立花泷", "relation": "主角", "actors": [{"name": "神木隆之介"}]}
                    ]))
                    .into_response();
                }
                if path.contains("/search/") {
                    return Json(json!({
                        "total": 1,
                        "data": [{
                            "id": 12,
                            "name": "君の名は。",
                            "type": 2,
                            "rating": {"score": 8.1},
                            "tags": [{"name": "动画"}]
                        }]
                    }))
                    .into_response();
                }
                Json(json!({"description": "not found"})).into_response()
            },
        );
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
    async fn search_and_detail_against_mock_api() {
        let base = mock_api().await;
        set_base(&base);

        let search = call(
            &json!({"action": "search", "query": "你的名字", "kind": "subject"})
                .as_object()
                .cloned()
                .unwrap(),
        )
        .await
        .expect("search");
        assert_eq!(search["kind"], json!("subject"));
        assert_eq!(search["total"], json!(1));
        assert_eq!(search["items"][0]["type"], json!("动画"));

        let detail = call(
            &json!({"action": "subject", "id": 12, "include": ["characters"]})
                .as_object()
                .cloned()
                .unwrap(),
        )
        .await
        .expect("subject");
        assert_eq!(detail["nameCn"], json!("你的名字。"));
        assert_eq!(detail["collection"]["doing"], json!(2));
        assert_eq!(detail["characters"]["items"][0]["name"], json!("立花泷"));

        // 404 → not_found
        let error = call(
            &json!({"action": "subject", "id": 13})
                .as_object()
                .cloned()
                .unwrap(),
        )
        .await
        .unwrap_err();
        assert_eq!(error.code, "not_found");
    }

    #[tokio::test]
    async fn search_rejects_empty_keyword() {
        let error = search("subject", "  ", &Map::new(), Detail::Standard)
            .await
            .unwrap_err();
        assert_eq!(error.code, "invalid_input");
    }

    #[tokio::test]
    async fn detail_requires_positive_id() {
        let error = call(
            &json!({"action": "subject", "id": 0})
                .as_object()
                .cloned()
                .unwrap(),
        )
        .await
        .unwrap_err();
        assert_eq!(error.code, "invalid_input");
    }
}
