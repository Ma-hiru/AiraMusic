use crate::context::models::ContextPolicy;
use crate::llm::models::{ChatRequest, LLMConfig, token_count};

#[derive(Clone, Debug, Default)]
pub struct ContextUsage {
    pub system: usize,
    pub messages: usize,
    pub tools: usize,
}

impl ContextUsage {
    pub fn total(&self) -> usize {
        self.system
            .saturating_add(self.messages)
            .saturating_add(self.tools)
            .saturating_add(16)
    }
}

pub fn estimate_request(request: &ChatRequest) -> ContextUsage {
    ContextUsage {
        system: token_count(&request.system.join("\n\n")) + 8,
        messages: request
            .messages
            .iter()
            .map(|message| message.token_count())
            .sum(),
        tools: request
            .tools
            .iter()
            .map(|tool| {
                token_count(
                    &serde_json::json!({
                        "type": "function", "function": {
                            "name": tool.name(), "description": tool.description(),
                            "parameters": tool.parameters(),
                        }
                    })
                    .to_string(),
                ) + 8
            })
            .sum(),
    }
}

pub(crate) fn input_budget(config: &LLMConfig, policy: &ContextPolicy) -> anyhow::Result<usize> {
    let context: usize = config.context_size.into();
    let output = config.output_limit() as usize;
    anyhow::ensure!(output > 0, "模型输出上限必须大于零");
    // Small models need proportionally smaller reserves; explicit output limits remain binding.
    let buffer = policy.safety_buffer.min(context / 8);
    let available = context
        .saturating_sub(output)
        .min(config.input_limit.unwrap_or(context));
    let budget = available.saturating_sub(buffer);
    anyhow::ensure!(budget > 0, "模型上下文不足以容纳输出预留和安全余量");
    Ok(budget)
}

pub(crate) fn summary_limit(config: &LLMConfig, policy: &ContextPolicy) -> usize {
    let context: usize = config.context_size.into();
    policy.summary_output_tokens.min(context / 8).max(1)
}
