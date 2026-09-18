use crate::llm::models::{ChatMessage, ChatRole};
use std::collections::HashSet;
use std::ops::Range;

/// Validates the exact outgoing sequence. Each returned group is indivisible.
pub fn message_groups(messages: &[ChatMessage]) -> anyhow::Result<Vec<Range<usize>>> {
    let mut groups = Vec::new();
    let mut index = 0;
    while index < messages.len() {
        let message = &messages[index];
        anyhow::ensure!(
            message.role != ChatRole::Inner,
            "内部日志不能发送给模型 (message {index})"
        );
        anyhow::ensure!(
            message.role != ChatRole::Tool,
            "孤立的 tool 消息 (message {index}, id {:?})",
            message.tool_call_id
        );
        anyhow::ensure!(
            message.tool_call_id.is_none(),
            "非 tool 消息携带 tool_call_id (message {index})"
        );
        let start = index;
        index += 1;
        if !message.tool_calls.is_empty() {
            anyhow::ensure!(
                message.role == ChatRole::Assistant,
                "只有 assistant 可以发起工具调用"
            );
            let mut pending = HashSet::new();
            for call in &message.tool_calls {
                anyhow::ensure!(
                    !call.id.is_empty() && !call.name.is_empty(),
                    "工具调用缺少 id 或名称"
                );
                anyhow::ensure!(
                    pending.insert(call.id.as_str()),
                    "重复的工具调用 id: {}",
                    call.id
                );
            }
            while !pending.is_empty() {
                let result = messages
                    .get(index)
                    .ok_or_else(|| anyhow::anyhow!("工具调用缺少结果: {pending:?}"))?;
                anyhow::ensure!(
                    result.role == ChatRole::Tool,
                    "工具调用尚未完成，不能插入其他消息 (message {index})"
                );
                anyhow::ensure!(result.tool_calls.is_empty(), "tool 结果不能发起工具调用");
                let id = result.tool_call_id.as_deref().unwrap_or_default();
                anyhow::ensure!(pending.remove(id), "工具结果 id 不匹配或重复: {id}");
                index += 1;
            }
        }
        groups.push(start..index);
    }
    Ok(groups)
}

pub fn validate_messages(messages: &[ChatMessage]) -> anyhow::Result<()> {
    message_groups(messages).map(|_| ())
}
