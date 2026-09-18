use crate::context::observation::{excerpt, prefix};
use crate::llm::models::{ChatMessage, ChatRole, token_count};
use serde_json::{Value, json};

/// Searches primary conversation messages by default, avoiding recursive search-result expansion.
pub fn search_history(
    messages: &[ChatMessage],
    keywords: &[String],
    max_results: u32,
    after_seq: u64,
    include_tools: bool,
) -> Value {
    let mut results = Vec::new();
    let mut used = 64;
    let mut next_after_seq = None;
    let limit = max_results.clamp(1, 20) as usize;
    let keywords: Vec<_> = keywords
        .iter()
        .filter(|keyword| !keyword.trim().is_empty())
        .collect();
    for (index, message) in messages.iter().enumerate() {
        let seq = index as u64 + 1;
        if seq <= after_seq
            || message.role == ChatRole::Inner
            || message.role == ChatRole::System
            || (!include_tools && message.role == ChatRole::Tool)
        {
            continue;
        }
        let matched = keywords
            .iter()
            .filter_map(|keyword| message.content.find(keyword.as_str()))
            .min();
        let Some(position) = matched else {
            continue;
        };
        if results.len() >= limit {
            next_after_seq = Some(seq - 1);
            break;
        }
        let start = message.content[..position]
            .char_indices()
            .rev()
            .nth(120)
            .map_or(0, |(byte, _)| byte);
        let snippet = excerpt(&message.content[start..], 256);
        let item = json!({ "message_seq": seq, "role": message.role,
            "excerpt": snippet, "truncated": start > 0 || snippet != message.content,
            "read_tool": "read-history" });
        let tokens = token_count(&item.to_string());
        if used + tokens > 2_048 {
            next_after_seq = Some(seq - 1);
            break;
        }
        used += tokens;
        results.push(item);
    }
    json!({ "results": results, "next_after_seq": next_after_seq })
}

/// Offset is measured in Unicode characters. Content is an exact slice, never a generated summary.
pub fn read_history(
    messages: &[ChatMessage],
    seq: u64,
    offset: usize,
    max_tokens: usize,
) -> anyhow::Result<Value> {
    let index = usize::try_from(
        seq.checked_sub(1)
            .ok_or_else(|| anyhow::anyhow!("message_seq 从 1 开始"))?,
    )?;
    let message = messages
        .get(index)
        .ok_or_else(|| anyhow::anyhow!("历史消息 {seq} 不存在"))?;
    let total_chars = message.content.chars().count();
    anyhow::ensure!(offset <= total_chars, "offset 超出消息长度");
    let rest: String = message.content.chars().skip(offset).collect();
    let (content, _) = prefix(&rest, max_tokens.clamp(16, 4_096));
    let end = offset + content.chars().count();
    Ok(
        json!({ "message_seq": seq, "role": message.role, "tool_call_id": message.tool_call_id,
        "content": content, "offset": offset, "next_offset": (end < total_chars).then_some(end),
        "total_chars": total_chars }),
    )
}
