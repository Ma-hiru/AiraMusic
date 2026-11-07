use crate::llm::models::{
    ChatMessage, ChatRequest, ChatRole, ChatUsage, LLMAdapter, LLMProvider, LLMStream,
    LLMStreamEvent,
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
/// 一个 SSE 事件的类型化结果 (openai 流式下，为了支持交错式思考)
struct ExtendedStreamChunk {
    /// async-openai 类型化(choices / delta / tool_calls / usage / finish_reason)
    inner: CreateChatCompletionStreamResponse,
    /// 标准用量与兼容接口扩展的统一结果。
    usage: Option<ChatUsage>,
    /// 拓展字段,思考增量(思考模式才有)
    reasoning_delta: Option<String>,
}
impl OpenAiAdapter {
    fn rejects_stream_options(body: &str) -> bool {
        let Ok(value) = serde_json::from_str::<Value>(body) else {
            return false;
        };
        let Some(error) = value.get("error") else {
            return false;
        };
        let parameter = error
            .get("param")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let code = error
            .get("code")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let message = error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_ascii_lowercase();
        let names_option = parameter == "stream_options"
            || parameter.starts_with("stream_options.")
            || message.contains("stream_options");
        names_option
            && (matches!(code, "unsupported_parameter" | "unknown_parameter")
                || [
                    "unsupported",
                    "not supported",
                    "unrecognized",
                    "unknown parameter",
                    "unknown field",
                    "unexpected",
                ]
                .iter()
                .any(|reason| message.contains(reason)))
    }

    /// ChatMessage → openai 消息 + 要回传的思考内容(仅 assistant 时，其他类型为None)
    fn inner_msg_2_openai_msg(
        messages: &[ChatMessage],
    ) -> Vec<(ChatCompletionRequestMessage, Option<String>)> {
        messages
            .iter()
            .filter_map(|m| {
                let reasoning = m.reasoning_content.clone();
                let message: ChatCompletionRequestMessage = match m.role {
                    ChatRole::System => ChatCompletionRequestSystemMessageArgs::default()
                        .content(m.content.as_str())
                        .build()
                        .ok()?
                        .into(),
                    ChatRole::User => ChatCompletionRequestUserMessageArgs::default()
                        .content(m.content.as_str())
                        .build()
                        .ok()?
                        .into(),
                    ChatRole::Assistant => {
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
                    ChatRole::Tool => ChatCompletionRequestToolMessageArgs::default()
                        .content(m.content.as_str())
                        .tool_call_id(m.tool_call_id.clone()?)
                        .build()
                        .ok()?
                        .into(),
                    // 理论上不会把内部消息转换为 system 消息，这里保留为以后策略扩展
                    ChatRole::Inner => ChatCompletionRequestSystemMessageArgs::default()
                        .content(m.content.as_str())
                        .build()
                        .ok()?
                        .into(),
                };
                Some((message, reasoning)) // 一般都是助手的思考内容，所以，reasoning_content 不为None时，都是助手消息
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
    /// 思考和缓存用量的兼容扩展在边界统一补齐。
    fn parse_stream_chunk(value: Value) -> anyhow::Result<ExtendedStreamChunk> {
        let inner: CreateChatCompletionStreamResponse = serde_json::from_value(value.clone())
            .map_err(|error| anyhow::anyhow!("llm-openai: 无效的流事件: {error}"))?;
        let usage = inner.usage.as_ref().map(|usage| {
            let extension = |path| {
                value
                    .pointer(path)?
                    .as_u64()
                    .and_then(|count| u32::try_from(count).ok())
            };
            ChatUsage {
                prompt_tokens: usage.prompt_tokens,
                completion_tokens: usage.completion_tokens,
                total_tokens: Some(usage.total_tokens),
                // 标准字段的 0 也有效；DeepSeek 缓存命中只在标准细分缺失时兜底。
                cached_tokens: usage
                    .prompt_tokens_details
                    .as_ref()
                    .and_then(|details| details.cached_tokens)
                    .or_else(|| extension("/usage/prompt_cache_hit_tokens")),
                cache_write_tokens: extension("/usage/prompt_tokens_details/cache_write_tokens")
                    .or_else(|| extension("/usage/cache_write_tokens")),
                reasoning_tokens: usage
                    .completion_tokens_details
                    .as_ref()
                    .and_then(|details| details.reasoning_tokens),
            }
        });
        // DeepSeek 与 Ollama 的思考字段不同，取第一个非空增量，避免重复输出。
        let reasoning_delta = value
            .get("choices")
            .and_then(|choices| choices.as_array())
            .and_then(|choices| {
                choices.iter().find_map(|choice| {
                    let delta = choice.get("delta")?;
                    ["reasoning_content", "reasoning"]
                        .iter()
                        .find_map(|key| {
                            delta
                                .get(key)
                                .and_then(Value::as_str)
                                .filter(|s| !s.is_empty())
                        })
                        .map(str::to_string)
                })
            });
        Ok(ExtendedStreamChunk {
            inner,
            usage,
            reasoning_delta,
        })
    }
}

impl LLMAdapter for OpenAiAdapter {
    fn stream<'a>(&'a self, request: &'a ChatRequest) -> LLMStream<'a> {
        Box::pin(stream! {
            // 检查: 取消 + 配置
            if request.cancel.is_aborted() {
                yield Err(anyhow::anyhow!("llm-openai: 请求已被取消"));
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
            tracing::info!(model = % request.config.model, "创建 openai 流");
            let openai_request = CreateChatCompletionRequestArgs::default()
                .model(&request.config.model)
                .messages(vec![]) // 占位: 下面用带思考内容的消息数组覆盖
                .tools(Self::inner_tool_2_openai_tools(&request.tools))
                .stream(true)
                .stream_options(ChatCompletionStreamOptions {
                    include_usage: Some(true),
                    include_obfuscation: None,
                })
                .build()?;
            let mut body = serde_json::to_value(&openai_request)?;
            // 交错式思考需随工具调用历史回传，字段由 Provider 决定。
            let reasoning_field = match request.config.provider {
                LLMProvider::OpenAI => "reasoning_content",
                LLMProvider::Ollama => "reasoning",
            };
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
                tracing::warn ! (model = % request.config.model, "请求缺少系统消息(Request.system 为空)");
            }
            for (message, reasoning) in converted {
                let mut value = serde_json::to_value(&message)?;
                if let Some(reasoning) = reasoning {
                    value[reasoning_field] = Value::String(reasoning);
                }
                body_messages.push(value);
            }
            body["messages"] = Value::Array(body_messages);

            match request.config.provider {
                LLMProvider::OpenAI => {
                    if request.config.thinking {
                        body["thinking"] = serde_json::json!({ "type": "enabled" });
                    }
                }
                LLMProvider::Ollama => {
                    // 兼容接口使用 reasoning_effort，原生接口的 think 参数不适用于这里。
                    body["reasoning_effort"] = Value::String(
                        if request.config.thinking { "medium" } else { "none" }.to_string(),
                    );
                }
            }

            // 发送(每次重试前检查取消; 连接级错误才重试)
            let base_url = request
                .config
                .base_url
                .clone()
                .filter(|url| !url.trim().is_empty())
                .unwrap_or_else(|| match request.config.provider {
                    LLMProvider::OpenAI => "https://api.openai.com/v1".to_string(),
                    LLMProvider::Ollama => "http://localhost:11434/v1".to_string(),
                });
            let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
            let client = reqwest::Client::new();
            let send = |body: Value| {
                let client = &client;
                let url = &url;
                async move {
                request.cancel.throw_if_aborted()?;
                let mut builder = client.post(url.as_str()).json(&body);
                if !request.config.api_key.is_empty() {
                    builder = builder.bearer_auth(&request.config.api_key);
                }
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
                }
            };
            let response = loop {
                let response = (|| send(body.clone()))
                    .retry(
                        backon::ExponentialBuilder::default()
                            .with_jitter()
                            .with_max_times(3),
                    )
                    .await;
                let response = match response {
                    Ok(response) => response,
                    Err(error) => {
                        yield Err(error);
                        return;
                    }
                };
                if response.status().is_success() {
                    break response;
                }
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                // 用量是可选能力；只在服务明确拒绝该参数时降级一次。
                if status == reqwest::StatusCode::BAD_REQUEST
                    && Self::rejects_stream_options(&text)
                    && body.as_object_mut().and_then(|body| body.remove("stream_options")).is_some()
                {
                    tracing::debug!("兼容服务不支持 stream_options，关闭流式用量重试");
                    continue;
                }
                yield Err(anyhow::anyhow!("llm-openai: {status}: {text}"));
                return;
            };

            // SSE
            let mut tool_states: HashMap<u32, (String, String, String, bool)> = HashMap::new();
            let mut text_started = false;
            let mut reasoning_started = false;
            let mut finish_reason: Option<String> = None;
            let mut decoder = LLMSSEDecoder::open_ai();
            let mut byte_stream = response.bytes_stream();
            loop {
                let chunk = tokio::select! {
                    biased;
                    _ = request.cancel.wait_aborted() => {
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
                        return;
                    }
                };
                // 半截事件在解码器内部
                // 这里是解析完成的 JSON 事件
                // openai 协议每个事件都是 JSON
                let values = decoder.feed(&chunk)
                    .map_err(|error| anyhow::anyhow!("llm-openai: SSE 解析失败: {error}"))?;
                for value in values {
                    let stream_chunk = Self::parse_stream_chunk(value)?;
                    let chunk = stream_chunk.inner;

                    // 用量(流尾 chunk)
                    if let Some(usage) = stream_chunk.usage {
                        yield Ok(LLMStreamEvent::Usage(usage));
                    }

                    // 思考增量(拓展字段, 思考模式才有)
                    if let Some(reasoning) = stream_chunk.reasoning_delta {
                        if !reasoning_started {
                            reasoning_started = true;
                            yield Ok(LLMStreamEvent::ReasoningStart);
                        }
                        yield Ok(LLMStreamEvent::ReasoningDelta { delta: reasoning });
                    }

                    for choice in &chunk.choices {
                        // 文本增量
                        if let Some(content) = &choice.delta.content
                            && !content.is_empty()
                        {
                            if !text_started {
                                text_started = true;
                                yield Ok(LLMStreamEvent::TextStart);
                            }
                            yield Ok(LLMStreamEvent::TextDelta {
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
                                    yield Ok(LLMStreamEvent::ToolCallStart {
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
                                        yield Ok(LLMStreamEvent::ToolCallArgs {
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
                if decoder.is_done() {
                    break;
                }
            }
            decoder.finish()?;
            if finish_reason.is_none() {
                yield Err(anyhow::anyhow!("llm-openai: 模型流结束但缺少 finish_reason"));
                return;
            }

            if text_started {
                yield Ok(LLMStreamEvent::TextEnd);
            }
            if reasoning_started {
                yield Ok(LLMStreamEvent::ReasoningEnd);
            }
            for (_index, state) in tool_states {
                yield Ok(LLMStreamEvent::ToolCallEnd { id: state.0 });
            }
            yield Ok(LLMStreamEvent::Done { finish_reason });
        })
    }
}
