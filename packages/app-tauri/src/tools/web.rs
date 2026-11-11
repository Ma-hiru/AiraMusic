use std::time::Duration;

use anyhow::{bail, Context, Result};
use ego_tree::NodeRef;
use scraper::node::Node;
use scraper::Html;
use serde::Serialize;
use url::Url;

const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_BYTES: usize = 4 * 1024 * 1024;

/// 不参与正文的标签
const NOISE: &[&str] = &[
    "script", "style", "noscript", "svg", "nav", "footer", "header", "aside", "form", "iframe",
    "template",
];

/// 需要在前后断行的块级标签
const BLOCK: &[&str] = &[
    "p",
    "div",
    "section",
    "article",
    "main",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "tr",
    "blockquote",
    "pre",
    "table",
    "ul",
    "ol",
    "br",
    "hr",
    "figure",
    "figcaption",
];

#[derive(Clone, Debug, Serialize)]
pub struct Link {
    pub text: String,
    pub href: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct Image {
    pub src: String,
    pub alt: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct Page {
    pub url: String,
    pub title: String,
    pub content: String,
    pub links: Vec<Link>,
    pub images: Vec<Image>,
    pub truncated: bool,
}

/// 抓取并抽取正文。
///
/// 这是 D4/D6 约定的降级版：不执行 JS，只解析首屏 HTML。
/// 静态内容站无损；SPA 只能拿到壳。
pub async fn read(url: &str, max_chars: usize) -> Result<Page> {
    let parsed = Url::parse(url).context("URL 不合法")?;
    if !matches!(parsed.scheme(), "http" | "https") {
        bail!("只支持 http/https");
    }
    if is_private_host(&parsed) {
        bail!("拒绝访问内网地址");
    }

    let client = crate::http::external_client(Duration::from_secs(20));
    let response = client
        .get(parsed.clone())
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .header(reqwest::header::ACCEPT, "text/html,application/xhtml+xml")
        .header(reqwest::header::ACCEPT_LANGUAGE, "zh-CN,zh;q=0.9,en;q=0.8")
        .send()
        .await
        .context("请求失败")?;

    let final_url = response.url().clone();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);

    let bytes = response.bytes().await.context("读取响应失败")?;
    if bytes.len() > MAX_BYTES {
        bail!("响应超过 {} 字节", MAX_BYTES);
    }

    let html = decode(&bytes, content_type.as_deref());
    Ok(extract(&html, &final_url, max_chars))
}

fn is_private_host(url: &Url) -> bool {
    match url.host() {
        Some(url::Host::Ipv4(ip)) => ip.is_private() || ip.is_loopback() || ip.is_link_local(),
        Some(url::Host::Ipv6(ip)) => ip.is_loopback() || ip.is_unique_local(),
        Some(url::Host::Domain(host)) => {
            host == "localhost" || host.ends_with(".local") || host.ends_with(".internal")
        }
        None => true,
    }
}

/// 字符集：优先 Content-Type，其次 `<meta charset>`，最后按 UTF-8 容错。
fn decode(bytes: &[u8], content_type: Option<&str>) -> String {
    let mut label: Option<String> = None;

    if let Some(content_type) = content_type {
        if let Some(index) = content_type.to_ascii_lowercase().find("charset=") {
            label = Some(
                content_type[index + 8..]
                    .split(';')
                    .next()
                    .unwrap_or("")
                    .trim()
                    .trim_matches('"')
                    .to_string(),
            );
        }
    }

    if label.is_none() {
        let head = String::from_utf8_lossy(&bytes[..bytes.len().min(2048)]).to_ascii_lowercase();
        if let Some(index) = head.find("charset=") {
            let rest = &head[index + 8..];
            let end = rest
                .find(|c: char| c == '"' || c == '\'' || c == '>' || c == ';' || c.is_whitespace())
                .unwrap_or(rest.len());
            label = Some(rest[..end].to_string());
        }
    }

    if let Some(label) = label {
        if let Some(encoding) = encoding_rs::Encoding::for_label(label.trim().as_bytes()) {
            let (text, _, _) = encoding.decode(bytes);
            return text.into_owned();
        }
    }

    String::from_utf8_lossy(bytes).into_owned()
}

fn extract(html: &str, url: &Url, max_chars: usize) -> Page {
    let document = Html::parse_document(html);

    let title = document
        .select(&scraper::Selector::parse("title").expect("selector"))
        .next()
        .map(|element| collapse(element.text().collect::<Vec<_>>().join(" ")))
        .filter(|text| !text.is_empty())
        .unwrap_or_else(|| url.to_string());

    // 直接从文档根遍历：nav/header/footer/aside 已在 NOISE 里跳过，
    // 不需要先选 article/main 再回溯 NodeRef。
    let root = document.tree.root();

    let mut content = String::new();
    let mut links = Vec::new();
    let mut images = Vec::new();
    walk(root, url, &mut content, &mut links, &mut images);

    let content = tidy(&content);
    let (content, truncated) = if content.chars().count() > max_chars {
        (content.chars().take(max_chars).collect::<String>(), true)
    } else {
        (content, false)
    };

    Page {
        url: url.to_string(),
        title,
        content,
        links,
        images,
        truncated,
    }
}

fn walk(
    node: NodeRef<'_, Node>,
    base: &Url,
    out: &mut String,
    links: &mut Vec<Link>,
    images: &mut Vec<Image>,
) {
    match node.value() {
        Node::Text(text) => out.push_str(text),
        Node::Element(element) => {
            let tag = element.name();
            if NOISE.contains(&tag) {
                return;
            }
            let block = BLOCK.contains(&tag);

            if tag == "a" {
                if let Some(href) = element.attr("href") {
                    if let Ok(absolute) = base.join(href) {
                        let text = scraper::ElementRef::wrap(node)
                            .map(|element| collapse(element.text().collect::<Vec<_>>().join(" ")))
                            .unwrap_or_default();
                        if !text.is_empty() {
                            links.push(Link {
                                text,
                                href: absolute.to_string(),
                            });
                        }
                    }
                }
            }
            if tag == "img" {
                if let Some(src) = element.attr("src").or_else(|| element.attr("data-src")) {
                    if let Ok(absolute) = base.join(src) {
                        images.push(Image {
                            src: absolute.to_string(),
                            alt: element.attr("alt").unwrap_or("").to_string(),
                        });
                    }
                }
            }

            if block {
                out.push('\n');
            }
            for child in node.children() {
                walk(child, base, out, links, images);
            }
            if block {
                out.push('\n');
            }
        }
        _ => {
            for child in node.children() {
                walk(child, base, out, links, images);
            }
        }
    }
}

fn collapse(value: String) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// 行内空白折叠、连续空行合并
fn tidy(value: &str) -> String {
    let mut lines: Vec<String> = Vec::new();
    for line in value.lines() {
        let line = line.split_whitespace().collect::<Vec<_>>().join(" ");
        if line.is_empty() && matches!(lines.last(), Some(last) if last.is_empty()) {
            continue;
        }
        lines.push(line);
    }
    lines.join("\n").trim().to_string()
}
