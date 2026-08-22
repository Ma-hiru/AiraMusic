use crate::llm::models::{
    ChatMessage, LLMAdapter, LLMConfig, LLMProvider, LlmStream, Request, Role, StreamEvent, Usage,
};
use crate::tools::models::Tool;
use async_openai::{
    Client,
    config::OpenAIConfig,
    types::chat::*,
    types::chat::{FinishReason, FunctionCall},
};
use async_stream::stream;
use backon::Retryable;
use futures::StreamExt;
use reqwest::header::{HeaderName, HeaderValue};
use std::str::FromStr;
use std::{collections::HashMap, sync::Arc};

pub struct OpenAiAdapter;
impl OpenAiAdapter {
    fn inner_msg_2_openai_msg(messages: &[ChatMessage]) -> Vec<ChatCompletionRequestMessage> {
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
                            args.tool_calls(
                                m.tool_calls
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
                                    .collect::<Vec<_>>(),
                            );
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

    fn finish_reason_2_string(reason: &FinishReason) -> String {
        match reason {
            FinishReason::Stop => "stop".into(),
            FinishReason::Length => "length".into(),
            FinishReason::ToolCalls => "tool_calls".into(),
            FinishReason::ContentFilter => "content_filter".into(),
            FinishReason::FunctionCall => "function_call".into(),
        }
    }

    fn inner_tool_2_openai_tools(tools: &[Arc<dyn Tool>]) -> Vec<ChatCompletionTools> {
        tools
            .iter()
            .filter_map(|tool| {
                Some(ChatCompletionTools::Function(ChatCompletionTool {
                    function: FunctionObjectArgs::default()
                        .name(tool.name())
                        .description(tool.description())
                        .parameters(tool.parameters())
                        .build()
                        .ok()?,
                }))
            })
            .collect()
    }

    fn build_openai_config(config: &LLMConfig) -> anyhow::Result<OpenAIConfig> {
        let mut cfg = OpenAIConfig::default().with_api_key(config.api_key.as_str());
        if let Some(url) = &config.base_url {
            cfg = cfg.with_api_base(url.as_str());
        }
        if let Some(headers) = &config.headers {
            for (key, value) in headers {
                let name = HeaderName::from_str(key.as_str())
                    .map_err(|e| anyhow::anyhow!("llm-openai: 非法请求头名 {key}: {e}"))?;
                let value = HeaderValue::from_str(value.as_str())
                    .map_err(|e| anyhow::anyhow!("llm-openai: 非法请求头值 {key}: {e}"))?;
                cfg = cfg
                    .with_header(name, value.as_ref())
                    .map_err(|err| anyhow::anyhow!("llm-openai: 设置请求头 {key} 失败: {err}"))?;
            }
        }
        Ok(cfg)
    }
}
impl LLMAdapter for OpenAiAdapter {
    fn stream<'a>(&'a self, request: &'a Request) -> LlmStream<'a> {
        Box::pin(stream! {
            // 检查: 取消 + 配置
            if request.cancel.is_cancelled() {
                yield Err(anyhow::anyhow!("llm-openai: 请求已被取消"));
                return;
            }
            if request.config.provider != LLMProvider::OpenAI  {
                yield Err(anyhow::anyhow!("llm-openai: 请求配置不匹配(Request.config.provider != LLMProvider::OpenAI)"));
                return;
            }
            if request.config.model.is_empty() {
                yield Err(anyhow::anyhow!("llm-openai: 请求缺少模型名(Request.model 为空)"));
                return;
            }

            let mut messages = Vec::new();
            // 系统消息
            if !request.system.is_empty() {
                messages.push(
                    ChatCompletionRequestSystemMessageArgs::default()
                        .content(request.system.join("\n\n"))
                        .build()?
                        .into(),
                );
            } else {
                tracing::warn!(model = %request.config.model, "请求缺少系统消息(Request.system 为空)");
            }
            // 用户消息
            messages.extend(Self::inner_msg_2_openai_msg(&request.messages));
            // 工具定义
            let tool_defs = Self::inner_tool_2_openai_tools(&request.tools);

            // 创建 openai 流请求
            tracing::info!(model = %request.config.model, "创建 openai 流");
            let openai_request = CreateChatCompletionRequestArgs::default()
                .model(&request.config.model)
                .messages(messages)
                .tools(tool_defs)
                .stream(true)
                .build()?;
            // 创建 client
            let client = Client::with_config(Self::build_openai_config(&request.config)?);
            // 创建流(每次重试前检查取消)
            let mut stream = match (|| async {
                request.cancel.check()?;
                Ok::<_, anyhow::Error>(client.chat().create_stream(openai_request.clone()).await?)
            })
            .retry(backon::ExponentialBuilder::default().with_jitter().with_max_times(3))
            .await
            {
                Ok(stream) => stream,
                Err(error) => {
                    yield Err(error);
                    return;
                }
            };

            // 工具调用状态跟踪 (index → (id, name, args, started, finished))
            let mut tool_states: HashMap<u32, (String, String, String, bool, bool)> = HashMap::new();
            let mut text_started = false;
            let mut finish_reason: Option<String> = None;

            loop {
                let result = tokio::select! {
                    biased;
                    _ = request.cancel.cancelled() => {
                        yield Err(anyhow::anyhow!("llm-openai: 请求已被取消"));
                        return;
                    }
                    result = stream.next() => result,
                };
                let Some(result) = result else { break };
                let chunk = match result {
                    Ok(chunk) => chunk,
                    Err(error) => {
                        yield Err(error.into());
                        continue;
                    }
                };

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
                                // (id, name, args, started, finished)
                                (tc.id.clone().unwrap_or_default(), tc.function.clone().and_then(|f| f.name.clone()).unwrap_or_default(), String::new(), false, false)
                            });
                            // 3 → 是否已发 start
                            if !state.3 {
                                // 第一次见到, 名字通常随第一片到
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
                        finish_reason = Some(Self::finish_reason_2_string(reason));
                    }
                }
            }

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
