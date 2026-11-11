//! `agent-tool-web-snapshot` 的宿主实现。
//!
//! Electron 版用 `WebBrowser`（6 个真实页面 + JS 执行）。Tauri 侧没有内嵌浏览器池，
//! 这里用 HTTP 抓取 + DOM 文本抽取实现同样的动作面：`search` / `open` / `navigate`
//! / `snapshot` / `read_page` / `read_section` / `get_images` / `close_page`。
//!
//! 已知差异：不执行页面 JS，SPA 只能拿到首屏；`selector` 依赖真实 DOM，改用
//! `keyword` 分段（传 selector 会得到明确错误）。`agent-tool-web-execute` 因此不提供。

use std::sync::{Mutex, OnceLock};

use serde_json::{json, Map, Value};

use crate::agent::bridge::ToolError;

const DEFAULT_CONTENT_CHARS: usize = 6_000;
const MAX_CONTENT_CHARS: usize = 12_000;
const DEFAULT_ITEMS: usize = 6;
const MAX_PAGES: usize = 6;

struct Entry {
    id: String,
    url: String,
    page: crate::tools::web::Page,
    last_used: u64,
}

fn pool() -> &'static Mutex<Vec<Entry>> {
    static POOL: OnceLock<Mutex<Vec<Entry>>> = OnceLock::new();
    POOL.get_or_init(|| Mutex::new(Vec::new()))
}

fn tick() -> u64 {
    use std::sync::atomic::{AtomicU64, Ordering};
    static TICK: AtomicU64 = AtomicU64::new(1);
    TICK.fetch_add(1, Ordering::SeqCst)
}

fn take_page(page_id: Option<&str>) -> Option<Entry> {
    let guard = pool().lock().ok()?;
    match page_id {
        Some(id) => guard
            .iter()
            .find(|entry| entry.id == id)
            .map(|entry| Entry {
                id: entry.id.clone(),
                url: entry.url.clone(),
                page: entry.page.clone(),
                last_used: entry.last_used,
            }),
        None => guard
            .iter()
            .max_by_key(|entry| entry.last_used)
            .map(|entry| Entry {
                id: entry.id.clone(),
                url: entry.url.clone(),
                page: entry.page.clone(),
                last_used: entry.last_used,
            }),
    }
}

fn put_page(entry: Entry) -> String {
    let id = entry.id.clone();
    if let Ok(mut guard) = pool().lock() {
        guard.retain(|item| item.id != id);
        if guard.len() >= MAX_PAGES {
            // 淘汰最久未使用的页面
            if let Some(index) = guard
                .iter()
                .enumerate()
                .min_by_key(|(_, item)| item.last_used)
                .map(|(index, _)| index)
            {
                guard.remove(index);
            }
        }
        guard.push(entry);
    }
    id
}

fn next_page_id() -> String {
    let used = pool()
        .lock()
        .map(|guard| {
            guard
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    for index in 1..=MAX_PAGES {
        let id = format!("page-{index}");
        if !used.contains(&id) {
            return id;
        }
    }
    format!("page-{}", tick())
}

fn text_arg<'a>(args: &'a Map<String, Value>, key: &str) -> Option<&'a str> {
    args.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn usize_arg(args: &Map<String, Value>, key: &str, default: usize) -> usize {
    args.get(key)
        .and_then(Value::as_u64)
        .map(|value| value as usize)
        .unwrap_or(default)
}

fn slice_chars(text: &str, cursor: usize, max: usize) -> (String, usize) {
    let total = text.chars().count();
    if cursor >= total {
        return (String::new(), total);
    }
    let piece: String = text.chars().skip(cursor).take(max).collect();
    let next = (cursor + piece.chars().count()).min(total);
    (piece, next)
}

fn range(next: usize, total: usize) -> Value {
    json!({
        "nextCursor": if next >= total { Value::Null } else { json!(next) },
        "totalChars": total,
    })
}

async fn fetch(url: &str) -> Result<crate::tools::web::Page, ToolError> {
    crate::tools::web::read(url, MAX_CONTENT_CHARS + 4_000)
        .await
        .map_err(|error| ToolError::new("network", error.to_string()))
}

fn normalize_url(raw: &str) -> Result<String, ToolError> {
    let parsed = url::Url::parse(raw)
        .map_err(|_| ToolError::new("invalid_tool_call", format!("URL 不合法：{raw}")))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(ToolError::new(
            "invalid_tool_call",
            "仅支持 HTTP/HTTPS 网页",
        ));
    }
    Ok(parsed.to_string())
}

/// 搜索引擎的结果链接常是跳转地址：`bing.com/ck/a?u=a1<base64url>`、
/// `duckduckgo.com/l/?uddg=<url>`。还原成真实 URL，否则过滤后会一条不剩。
fn unwrap_redirect(href: &str) -> Option<String> {
    use base64::Engine;
    let parsed = url::Url::parse(href).ok()?;
    for (key, value) in parsed.query_pairs() {
        if key == "u" {
            if let Some(encoded) = value.strip_prefix("a1") {
                if let Ok(bytes) = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(encoded)
                {
                    if let Ok(url) = String::from_utf8(bytes) {
                        if url.starts_with("http") {
                            return Some(url);
                        }
                    }
                }
            }
        }
        if key == "uddg" && value.starts_with("http") {
            return Some(value.into_owned());
        }
    }
    Some(href.to_string())
}

fn is_engine_host(url: &str) -> bool {
    ["bing.com", "baidu.com", "duckduckgo.com", "google.com"]
        .iter()
        .any(|host| url.contains(host))
}

fn search_url(engine: &str, query: &str, site: Option<&str>) -> String {
    let mut query = query.to_string();
    if let Some(site) = site {
        query = format!("{query} site:{site}");
    }
    let encoded = url::form_urlencoded::byte_serialize(query.as_bytes()).collect::<String>();
    match engine {
        "baidu" => format!("https://www.baidu.com/s?wd={encoded}"),
        "duckduckgo" => format!("https://duckduckgo.com/html/?q={encoded}"),
        _ => format!("https://www.bing.com/search?q={encoded}"),
    }
}

fn summarize(entry: &Entry, cursor: usize, max: usize) -> Value {
    let total = entry.page.content.chars().count();
    let (content, next) = slice_chars(&entry.page.content, cursor, max);
    json!({
        "action": "snapshot",
        "pageId": entry.id,
        "url": entry.url,
        "title": entry.page.title,
        "content": content,
        "contentRange": range(next, total),
        "truncated": entry.page.truncated,
    })
}

pub async fn snapshot(args: &Map<String, Value>) -> Result<Value, ToolError> {
    let action = args.get("action").and_then(Value::as_str).unwrap_or("open");
    let page_id = text_arg(args, "page_id");
    let max_chars =
        usize_arg(args, "max_chars", DEFAULT_CONTENT_CHARS).clamp(500, MAX_CONTENT_CHARS);
    let limit = usize_arg(args, "limit", DEFAULT_ITEMS).clamp(1, 10);

    match action {
        "search" => {
            let query = text_arg(args, "query")
                .ok_or_else(|| ToolError::new("invalid_tool_call", "search 需要 query"))?;
            let engine = args.get("engine").and_then(Value::as_str).unwrap_or("bing");
            let site = text_arg(args, "site");
            let page = fetch(&search_url(engine, query, site)).await?;
            let mut results = Vec::new();
            let mut seen = std::collections::BTreeSet::new();
            for link in &page.links {
                if !link.href.starts_with("http") {
                    continue;
                }
                let Some(url) = unwrap_redirect(&link.href) else {
                    continue;
                };
                if is_engine_host(&url) {
                    continue;
                }
                let title = link.text.trim();
                if title.is_empty() || !seen.insert(url.clone()) {
                    continue;
                }
                results.push(json!({ "title": title, "url": url }));
                if results.len() >= limit {
                    break;
                }
            }
            Ok(json!({
                "action": "search",
                "query": query,
                "engine": engine,
                "results": results,
            }))
        }
        "open" | "navigate" => {
            let raw = text_arg(args, "url")
                .ok_or_else(|| ToolError::new("invalid_tool_call", "导航需要提供 url 参数"))?;
            let url = normalize_url(raw)?;
            let page = fetch(&url).await?;
            let id = page_id
                .map(str::to_string)
                .filter(|id| {
                    pool()
                        .lock()
                        .map(|guard| guard.iter().any(|e| e.id == *id))
                        .unwrap_or(false)
                })
                .unwrap_or_else(next_page_id);
            put_page(Entry {
                id: id.clone(),
                url,
                page,
                last_used: tick(),
            });
            let entry =
                take_page(Some(&id)).ok_or_else(|| ToolError::new("service", "页面缓存异常"))?;
            Ok(summarize(&entry, 0, max_chars))
        }
        "close_page" => {
            let id = page_id
                .ok_or_else(|| ToolError::new("invalid_tool_call", "关闭页面需要 page_id"))?;
            let removed = pool()
                .lock()
                .map(|mut guard| {
                    let before = guard.len();
                    guard.retain(|entry| entry.id != id);
                    before != guard.len()
                })
                .unwrap_or(false);
            Ok(json!({ "action": "close_page", "pageId": id, "closed": removed }))
        }
        "get_images" => {
            let entry = take_page(page_id)
                .ok_or_else(|| ToolError::new("invalid_tool_call", "没有可用页面，请先 open"))?;
            let offset = usize_arg(args, "offset", 0);
            let images: Vec<Value> = entry
                .page
                .images
                .iter()
                .skip(offset)
                .take(limit)
                .map(|image| json!({ "src": image.src, "alt": image.alt }))
                .collect();
            Ok(json!({
                "action": "get_images",
                "pageId": entry.id,
                "url": entry.url,
                "total": entry.page.images.len(),
                "offset": offset,
                "images": images,
            }))
        }
        "read_section" => {
            if text_arg(args, "keyword").is_none() {
                return Err(ToolError::new(
                    "invalid_tool_call",
                    "分段读取需要 keyword（Tauri 版不执行 DOM 查询，不支持 selector）",
                ));
            }
            let keyword = text_arg(args, "keyword").unwrap_or_default();
            let entry = take_page(page_id)
                .ok_or_else(|| ToolError::new("invalid_tool_call", "没有可用页面，请先 open"))?;
            let total = entry.page.content.chars().count();
            let mut hits = Vec::new();
            let mut search_from = 0usize;
            while hits.len() < limit {
                let (piece, next) =
                    slice_chars(&entry.page.content, search_from, MAX_CONTENT_CHARS);
                let Some(index) = piece.find(keyword) else {
                    break;
                };
                let start = search_from + piece[..index].chars().count();
                let (section, section_next) = slice_chars(&entry.page.content, start, max_chars);
                hits.push(json!({ "offset": start, "content": section }));
                search_from = section_next;
                if section_next <= start {
                    break;
                }
                let _ = next;
            }
            Ok(json!({
                "action": "read_section",
                "pageId": entry.id,
                "url": entry.url,
                "title": entry.page.title,
                "keyword": keyword,
                "sections": hits,
                "contentRange": range(0, total),
            }))
        }
        _ => {
            // read_page / snapshot：可选先导航，再按 cursor 取一段正文
            if let Some(raw) = text_arg(args, "url") {
                let url = normalize_url(raw)?;
                let page = fetch(&url).await?;
                let id = page_id.map(str::to_string).unwrap_or_else(next_page_id);
                put_page(Entry {
                    id: id.clone(),
                    url,
                    page,
                    last_used: tick(),
                });
            }
            let cursor = usize_arg(args, "cursor", 0);
            let entry = take_page(page_id)
                .ok_or_else(|| ToolError::new("invalid_tool_call", "没有可用页面，请先 open"))?;
            if let Ok(mut guard) = pool().lock() {
                if let Some(item) = guard.iter_mut().find(|item| item.id == entry.id) {
                    item.last_used = tick();
                }
            }
            let mut value = summarize(&entry, cursor, max_chars);
            if let Some(object) = value.as_object_mut() {
                object.insert("action".into(), json!(action));
            }
            Ok(value)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 页面池是进程级单例，涉及池的用例必须串行并清空
    static POOL_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    async fn exclusive() -> tokio::sync::MutexGuard<'static, ()> {
        let guard = POOL_LOCK.lock().await;
        if let Ok(mut pool) = pool().lock() {
            pool.clear();
        }
        guard
    }

    fn seed(url: &str, title: &str, content: &str) -> String {
        let page = crate::tools::web::Page {
            url: url.to_string(),
            title: title.to_string(),
            content: content.to_string(),
            links: vec![crate::tools::web::Link {
                text: "示例".into(),
                href: "https://example.com/a".into(),
            }],
            images: vec![crate::tools::web::Image {
                src: "https://example.com/i.jpg".into(),
                alt: "图".into(),
            }],
            truncated: false,
        };
        let id = next_page_id();
        put_page(Entry {
            id: id.clone(),
            url: url.to_string(),
            page,
            last_used: tick(),
        });
        id
    }

    #[tokio::test]
    async fn read_page_and_images_use_cached_page() {
        let _guard = exclusive().await;
        let id = seed("https://example.com", "示例页", "第一段 关键词 第二段");
        let args = json!({"action": "read_page", "page_id": id, "max_chars": 500});
        let value = snapshot(args.as_object().unwrap()).await.unwrap();
        assert_eq!(value["pageId"], json!(id));
        assert_eq!(value["title"], json!("示例页"));
        assert!(value["content"].as_str().unwrap().contains("关键词"));

        let images = snapshot(
            json!({"action": "get_images", "page_id": id, "limit": 2})
                .as_object()
                .unwrap(),
        )
        .await
        .unwrap();
        assert_eq!(images["total"], json!(1));
        assert_eq!(images["images"][0]["alt"], json!("图"));
    }

    #[tokio::test]
    async fn read_section_finds_keyword() {
        let _guard = exclusive().await;
        let id = seed("https://example.com", "示例页", "开头 中间 关键词 结尾");
        let value = snapshot(
            json!({"action": "read_section", "page_id": id, "keyword": "关键词", "max_chars": 500})
                .as_object()
                .unwrap(),
        )
        .await
        .unwrap();
        let sections = value["sections"].as_array().unwrap();
        assert_eq!(sections.len(), 1);
        assert!(sections[0]["content"].as_str().unwrap().contains("关键词"));
    }

    #[tokio::test]
    async fn close_page_removes_entry() {
        let _guard = exclusive().await;
        let id = seed("https://example.com", "t", "c");
        let closed = snapshot(
            json!({"action": "close_page", "page_id": id})
                .as_object()
                .unwrap(),
        )
        .await
        .unwrap();
        assert_eq!(closed["closed"], json!(true));
        // 再读同一页应报"没有可用页面"
        let error = snapshot(
            json!({"action": "read_page", "page_id": id})
                .as_object()
                .unwrap(),
        )
        .await
        .unwrap_err();
        assert_eq!(error.code, "invalid_tool_call");
    }

    #[tokio::test]
    async fn pool_is_bounded() {
        let _guard = exclusive().await;
        for index in 0..(MAX_PAGES + 3) {
            seed(&format!("https://example.com/{index}"), "t", "c");
        }
        let len = pool().lock().unwrap().len();
        assert!(len <= MAX_PAGES, "页面池应有上限，实际 {len}");
    }

    #[tokio::test]
    async fn search_requires_query() {
        let error = snapshot(&json!({"action": "search"}).as_object().cloned().unwrap())
            .await
            .unwrap_err();
        assert_eq!(error.code, "invalid_tool_call");
    }

    #[tokio::test]
    async fn open_requires_http_url() {
        let error = snapshot(
            &json!({"action": "open", "url": "file:///etc/passwd"})
                .as_object()
                .cloned()
                .unwrap(),
        )
        .await
        .unwrap_err();
        assert_eq!(error.code, "invalid_tool_call");

        let error = snapshot(&json!({"action": "open"}).as_object().cloned().unwrap())
            .await
            .unwrap_err();
        assert!(error.message.contains("url"));
    }

    #[tokio::test]
    async fn read_section_requires_keyword() {
        let error = snapshot(
            &json!({"action": "read_section", "selector": "#main"})
                .as_object()
                .cloned()
                .unwrap(),
        )
        .await
        .unwrap_err();
        assert_eq!(error.code, "invalid_tool_call");
        assert!(error.message.contains("selector"));
    }

    #[tokio::test]
    async fn close_page_without_id_is_rejected() {
        let error = snapshot(
            &json!({"action": "close_page"})
                .as_object()
                .cloned()
                .unwrap(),
        )
        .await
        .unwrap_err();
        assert!(error.message.contains("page_id"));
    }

    #[test]
    fn slice_and_range_are_consistent() {
        let (piece, next) = slice_chars("abcdef", 2, 3);
        assert_eq!(piece, "cde");
        assert_eq!(next, 5);
        assert_eq!(range(next, 6)["nextCursor"], json!(5));
        assert!(range(6, 6)["nextCursor"].is_null());
    }

    #[test]
    fn redirects_are_unwrapped() {
        // bing.com/ck/a?u=a1<base64url("https://example.com/x")>
        let encoded = {
            use base64::Engine;
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode("https://example.com/x")
        };
        let href = format!("https://www.bing.com/ck/a?u=a1{encoded}&ntb=1");
        assert_eq!(
            unwrap_redirect(&href).as_deref(),
            Some("https://example.com/x")
        );

        let ddg = "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fy";
        assert_eq!(
            unwrap_redirect(ddg).as_deref(),
            Some("https://example.org/y")
        );
        assert_eq!(
            unwrap_redirect("https://example.net/plain").as_deref(),
            Some("https://example.net/plain")
        );
        assert!(is_engine_host("https://www.bing.com/ck/a"));
        assert!(!is_engine_host("https://example.com/"));
    }

    #[test]
    fn search_url_builds_engines() {
        assert!(search_url("bing", "rust", None).starts_with("https://www.bing.com/search?q=rust"));
        assert!(search_url("baidu", "rust", Some("example.com"))
            .starts_with("https://www.baidu.com/s?wd=rust+site"));
        assert!(search_url("duckduckgo", "rust", None).contains("duckduckgo.com/html"));
    }
}
