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
    if key.len() > 10 {
        format!("{}***", &key[..4])
    } else {
        format!("{}***", &key[..2])
    }
}
