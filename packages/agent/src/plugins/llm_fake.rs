//! 角色: 提供者 —— 把"模型"挂上公告板(这里是个脚本假模型, 流式)。
//!
//! 假模型的"剧本": 只看请求里最后一条消息。
//!   最后一条是工具结果 → 报出答案(文本流), 结束这一轮;
//!   否则             → 假装要调用 add 工具(文本流 + 工具调用流)。
//! 输出形态与真模型完全一致: TextStart/Delta/End + ToolCallStart/Args/End + Done,
//! 所以换真模型 = 把 main.rs 里这一行换成 llm-openai, 循环一行不用动。

use std::sync::{Arc, Mutex};

use anyhow::Result;
use async_stream::stream;
use serde::Deserialize;
use serde_json::Value;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use crate::shared::llm::{LlmAdapter, LlmStream, StreamEvent, Usage};
use crate::shared::message::{Request, Role};

/// 本插件的配置: 从 main.rs 清单里 llm-fake 行的 config 解析而来。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")] // JSON 键用驼峰: modelName
pub struct LlmFakeConfig {
    /// 假模型的名字(会出现在它的回答里, 方便看出"配置生效了")。
    pub model_name: String,
}

/// 插件本体。
pub struct LlmFakePlugin;

impl Plugin for LlmFakePlugin {
    /// 我是谁。
    fn name(&self) -> &'static str {
        "llm-fake"
    }

    /// 我要干什么: 造一个假模型, 挂成 "llm" 服务。
    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> Result<Option<Disposer>> {
        let config: LlmFakeConfig = serde_json::from_value(config)?;
        let adapter: Arc<dyn LlmAdapter> = Arc::new(FakeLlm {
            model_name: config.model_name,
            counter: Mutex::new(0),
        });
        let receipt = ctx.provide("llm", adapter)?;
        Ok(Some(receipt))
    }
}

/// 假模型本体。
struct FakeLlm {
    /// 模型名(回显用)。
    model_name: String,
    /// 工具调用编号计数器(每次 +1, 保证 call-id 不重复)。
    counter: Mutex<u32>,
}

impl LlmAdapter for FakeLlm {
    fn stream<'a>(&'a self, request: &'a Request) -> LlmStream<'a> {
        Box::pin(stream! {
            let last = request.messages.last();
            let is_answer = matches!(last, Some(m) if m.role == Role::Tool);
            // 回显的模型名: 请求里被路由改过的优先, 否则用插件配置的。
            let model = if request.model.is_empty() {
                self.model_name.as_str()
            } else {
                request.model.as_str()
            };

            if is_answer {
                // 剧本一: 工具已经跑完 → 报出答案, 结束这一轮。
                let text = format!(
                    "答案是 {}。(模型 {}, 系统提示 {} 段)",
                    last.map(|m| m.content.as_str()).unwrap_or("?"),
                    model,
                    request.system.len()
                );
                yield Ok(StreamEvent::TextStart);
                // 拆成小片, 模拟真实流式输出
                for chunk in text.chars().collect::<Vec<_>>().chunks(4) {
                    yield Ok(StreamEvent::TextDelta { text: chunk.iter().collect() });
                }
                yield Ok(StreamEvent::TextEnd);
                yield Ok(StreamEvent::Usage(Usage { prompt_tokens: 12, completion_tokens: 8 }));
                yield Ok(StreamEvent::Done { finish_reason: Some("stop".into()) });
            } else {
                // 剧本二: 假装要调 add 工具(文本流 + 工具调用流)。
                // 编号计算放在独立作用域里: 锁不能跨 yield。
                let id = {
                    let mut counter = self.counter.lock().unwrap();
                    *counter += 1;
                    format!("call-{counter}")
                };
                yield Ok(StreamEvent::TextStart);
                let text = format!("我来算一下。(模型 {model})");
                for chunk in text.chars().collect::<Vec<_>>().chunks(4) {
                    yield Ok(StreamEvent::TextDelta { text: chunk.iter().collect() });
                }
                yield Ok(StreamEvent::TextEnd);
                yield Ok(StreamEvent::ToolCallStart { id: id.clone(), name: "add".into() });
                yield Ok(StreamEvent::ToolCallArgs { id: id.clone(), delta: "{\"a\":1,\"b\":2}".into() });
                yield Ok(StreamEvent::ToolCallEnd { id: id.clone() });
                yield Ok(StreamEvent::Usage(Usage { prompt_tokens: 12, completion_tokens: 8 }));
                yield Ok(StreamEvent::Done { finish_reason: Some("tool_calls".into()) });
            }
        })
    }
}
