use crate::llm::models::{
    ChatMessage, LLMAdapter, LLMProvider, LlmStream, Request, Role, StreamEvent, Usage,
};
use crate::tools::models::Tool;
use crate::utils::LLMSSEDecoder;
use async_openai::types::chat::FunctionCall;
use async_openai::types::chat::*;
use async_stream::stream;
use backon::Retryable;
use futures::StreamExt;
use reqwest::header::{HeaderName, HeaderValue};
use serde_json::Value;
use std::str::FromStr;
use std::{collections::HashMap, sync::Arc};

pub struct OpenAiAdapter;
impl OpenAiAdapter {
    /// ChatMessage → openai 消息 + 该消息要回传的思考内容(仅 assistant 会有)
    fn inner_msg_2_openai_msg(
        messages: &[ChatMessage],
    ) -> Vec<(ChatCompletionRequestMessage, Option<String>)> {
        messages
            .iter()
            .filter_map(|m| {
                let reasoning = m.reasoning_content.clone();
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
                    // 理论上不会把内部消息转换为 system 消息，这里保留为以后策略扩展
                    Role::Inner => ChatCompletionRequestSystemMessageArgs::default()
                        .content(m.content.as_str())
                        .build()
                        .ok()?
                        .into(),
                };
                Some((message, reasoning))
            })
            .collect()
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

    fn finish_reason_2_string(reason: &FinishReason) -> String {
        match reason {
            FinishReason::Stop => "stop".into(),
            FinishReason::Length => "length".into(),
            FinishReason::ToolCalls => "tool_calls".into(),
            FinishReason::ContentFilter => "content_filter".into(),
            FinishReason::FunctionCall => "function_call".into(),
        }
    }

    /// 原有字段用 serde 直接反序列化成 async-openai 的类型(未知字段被忽略)
    /// 拓展字段(reasoning_content)手工补齐
    fn parse_stream_chunk(value: Value) -> Option<StreamChunk> {
        let inner: CreateChatCompletionStreamResponse =
            serde_json::from_value(value.clone()).ok()?;
        // 拓展字段: choices[*].delta.reasoning_content(取第一个非空的)
        let reasoning_delta = value
            .get("choices")
            .and_then(|choices| choices.as_array())
            .and_then(|choices| {
                choices.iter().find_map(|choice| {
                    choice
                        .get("delta")
                        .and_then(|delta| delta.get("reasoning_content"))
                        .and_then(|v| v.as_str())
                        .filter(|s| !s.is_empty())
                        .map(|s| s.to_string())
                })
            });
        Some(StreamChunk {
            inner,
            reasoning_delta,
        })
    }
}

/// 一个 SSE 事件的类型化结果
struct StreamChunk {
    /// async-openai 类型化(choices / delta / tool_calls / usage / finish_reason)
    inner: CreateChatCompletionStreamResponse,
    /// 拓展字段,思考增量(思考模式才有)
    reasoning_delta: Option<String>,
}
impl LLMAdapter for OpenAiAdapter {
    fn stream<'a>(&'a self, request: &'a Request) -> LlmStream<'a> {
        Box::pin(stream! {
            // 检查: 取消 + 配置
            if request.cancel.is_cancelled() {
                yield Err(anyhow::anyhow!("llm-openai: 请求已被取消"));
                return;
            }
            if request.config.provider != LLMProvider::OpenAI {
                yield Err(anyhow::anyhow!(
                    "llm-openai: 请求配置不匹配(Request.config.provider != LLMProvider::OpenAI)"
                ));
                return;
            }
            if request.config.model.is_empty() {
                yield Err(anyhow::anyhow!(
                    "llm-openai: 请求缺少模型名(Request.model 为空)"
                ));
                return;
            }

            // 用 async-openai 构造请求结构(tools/messages 序列化照旧),
            // 再序列化成 JSON, 手工注入它不建模的思考扩展字段
            tracing::info!(model = %request.config.model, "创建 openai 流");
            let openai_request = CreateChatCompletionRequestArgs::default()
                .model(&request.config.model)
                .messages(vec![]) // 占位: 下面用带 reasoning_content 的消息数组覆盖
                .tools(Self::inner_tool_2_openai_tools(&request.tools))
                .stream(true)
                .build()?;
            let mut body = serde_json::to_value(&openai_request)?;

            // 重建 messages: 系统 + 会话消息; assistant 消息补 reasoning_content
            // (思考模式多轮对话必须随历史回传, 否则 deepseek 返回 400)
            let converted = Self::inner_msg_2_openai_msg(&request.messages);
            let mut body_messages: Vec<Value> = Vec::new();
            if !request.system.is_empty() {
                let system_msg: ChatCompletionRequestMessage =
                    ChatCompletionRequestSystemMessageArgs::default()
                        .content(request.system.join("\n\n"))
                        .build()?
                        .into();
                body_messages.push(serde_json::to_value(&system_msg)?);
            } else {
                tracing::warn!(model = %request.config.model, "请求缺少系统消息(Request.system 为空)");
            }
            for (message, reasoning) in converted {
                let mut value = serde_json::to_value(&message)?;
                if let Some(reasoning) = reasoning {
                    value["reasoning_content"] = Value::String(reasoning);
                }
                body_messages.push(value);
            }
            body["messages"] = Value::Array(body_messages);

            // 思考模式开关(async-openai 无 thinking 参数)
            if request.config.thinking {
                body["thinking"] = serde_json::json!({ "type": "enabled" });
            }

            // 发送(每次重试前检查取消; 连接级错误才重试)
            let base_url = request
                .config
                .base_url
                .clone()
                .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
            let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
            let client = reqwest::Client::new();
            let response = match (|| async {
                request.cancel.check()?;
                let mut builder = client
                    .post(&url)
                    .bearer_auth(&request.config.api_key)
                    .json(&body);
                if let Some(headers) = &request.config.headers {
                    for (key, value) in headers {
                        builder = builder.header(
                            HeaderName::from_str(key).map_err(|e| {
                                anyhow::anyhow!("llm-openai: 非法请求头名 {key}: {e}")
                            })?,
                            HeaderValue::from_str(value).map_err(|e| {
                                anyhow::anyhow!("llm-openai: 非法请求头值 {key}: {e}")
                            })?,
                        );
                    }
                }
                Ok::<_, anyhow::Error>(builder.send().await?)
            })
            .retry(
                backon::ExponentialBuilder::default()
                    .with_jitter()
                    .with_max_times(3),
            )
            .await
            {
                Ok(response) => response,
                Err(error) => {
                    yield Err(error);
                    return;
                }
            };
            if !response.status().is_success() {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                yield Err(anyhow::anyhow!("llm-openai: {status}: {text}"));
                return;
            }

            // SSE
            let mut tool_states: HashMap<u32, (String, String, String, bool)> = HashMap::new();
            let mut text_started = false;
            let mut reasoning_started = false;
            let mut finish_reason: Option<String> = None;
            let mut decoder = LLMSSEDecoder::new();
            let mut byte_stream = response.bytes_stream();
            loop {
                let chunk = tokio::select! {
                    biased;
                    _ = request.cancel.cancelled() => {
                        yield Err(anyhow::anyhow!("llm-openai: 请求已被取消"));
                        return;
                    }
                    chunk = byte_stream.next() => chunk,
                };
                let Some(chunk) = chunk else { break };
                let chunk = match chunk {
                    Ok(chunk) => chunk,
                    Err(error) => {
                        yield Err(error.into());
                        continue;
                    }
                };
                // 半截事件留在解码器内部, 这里只拿完整 JSON 事件
                for value in decoder.feed(&chunk) {
                    let Some(stream_chunk) = Self::parse_stream_chunk(value) else {
                        continue; // 反序列化失败的事件(防御)直接跳过
                    };
                    let chunk = stream_chunk.inner;

                    // 用量(流尾 chunk)
                    if let Some(usage) = chunk.usage {
                        yield Ok(StreamEvent::Usage(Usage {
                            prompt_tokens: usage.prompt_tokens,
                            completion_tokens: usage.completion_tokens,
                        }));
                    }

                    // 思考增量(拓展字段, 思考模式才有)
                    if let Some(reasoning) = stream_chunk.reasoning_delta {
                        if !reasoning_started {
                            reasoning_started = true;
                            yield Ok(StreamEvent::ReasoningStart);
                        }
                        yield Ok(StreamEvent::ReasoningDelta { delta: reasoning });
                    }

                    for choice in &chunk.choices {
                        // 文本增量
                        if let Some(content) = &choice.delta.content
                            && !content.is_empty()
                        {
                            if !text_started {
                                text_started = true;
                                yield Ok(StreamEvent::TextStart);
                            }
                            yield Ok(StreamEvent::TextDelta {
                                text: content.clone(),
                            });
                        }

                        // 工具调用增量(按 index 跟踪)
                        if let Some(tool_chunks) = &choice.delta.tool_calls {
                            for tc in tool_chunks {
                                let index = tc.index;
                                let state = tool_states.entry(index).or_insert_with(|| {
                                    // (id, name, args, started)
                                    (
                                        tc.id.clone().unwrap_or_default(),
                                        tc.function
                                            .as_ref()
                                            .and_then(|f| f.name.clone())
                                            .unwrap_or_default(),
                                        String::new(),
                                        false,
                                    )
                                });
                                if !state.3 {
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
            }

            if text_started {
                yield Ok(StreamEvent::TextEnd);
            }
            if reasoning_started {
                yield Ok(StreamEvent::ReasoningEnd);
            }
            for (_index, state) in tool_states {
                yield Ok(StreamEvent::ToolCallEnd { id: state.0 });
            }
            yield Ok(StreamEvent::Done { finish_reason });
        })
    }
}
