use crate::llm::models::ChatToolCall;
use serde_json::Value;

const MAX_STALLED_STEPS: usize = 3;

#[derive(PartialEq)]
pub(super) struct ToolOutcome {
    name: String,
    args: Value,
    result: String,
    succeeded: bool,
}

impl ToolOutcome {
    pub(super) fn new(call: &ChatToolCall, result: &str, succeeded: bool) -> Self {
        Self {
            name: call.name.clone(),
            args: call.args.clone(),
            result: result.to_string(),
            succeeded,
        }
    }
}

#[derive(Default)]
pub(super) struct ToolProgress {
    failed_steps: usize,
    repeated_steps: usize,
    previous: Vec<ToolOutcome>,
}

impl ToolProgress {
    pub(super) fn observe(&mut self, outcomes: Vec<ToolOutcome>) -> Option<&'static str> {
        if outcomes.is_empty() {
            self.failed_steps = 0;
            self.repeated_steps = 0;
            self.previous.clear();
            return None;
        }
        if outcomes.iter().any(|outcome| outcome.succeeded) {
            self.failed_steps = 0;
        } else {
            self.failed_steps += 1;
        }
        if self.repeats(&outcomes) {
            self.repeated_steps += 1;
        } else {
            self.repeated_steps = 1;
        }
        self.previous = outcomes;
        if self.failed_steps >= MAX_STALLED_STEPS {
            return Some("工具调用连续 3 步全部失败，已停止本轮；请根据工具错误修正请求后重试");
        }
        if self.repeated_steps >= MAX_STALLED_STEPS {
            return Some("相同工具与参数连续 3 步返回相同结果，未取得进展，已停止重复调用");
        }
        None
    }

    fn repeats(&self, outcomes: &[ToolOutcome]) -> bool {
        if outcomes.len() != self.previous.len() {
            return false;
        }
        // 同批工具的顺序与 call ID 都不表示新进展，参数和实际结果才是。
        let mut matched = vec![false; outcomes.len()];
        self.previous.iter().all(|previous| {
            let found = outcomes
                .iter()
                .enumerate()
                .find(|(index, outcome)| !matched[*index] && previous == *outcome);
            if let Some((index, _)) = found {
                matched[index] = true;
                true
            } else {
                false
            }
        })
    }
}
