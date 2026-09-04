use serde_json::Value;
use std::sync::atomic::{AtomicU64, Ordering};

// 将 Value 安全的转换为字符串
pub fn stringify(value: &Value) -> String {
    if value.is_string() {
        return value.as_str().unwrap_or_default().to_string();
    }
    serde_json::to_string(value).unwrap_or_else(|_| String::from("<unprintable>"))
}

// 生成 id
pub fn generate_id(prefix: &str) -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let count = COUNTER.fetch_add(1, Ordering::Relaxed);

    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    format!("{prefix}-{millis:x}-{count}")
}

pub fn secret_key(key: String) -> String {
    if key.is_empty() {
        return key;
    }
    let visible = if key.chars().count() > 10 { 4 } else { 2 };
    format!("{}***", key.chars().take(visible).collect::<String>())
}

/// 工具名白名单清洗: 只保留 [a-zA-Z0-9_-], 其余替换成 _
/// 不然，工具名会包含特殊字符，导致工具调用失败（deepseek实测）
pub fn sanitize_tool_name(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

// 目前还不打算添加外部mcp（虽然mcp plugin支持就是了）
pub fn validate_mcp_url(value: String) -> anyhow::Result<String> {
    let url = reqwest::Url::parse(&value).map_err(|_| anyhow::anyhow!("--mcp-url 不是有效 URL"))?;
    if url.scheme() != "http" && url.scheme() != "https" {
        anyhow::bail!("--mcp-url 只支持 HTTP(S)");
    }
    let loopback = matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "::1"));
    if !loopback {
        anyhow::bail!("--mcp-url 必须指向回环地址");
    }
    Ok(value)
}
