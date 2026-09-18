use crate::context::models::HistoryMessage;
use crate::llm::models::{ChatRole, token_count};

/// Returns an exact UTF-8 prefix within the token budget, plus its byte length.
pub(crate) fn prefix(text: &str, budget: usize) -> (&str, usize) {
    if token_count(text) <= budget {
        return (text, text.len());
    }
    let ends: Vec<usize> = text
        .char_indices()
        .map(|(index, _)| index)
        .chain(std::iter::once(text.len()))
        .collect();
    let (mut low, mut high) = (0, ends.len() - 1);
    while low < high {
        let mid = (low + high).div_ceil(2);
        if token_count(&text[..ends[mid]]) <= budget {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    (&text[..ends[low]], ends[low])
}

pub(crate) fn excerpt(text: &str, budget: usize) -> String {
    if token_count(text) <= budget {
        return text.to_string();
    }
    let (head, _) = prefix(text, budget.saturating_sub(16) / 2);
    let reversed: String = text.chars().rev().collect();
    let (tail, _) = prefix(&reversed, budget.saturating_sub(16) / 2);
    let tail: String = tail.chars().rev().collect();
    let candidate = format!("{head}\n…[已省略]…\n{tail}");
    prefix(&candidate, budget).0.to_string()
}

pub(crate) fn reduce_tools(
    records: &mut [HistoryMessage],
    latest_group_start: usize,
    fresh: usize,
    stale: usize,
) {
    for (index, record) in records.iter_mut().enumerate() {
        if record.message.role != ChatRole::Tool {
            continue;
        }
        let limit = if index >= latest_group_start {
            fresh
        } else {
            stale
        };
        if token_count(&record.message.content) <= limit {
            continue;
        }
        // Only the model-facing copy changes. Raw content remains addressable by seq.
        let marker = format!(
            "\n[结果已截短；用 read-history 读取 message_seq={} 的原文，可按 offset 分页]",
            record.seq
        );
        let preview = excerpt(
            &record.message.content,
            limit.saturating_sub(token_count(&marker)),
        );
        record.message.content = format!("{preview}{marker}");
    }
}
