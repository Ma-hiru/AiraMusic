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
    /// 拓展字段,思考增量(思考模式才有)
    reasoning_delta: Option<String>,
}
impl OpenAiAdapter {
    fn request_body(request: &ChatRequest) -> anyhow::Result<Value> {
        let openai_request = CreateChatCompletionRequestArgs::default()
            .model(&request.config.model)
            .messages(vec![]) // 占位: 下面用带 reasoning_content 的消息数组覆盖
            .tools(Self::inner_tool_2_openai_tools(&request.tools))
            .stream(true)
            .build()?;
        let mut body = serde_json::to_value(&openai_request)?;
        // 重建 messages: 系统 + 会话消息; assistant 消息补 reasoning_content
        // (思考模式多轮对话必须随历史回传, 否则 deepseek 返回 400!!! 交错式思考)
        crate::context::messages::validate_messages(&request.messages)?;
        let converted = Self::inner_msg_2_openai_msg(&request.messages)?;
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
                value["reasoning_content"] = Value::String(reasoning);
            }
            body_messages.push(value);
        }
        body["messages"] = Value::Array(body_messages);
        // Use the same limit that the context manager reserved in its input budget.
        body["max_tokens"] = serde_json::json!(request.config.output_limit());

        // 思考模式开关(async-openai 无 thinking 参数)
        if request.config.thinking {
            body["thinking"] = serde_json::json!({ "type": "enabled" });
        }

        Ok(body)
    }

    pub(crate) fn response_error(status: u16, text: &str) -> anyhow::Error {
        let message = format!("llm-openai: {status}: {text}");
        let body = serde_json::from_str::<Value>(text).unwrap_or(Value::Null);
        let code = body
            .pointer("/error/code")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let detail = body
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_lowercase();
        if matches!(status, 400 | 413)
            && (matches!(
                code,
                "context_length_exceeded" | "context_window_exceeded" | "input_tokens_exceeded"
            ) || detail.contains("maximum context length")
                || detail.contains("context length exceeded"))
        {
            crate::llm::models::ContextOverflow(message).into()
        } else {
            anyhow::anyhow!(message)
        }
    }

    /// ChatMessage → openai 消息 + 要回传的思考内容(仅 assistant 时，其他类型为None)
    fn inner_msg_2_openai_msg(
        messages: &[ChatMessage],
    ) -> anyhow::Result<Vec<(ChatCompletionRequestMessage, Option<String>)>> {
        messages
            .iter()
            .map(|m| {
                let reasoning = m.reasoning_content.clone();
                let message: ChatCompletionRequestMessage = match m.role {
                    ChatRole::System => ChatCompletionRequestSystemMessageArgs::default()
                        .content(m.content.as_str())
                        .build()?
                        .into(),
                    ChatRole::User => ChatCompletionRequestUserMessageArgs::default()
                        .content(m.content.as_str())
                        .build()?
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

                        args.build()?.into()
                    }
                    ChatRole::Tool => ChatCompletionRequestToolMessageArgs::default()
                        .content(m.content.as_str())
                        .tool_call_id(
                            m.tool_call_id
                                .clone()
                                .ok_or_else(|| anyhow::anyhow!("tool 缺少 tool_call_id"))?,
                        )
                        .build()?
                        .into(),
                    // 理论上不会把内部消息转换为 system 消息，这里保留为以后策略扩展
                    ChatRole::Inner => ChatCompletionRequestSystemMessageArgs::default()
                        .content(m.content.as_str())
                        .build()?
                        .into(),
                };
                Ok((message, reasoning)) // 一般都是助手的思考内容，所以，reasoning_content 不为None时，都是助手消息
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
    fn parse_stream_chunk(value: Value) -> Option<ExtendedStreamChunk> {
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
        Some(ExtendedStreamChunk {
            inner,
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
            tracing::info!(model = % request.config.model, "创建 openai 流");
            let body = Self::request_body(request)?;

            // 发送(每次重试前检查取消; 连接级错误才重试)
            let base_url = request
                .config
                .base_url
                .clone()
                .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
            let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
            let client = reqwest::Client::new();
            let send = || async {
                request.cancel.throw_if_aborted()?;
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
            };
            let response = send
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
            if !response.status().is_success() {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                yield Err(Self::response_error(status.as_u16(), &text));
                return;
            }

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
                        continue;
                    }
                };
                // 半截事件在解码器内部
                // 这里是解析完成的 JSON 事件
                // openai 协议每个事件都是 JSON
                for value in decoder.feed(&chunk).into_iter().flatten() {
                    let Some(stream_chunk) = Self::parse_stream_chunk(value) else {
                        continue; // 反序列化失败的事件(防御)直接跳过
                    };
                    let chunk = stream_chunk.inner;

                    // 用量(流尾 chunk)
                    if let Some(usage) = chunk.usage {
                        yield Ok(LLMStreamEvent::Usage(ChatUsage {
                            prompt_tokens: usage.prompt_tokens,
                            completion_tokens: usage.completion_tokens,
                        }));
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

#[cfg(test)]
mod context_tests {
    use super::*;
    use crate::llm::models::{ChatToolCall, ContextOverflow, LLMConfig};
    use crate::utils::Signal;
    use serde_json::json;

    #[test]
    fn outgoing_body_preserves_pairs_reasoning_and_the_reserved_output_limit() {
        let request = ChatRequest {
            config: LLMConfig {
                model: "test".into(),
                max_output_tokens: Some(1234),
                ..LLMConfig::default()
            },
            system: vec!["fixed rules".into()],
            messages: vec![
                ChatMessage::user("lookup"),
                ChatMessage::assistant_with_tool_calls_and_reasoning(
                    "",
                    vec![ChatToolCall {
                        id: "call-1".into(),
                        name: "lookup".into(),
                        args: json!({"track_id": "123"}),
                    }],
                    Some("original reasoning".into()),
                ),
                ChatMessage::tool("result", "call-1"),
            ],
            tools: Vec::new(),
            cancel: Signal::default(),
        };
        let body = OpenAiAdapter::request_body(&request).unwrap();
        assert_eq!(body["max_tokens"], 1234);
        assert_eq!(body["messages"][0]["content"], "fixed rules");
        assert_eq!(body["messages"][2]["tool_calls"][0]["id"], "call-1");
        assert_eq!(
            body["messages"][2]["reasoning_content"],
            "original reasoning"
        );
        assert_eq!(body["messages"][3]["tool_call_id"], "call-1");
        let mut invalid = request;
        invalid.messages.remove(1);
        assert!(OpenAiAdapter::request_body(&invalid).is_err());
    }

    #[test]
    fn only_known_context_errors_are_classified_for_compaction_retry() {
        for body in [
            json!({"error":{"code":"context_length_exceeded","message":"too long"}}),
            json!({"error":{"message":"This model's maximum context length is 128000 tokens"}}),
        ] {
            assert!(OpenAiAdapter::response_error(400, &body.to_string()).is::<ContextOverflow>());
        }
        for (status, body) in [
            (
                400,
                json!({"error":{"message":"Messages with role 'tool' must be a response to a pending message with 'tool_calls'"}}),
            ),
            (401, json!({"error":{"code":"context_length_exceeded"}})),
            (413, json!({"error":{"message":"request too large"}})),
        ] {
            assert!(
                !OpenAiAdapter::response_error(status, &body.to_string()).is::<ContextOverflow>()
            );
        }
    }
}
