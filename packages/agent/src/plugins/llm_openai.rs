//! 角色: 提供者 —— 真模型适配器(async-openai, 流式)。
//!
//! 用法: 把 main.rs 里的 llm-fake 行换成
//!   { id: "llm-openai", plugin: Arc::new(LlmOpenAiPlugin),
//!     config: json!({ "model": constants::DEEPSEEK_V4_FLASH }) }
//! 密钥与地址从环境变量读(优先级: config > DEEPSEEK_* > OPENAI_*):
//!   DEEPSEEK_API_KEY / OPENAI_API_KEY, DEEPSEEK_BASE_URL / OPENAI_BASE_URL
//!
//! 职责(和 demo 的 llm 一致, 用 async-openai + tracing + backon 重试):
//!   ① 把 Request 翻译成 openai 请求(消息/工具)
//!   ② 建流(带重试)+ 把 openai 流翻译成 StreamEvent
//!   循环只认识 StreamEvent —— 厂商差异全部关在这个插件里。

use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;
use async_openai::Client;
use async_openai::config::OpenAIConfig;
use async_openai::types::chat::{
    ChatCompletionMessageToolCall, ChatCompletionMessageToolCalls,
    ChatCompletionRequestAssistantMessageArgs, ChatCompletionRequestMessage,
    ChatCompletionRequestSystemMessageArgs, ChatCompletionRequestToolMessageArgs,
    ChatCompletionRequestUserMessageArgs, ChatCompletionTool, ChatCompletionTools,
    CreateChatCompletionRequestArgs, FunctionObjectArgs,
};
use async_openai::types::chat::{FinishReason, FunctionCall};
use async_stream::stream;
use backon::Retryable;
use futures::StreamExt;
use serde::Deserialize;
use serde_json::Value;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use crate::plugins::tools::Tool;
use crate::shared::llm::{LlmAdapter, LlmStream, StreamEvent, Usage};
use crate::shared::message::{ChatMessage, Request, Role};

/// 本插件的配置(全部可选, 缺省走环境变量)。
/// 注意: 模型名不在这里 —— 它来自请求(Request.model, 由循环默认值
/// 或路由插件决定); 适配器是"无状态的路由执行者"。
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LlmOpenAiConfig {
    /// 显式 API key(缺省读 DEEPSEEK_API_KEY / OPENAI_API_KEY)。
    pub api_key: Option<String>,
    /// 显式 base url(缺省读 DEEPSEEK_BASE_URL / OPENAI_BASE_URL)。
    pub base_url: Option<String>,
}

/// 插件本体。
pub struct LlmOpenAiPlugin;

impl Plugin for LlmOpenAiPlugin {
    fn name(&self) -> &'static str {
        "llm-openai"
    }

    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> Result<Option<Disposer>> {
        let config: LlmOpenAiConfig = serde_json::from_value(config)?;

        // 密钥/地址: config 显式 > DEEPSEEK_* 环境变量 > OPENAI_* 环境变量
        let env_or = |deepseek: &str, openai: &str| {
            std::env::var(deepseek)
                .ok()
                .or_else(|| std::env::var(openai).ok())
        };
        let api_key = config
            .api_key
            .clone()
            .or_else(|| env_or("DEEPSEEK_API_KEY", "OPENAI_API_KEY"));
        let base_url = config
            .base_url
            .clone()
            .or_else(|| env_or("DEEPSEEK_BASE_URL", "OPENAI_BASE_URL"));

        let openai_config = match (api_key, base_url) {
            (None, None) => OpenAIConfig::default(), // 全部走 openai 默认环境变量
            (key, base) => {
                let mut cfg = OpenAIConfig::default();
                if let Some(key) = key {
                    cfg = cfg.with_api_key(key);
                }
                if let Some(base) = base {
                    cfg = cfg.with_api_base(base);
                }
                cfg
            }
        };
        let adapter: Arc<dyn LlmAdapter> = Arc::new(OpenAiLlm {
            client: Client::with_config(openai_config),
        });
        let receipt = ctx.provide("llm", adapter)?;
        Ok(Some(receipt))
    }
}

/// 真模型适配器(无状态: 模型名每次从请求里取)。
struct OpenAiLlm {
    client: Client<OpenAIConfig>,
}

/// 共享消息 → openai 消息。
fn to_openai_messages(messages: &[ChatMessage]) -> Vec<ChatCompletionRequestMessage> {
    messages
        .iter()
        .filter_map(|m| {
            let message: ChatCompletionRequestMessage = match m.role {
                Role::System => ChatCompletionRequestSystemMessageArgs::default()
                    .content(m.content.as_str())
                    .build()
                    .ok()?
                    .into(),
                Role::User => ChatCompletionRequestUserMessageArgs::default()
                    .content(m.content.as_str())
                    .build()
                    .ok()?
                    .into(),
                Role::Assistant => {
                    let mut args = ChatCompletionRequestAssistantMessageArgs::default();
                    args.content(m.content.as_str());
                    if !m.tool_calls.is_empty() {
                        // 回放助手消息时必须带上工具调用
                        let calls = m
                            .tool_calls
                            .iter()
                            .map(|c| {
                                ChatCompletionMessageToolCalls::Function(
                                    ChatCompletionMessageToolCall {
                                        id: c.id.clone(),
                                        function: FunctionCall {
                                            name: c.name.clone(),
                                            arguments: c.args.to_string(),
                                        },
                                    },
                                )
                            })
                            .collect::<Vec<_>>();
                        args.tool_calls(calls);
                    }
                    args.build().ok()?.into()
                }
                Role::Tool => ChatCompletionRequestToolMessageArgs::default()
                    .content(m.content.as_str())
                    .tool_call_id(m.tool_call_id.clone()?)
                    .build()
                    .ok()?
                    .into(),
            };
            Some(message)
        })
        .collect()
}

/// FinishReason → 字符串(该枚举没有 Display, 手动映射)。
fn finish_reason_to_string(reason: &FinishReason) -> String {
    match reason {
        FinishReason::Stop => "stop".into(),
        FinishReason::Length => "length".into(),
        FinishReason::ToolCalls => "tool_calls".into(),
        FinishReason::ContentFilter => "content_filter".into(),
        FinishReason::FunctionCall => "function_call".into(),
    }
}

/// 工具清单 → openai 工具定义。
fn to_openai_tools(tools: &[Arc<dyn Tool>]) -> Vec<ChatCompletionTools> {
    tools
        .iter()
        .filter_map(|tool| {
            let function = FunctionObjectArgs::default()
                .name(tool.name())
                .description(tool.description())
                .parameters(tool.parameters())
                .build()
                .ok()?;
            Some(ChatCompletionTools::Function(ChatCompletionTool {
                function,
            }))
        })
        .collect()
}

impl LlmAdapter for OpenAiLlm {
    fn stream<'a>(&'a self, request: &'a Request) -> LlmStream<'a> {
        Box::pin(stream! {
            // ① 翻译请求
            let mut messages = Vec::new();
            if !request.system.is_empty() {
                messages.push(
                    ChatCompletionRequestSystemMessageArgs::default()
                        .content(request.system.join("\n\n"))
                        .build()?
                        .into(),
                );
            }
            messages.extend(to_openai_messages(&request.messages));
            let tool_defs = to_openai_tools(&request.tools);

            if request.model.is_empty() {
                yield Err(anyhow::anyhow!("llm-openai: 请求缺少模型名(Request.model 为空)"));
                return;
            }
            let openai_request = CreateChatCompletionRequestArgs::default()
                .model(&request.model)
                .messages(messages)
                .tools(tool_defs)
                .stream(true)
                .build()?;

            // ② 建流(带重试, 同 demo 的 backon 方案)
            tracing::debug!(model = %request.model, "创建 openai 流");
            let mut stream = match (|| async {
                self.client.chat().create_stream(openai_request.clone()).await
            })
            .retry(backon::ExponentialBuilder::default().with_max_times(3))
            .await
            {
                Ok(stream) => stream,
                Err(error) => {
                    yield Err(error.into());
                    return;
                }
            };

            // ③ 消费并翻译
            // index -> (id, name, args 片段, 是否已发 start, 是否已发 end)
            let mut tool_states: HashMap<u32, (String, String, String, bool, bool)> = HashMap::new();
            let mut text_started = false;
            let mut finish_reason: Option<String> = None;

            while let Some(result) = stream.next().await {
                let chunk = match result {
                    Ok(chunk) => chunk,
                    Err(error) => {
                        yield Err(error.into());
                        continue;
                    }
                };

                // 用量(厂商开了 include_usage 才可能带; 没带就留在 Done 前为 None)
                if let Some(usage) = chunk.usage {
                    yield Ok(StreamEvent::Usage(Usage {
                        prompt_tokens: usage.prompt_tokens,
                        completion_tokens: usage.completion_tokens,
                    }));
                }

                for choice in &chunk.choices {
                    // 文本增量
                    if let Some(content) = &choice.delta.content {
                        if !text_started {
                            text_started = true;
                            yield Ok(StreamEvent::TextStart);
                        }
                        yield Ok(StreamEvent::TextDelta { text: content.clone() });
                    }

                    // 工具调用增量(按 index 跟踪)
                    if let Some(tool_chunks) = &choice.delta.tool_calls {
                        for tc in tool_chunks {
                            let index = tc.index;
                            let state = tool_states.entry(index).or_insert_with(|| {
                                (tc.id.clone().unwrap_or_default(), String::new(), String::new(), false, false)
                            });
                            if !state.3 {
                                // 第一次见到: 发 start(名字通常随第一片到)
                                state.3 = true;
                                yield Ok(StreamEvent::ToolCallStart {
                                    id: state.0.clone(),
                                    name: state.1.clone(),
                                });
                            }
                            if let Some(function) = &tc.function {
                                if let Some(name) = &function.name {
                                    state.1 = name.clone();
                                }
                                if let Some(args) = &function.arguments {
                                    state.2.push_str(args);
                                    yield Ok(StreamEvent::ToolCallArgs {
                                        id: state.0.clone(),
                                        delta: args.clone(),
                                    });
                                }
                            }
                        }
                    }

                    // 结束原因(整个 choice 流结束)
                    if let Some(reason) = &choice.finish_reason {
                        finish_reason = Some(finish_reason_to_string(reason));
                    }
                }
            }

            // ④ 收尾: 文本结束 + 工具调用结束(参数收齐) + Done
            if text_started {
                yield Ok(StreamEvent::TextEnd);
            }
            for (_index, state) in tool_states {
                if !state.4 {
                    yield Ok(StreamEvent::ToolCallEnd { id: state.0 });
                }
            }
            yield Ok(StreamEvent::Done { finish_reason });
        })
    }
}
