//! 工具结果的整形：与 `MainAgentTool.formatResult` / `formatError` 对齐。
//!
//! 三件事：
//! 1. 归一化（`undefined` 丢弃、非有限数变 null、Date 转 ISO）；
//! 2. 对外访问时脱敏（用户资料类字段）；
//! 3. 超过 18k 字符时按字段优先级裁剪（正文/链接等关键字段优先保留）。

use rmcp::model::{CallToolResult, ContentBlock};
use serde_json::{json, Map, Value};

use crate::agent::bridge::ToolError;
use crate::agent::ToolDef;

pub const OUTPUT_MAX_CHARS: usize = 18_000;

/// `formatResult(output, tool, context)`
pub fn success(def: &ToolDef, output: Value) -> CallToolResult {
    let mut value = match output {
        Value::String(text) => serde_json::from_str(&text).unwrap_or(Value::String(text)),
        other => other,
    };
    // MCP 端点对内对外都按 public 处理
    value = normalize(&value, true);
    let (text, result) = limit(&value);

    let mut call = CallToolResult::success(vec![ContentBlock::text(text)]);
    call.structured_content = Some(json!({
        "ok": true,
        "tool": def.name,
        "result": result,
    }));
    call
}

/// `formatError(error, tool)`
pub fn failure(def: &ToolDef, error: &ToolError) -> CallToolResult {
    let payload = json!({
        "ok": false,
        "tool": def.name,
        "error": {
            "code": error.code,
            "message": error.message,
            "retryable": error.retryable(),
        }
    });
    let mut call = CallToolResult::error(vec![ContentBlock::text(payload.to_string())]);
    call.structured_content = Some(payload);
    call
}

fn normalize(value: &Value, redact: bool) -> Value {
    match value {
        Value::Number(number) => {
            if number
                .as_f64()
                .map(|value| value.is_finite())
                .unwrap_or(false)
            {
                Value::Number(number.clone())
            } else {
                Value::Null
            }
        }
        Value::Array(items) => {
            Value::Array(items.iter().map(|item| normalize(item, redact)).collect())
        }
        Value::Object(map) => {
            let mut out = Map::new();
            for (key, item) in map {
                if item.is_null() && redact && is_sensitive(key) {
                    continue;
                }
                if redact && is_sensitive(key) {
                    continue;
                }
                out.insert(key.clone(), normalize(item, redact));
            }
            Value::Object(out)
        }
        other => other.clone(),
    }
}

/// 与 `SensitiveMcpOutputKeys` + 前后缀规则一致
fn is_sensitive(key: &str) -> bool {
    const KEYS: &[&str] = &[
        "account",
        "accounts",
        "backgroundimgid",
        "backgroundurl",
        "cellphone",
        "city",
        "creator",
        "creators",
        "defaultavatar",
        "email",
        "experttags",
        "experts",
        "followed",
        "gender",
        "mobile",
        "mutual",
        "nickname",
        "owner",
        "owners",
        "phone",
        "province",
        "remarkname",
        "signature",
        "subscriber",
        "subscribers",
        "uid",
    ];
    let normalized: String = key
        .to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect();
    KEYS.contains(&normalized.as_str())
        || normalized.starts_with("avatar")
        || normalized.starts_with("creator")
        || normalized.starts_with("owner")
        || normalized.starts_with("user")
        || normalized.contains("profile")
}

/// `limitOutput`：超出预算时按优先级保留字段，并附 `_meta`
pub fn limit(value: &Value) -> (String, Value) {
    let text = match value {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    };
    if text.chars().count() <= OUTPUT_MAX_CHARS {
        return (text, value.clone());
    }

    let original_chars = text.chars().count();
    if let Value::String(text) = value {
        let marker = format!("\n… [工具结果已裁剪，原始共 {original_chars} 个字符]");
        let keep = OUTPUT_MAX_CHARS.saturating_sub(marker.chars().count());
        let bounded: String = text.chars().take(keep).collect::<String>() + &marker;
        return (bounded.clone(), Value::String(bounded));
    }

    let create = |budget: usize| -> Value {
        let projected = project(value, budget, 0);
        let meta = json!({
            "truncated": true,
            "originalChars": original_chars,
            "returnedAs": "structured-json-preview",
        });
        match projected {
            Value::Object(mut map) => {
                map.insert("_meta".into(), meta);
                Value::Object(map)
            }
            other => json!({ "_meta": meta, "value": other }),
        }
    };

    let mut low = 0usize;
    let mut high = OUTPUT_MAX_CHARS;
    let mut result = create(0);
    while low <= high {
        let mid = (low + high) / 2;
        let candidate = create(mid);
        if candidate.to_string().chars().count() <= OUTPUT_MAX_CHARS {
            result = candidate;
            low = mid + 1;
        } else {
            if mid == 0 {
                break;
            }
            high = mid - 1;
        }
    }
    let text = result.to_string();
    (text, result)
}

fn project(value: &Value, budget: usize, depth: usize) -> Value {
    match value {
        Value::String(text) => {
            if text.chars().count() <= budget {
                return Value::String(text.clone());
            }
            if budget <= 1 {
                return Value::String(String::new());
            }
            let keep: String = text.chars().take(budget - 1).collect();
            Value::String(format!("{}…", keep.trim_end()))
        }
        Value::Array(items) => {
            if depth >= 8 || budget == 0 {
                return Value::Array(Vec::new());
            }
            if items.is_empty() {
                return Value::Array(Vec::new());
            }
            let count = items.len().min(20).min((budget / 64).max(1));
            let per_item = (budget / count).max(1);
            Value::Array(
                items
                    .iter()
                    .take(count)
                    .map(|item| project(item, per_item, depth + 1))
                    .collect(),
            )
        }
        Value::Object(map) => {
            if depth >= 8 || budget == 0 {
                return Value::Object(Map::new());
            }
            let mut entries: Vec<(&String, &Value)> = map.iter().collect();
            entries.sort_by_key(|(key, _)| key_priority(key));
            let count = entries.len().min((budget / 20).max(1));
            let per_field = (budget / count.max(1)).max(1);
            let mut out = Map::new();
            for (key, item) in entries.into_iter().take(count) {
                out.insert(key.clone(), project(item, per_field, depth + 1));
            }
            Value::Object(out)
        }
        other => other.clone(),
    }
}

fn key_priority(key: &str) -> usize {
    const CRITICAL: &[&str] = &[
        "url",
        "results",
        "content",
        "contentRange",
        "find",
        "nextCursor",
        "nextOffset",
        "title",
        "error",
    ];
    CRITICAL
        .iter()
        .position(|item| *item == key)
        .unwrap_or(CRITICAL.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::find;

    fn tool() -> &'static ToolDef {
        find("agent-tool-track-detail").expect("tool")
    }

    #[test]
    fn success_parses_json_string_output() {
        let call = success(tool(), Value::String("{\"a\":1}".into()));
        assert_eq!(call.is_error, Some(false));
        assert_eq!(call.structured_content.unwrap()["result"]["a"], json!(1));
    }

    #[test]
    fn success_keeps_plain_text() {
        let call = success(tool(), Value::String("hello".into()));
        assert_eq!(call.structured_content.unwrap()["result"], json!("hello"));
    }

    #[test]
    fn sensitive_keys_are_redacted() {
        let call = success(
            tool(),
            json!({
                "name": "song",
                "uid": 1,
                "nickname": "x",
                "userProfile": {"a": 1},
                "creator": {"nickname": "y"},
                "album": {"id": 2}
            }),
        );
        let result = &call.structured_content.unwrap()["result"];
        assert_eq!(result["name"], json!("song"));
        assert!(result.get("uid").is_none());
        assert!(result.get("nickname").is_none());
        assert!(result.get("userProfile").is_none());
        assert!(result.get("creator").is_none());
        assert_eq!(result["album"]["id"], json!(2));
    }

    #[test]
    fn long_output_is_truncated_with_meta() {
        let items: Vec<Value> = (0..2000)
            .map(|index| json!({ "id": index, "name": format!("歌单 {index} 名字很长很长"), "content": "x".repeat(200) }))
            .collect();
        let call = success(tool(), json!({ "items": items }));
        let text = match &call.content[0] {
            ContentBlock::Text(content) => content.text.clone(),
            _ => panic!("期望文本"),
        };
        assert!(
            text.chars().count() <= OUTPUT_MAX_CHARS,
            "{}",
            text.chars().count()
        );
        let structured = call.structured_content.unwrap();
        assert_eq!(structured["result"]["_meta"]["truncated"], json!(true));
    }

    #[test]
    fn long_plain_string_is_cut_with_marker() {
        let call = success(tool(), Value::String("字".repeat(30_000)));
        let text = match &call.content[0] {
            ContentBlock::Text(content) => content.text.clone(),
            _ => panic!(),
        };
        assert!(text.contains("工具结果已裁剪"));
        assert!(text.chars().count() <= OUTPUT_MAX_CHARS);
    }

    #[test]
    fn error_payload_is_structured() {
        let call = failure(tool(), &ToolError::new("timeout", "超时了"));
        assert_eq!(call.is_error, Some(true));
        let payload = call.structured_content.unwrap();
        assert_eq!(payload["ok"], json!(false));
        assert_eq!(payload["error"]["code"], json!("timeout"));
        assert_eq!(payload["error"]["retryable"], json!(true));
    }

    #[test]
    fn error_codes_mark_retryability() {
        assert!(!ToolError::new("commit_unknown", "").retryable());
        assert!(!ToolError::new("invalid_tool_call", "").retryable());
        assert!(ToolError::new("renderer_unavailable", "").retryable());
        assert!(ToolError::new("service", "").retryable());
    }
}
