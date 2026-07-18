import { AIError, AIResult } from "@/result";
import OpenAI from "openai";
import type { LLMToolCall, LLMToolChoice, LLMToolDefinition } from "@/tools";
import type {
  LLMUsage,
  LLMMessage,
  LLMFinishReason,
  LLMProviderContext
} from "@/provider/interface";

const OpenAIResponsesProviderContext = "openai.responses";

export type StreamedChatToolCall = {
  name?: string;
  callID?: string;
  arguments: string;
};

export function normalizeResponseUsage(usage?: OpenAI.Responses.ResponseUsage): AIResult<LLMUsage> {
  if (!usage || typeof usage !== "object") return AIResult.err(AIError.empty);
  const inputDetails = usage.input_tokens_details as
    | undefined
    | ({ cache_write_tokens?: number } & NonNullable<typeof usage.input_tokens_details>);
  const cachedInputTokens = inputDetails?.cached_tokens;
  const cacheWriteTokens = inputDetails?.cache_write_tokens;
  const reasoningTokens = usage.output_tokens_details?.reasoning_tokens;
  return AIResult.ok({
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
    ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
    ...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
    ...(reasoningTokens === undefined ? {} : { reasoningTokens })
  });
}

export function normalizeCompletionsUsage(usage?: OpenAI.CompletionUsage): AIResult<LLMUsage> {
  if (!usage || typeof usage !== "object") return AIResult.err(AIError.empty);
  const compatibleUsage = usage as OpenAI.CompletionUsage & {
    prompt_cache_hit_tokens?: number;
  };
  const promptDetails = usage.prompt_tokens_details as
    | undefined
    | ({ cache_write_tokens?: number } & NonNullable<typeof usage.prompt_tokens_details>);
  const cachedInputTokens = promptDetails?.cached_tokens ?? compatibleUsage.prompt_cache_hit_tokens;
  const cacheWriteTokens = promptDetails?.cache_write_tokens;
  const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens;
  return AIResult.ok({
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
    ...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
    ...(reasoningTokens === undefined ? {} : { reasoningTokens })
  });
}

export function normalizeError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  if (error instanceof OpenAI.APIError) {
    return normalizeAPIError(error);
  }
  if (isOpenAIResponse(error)) {
    if (error.error) {
      return normalizeResponseError(error.error.code, error.error.message);
    }
    const reason = error.incomplete_details?.reason;
    if (reason) {
      return new AIError({
        type: reason === "max_output_tokens" ? "bad_response" : "service",
        message: `OpenAI 响应未完成：${reason}`
      });
    }
    return new AIError({
      type: "service",
      message: `OpenAI 响应异常：${error.status ?? "unknown"}`
    });
  }
  if (isOpenAIResponseError(error) || isOpenAIResponseErrorEvent(error)) {
    const code = error.code ?? "unknown";
    const message = error.message || `OpenAI stream error: ${code}`;
    return normalizeResponseError(code, message);
  }
  if (error instanceof Error) {
    return normalizeRuntimeError(error);
  }
  return new AIError({
    type: "unknown",
    message: "未知 OpenAI 错误"
  });
}

export function normalizeChatToolCalls(
  toolCalls: Undefinable<OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]>
): LLMToolCall[] {
  return (toolCalls ?? []).flatMap((call) => {
    if (call.type !== "function") return [];
    return [
      {
        name: call.function.name,
        callID: call.id,
        arguments: call.function.arguments,
        raw: call
      }
    ];
  });
}

export function normalizeStreamedChatToolCalls(
  toolCalls: Map<number, StreamedChatToolCall>
): AIResult<LLMToolCall[]> {
  const result: LLMToolCall[] = [];
  for (const [index, call] of Array.from(toolCalls.entries()).sort(
    ([leftIdx], [rightIdx]) => leftIdx - rightIdx
  )) {
    if (!call.callID || !call.name) {
      return AIResult.err({
        type: "bad_response",
        message: `Chat Completions 工具调用流缺少必要字段：${index}`,
        raw: call
      });
    }
    result.push({
      name: call.name,
      callID: call.callID,
      arguments: call.arguments,
      raw: { index, ...call }
    });
  }
  return AIResult.ok(result);
}

export function normalizeResponseToolCalls(response: OpenAI.Responses.Response): LLMToolCall[] {
  return response.output.flatMap((item) => {
    if (item.type !== "function_call") return [];
    return [
      {
        name: item.name,
        callID: item.call_id,
        arguments: item.arguments,
        raw: item
      }
    ];
  });
}

export function toResponseProviderContext(
  response: OpenAI.Responses.Response
): Undefinable<LLMProviderContext> {
  const reasoningItems = response.output.flatMap((item) =>
    item.type === "reasoning" ? [structuredClone(item)] : []
  );
  if (!reasoningItems.length) return undefined;
  return {
    provider: OpenAIResponsesProviderContext,
    data: { reasoningItems }
  };
}

export function normalizeChatFinishReason(
  finishReason: OpenAI.ChatCompletionChunk.Choice["finish_reason"]
): LLMFinishReason {
  switch (finishReason) {
    case "stop":
      return "stop";
    case "tool_calls":
    case "function_call":
      return "tool_calls";
    case "length":
      return "length";
    case "content_filter":
      return "content_filter";
    default:
      return "unknown";
  }
}

export function toChatMessages(
  messages: LLMMessage[],
  instructionRole: "system" | "developer" = "system"
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "tool",
        content: message.content,
        tool_call_id: message.callID
      };
    }
    if (message.role === "assistant" && "toolCalls" in message) {
      return {
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.callID,
          type: "function",
          function: {
            name: call.name,
            arguments: call.arguments
          }
        }))
      };
    }
    if (message.role === "system") {
      return {
        role: instructionRole,
        content: message.content
      };
    }
    return { role: message.role, content: message.content };
  });
}

export function toResponseInput(messages: LLMMessage[]): OpenAI.Responses.ResponseInputItem[] {
  return messages.flatMap((message) => {
    if (message.role === "tool") {
      return [
        {
          type: "function_call_output",
          call_id: message.callID,
          output: message.content
        }
      ];
    }
    if (message.role === "assistant" && "toolCalls" in message) {
      const items: OpenAI.Responses.ResponseInputItem[] = [];
      items.push(...readResponseReasoningItems(message.providerContext));
      if (message.content) {
        items.push({
          role: "assistant",
          content: message.content,
          type: "message"
        });
      }
      for (const call of message.toolCalls) {
        items.push({
          type: "function_call",
          call_id: call.callID,
          name: call.name,
          arguments: call.arguments
        });
      }
      return items;
    }
    if (message.role === "system") {
      return [
        {
          role: "developer",
          content: message.content,
          type: "message"
        }
      ];
    }

    return [
      {
        role: message.role,
        content: message.content,
        type: "message"
      }
    ];
  });
}

export function toChatTools(
  tools?: LLMToolDefinition[],
  includeStrict = true
): Undefinable<OpenAI.Chat.Completions.ChatCompletionTool[]> {
  if (!tools?.length) return undefined;
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
      ...(includeStrict ? { strict: tool.strict ?? true } : {})
    }
  }));
}

export function toResponseTools(tools?: LLMToolDefinition[]): Undefinable<OpenAI.Responses.Tool[]> {
  if (!tools?.length) return undefined;
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    strict: tool.strict,
    description: tool.description,
    parameters: tool.inputSchema
  }));
}

export function toChatToolChoice(
  toolChoice?: LLMToolChoice
): Undefinable<OpenAI.Chat.Completions.ChatCompletionToolChoiceOption> {
  return toolChoice;
}

export function toResponseToolChoice(
  toolChoice?: LLMToolChoice
): Undefinable<OpenAI.Responses.ToolChoiceOptions> {
  return toolChoice;
}

// inner

function normalizeRuntimeError(error: Error): AIError {
  if (error.name === "AbortError" || error.name === "APIUserAbortError") {
    return new AIError({
      type: "aborted",
      message: error.message
    });
  }
  if (error.name === "TimeoutError" || error.name === "APIConnectionTimeoutError") {
    return new AIError({
      type: "timeout",
      message: error.message
    });
  }
  if (error.name === "APIConnectionError") {
    return new AIError({
      type: "network",
      message: error.message
    });
  }
  return new AIError({
    type: "network",
    message: error.message
  });
}

function normalizeAPIError(error: InstanceType<typeof OpenAI.APIError>): AIError {
  const status = error.status;
  if (status === 401 || status === 403) {
    return new AIError({
      type: "auth",
      message: error.message
    });
  }
  if (status === 404) {
    return new AIError({
      type: "model_not_found",
      message: error.message
    });
  }
  if (status === 408) {
    return new AIError({
      type: "timeout",
      message: error.message
    });
  }
  if (status === 429) {
    return new AIError({
      type: "rate_limit",
      message: error.message
    });
  }
  if (typeof status === "number" && status >= 500) {
    return new AIError({
      type: "service",
      message: error.message
    });
  }

  return new AIError({
    type: "bad_response",
    message: error.message
  });
}

function normalizeResponseError(
  code: string | OpenAI.Responses.ResponseError["code"],
  message: string
): AIError {
  const isAuthCode = (code: string) => {
    return [
      "invalid_api_key",
      "invalid_authentication",
      "authentication_error",
      "permission_denied",
      "access_denied",
      "account_deactivated",
      "billing_not_active"
    ].includes(code);
  };
  const isRateLimitCode = (code: string) => {
    return [
      "rate_limit_exceeded",
      "rate_limit_reached",
      "insufficient_quota",
      "quota_exceeded"
    ].includes(code);
  };
  const isModelNotFoundCode = (code: string) => {
    return ["model_not_found", "not_found"].includes(code);
  };
  const isTimeoutCode = (code: string) => {
    return ["timeout", "request_timeout"].includes(code);
  };
  const isServerCode = (code: string) => {
    return ["server_error", "internal_error", "service_unavailable", "overloaded"].includes(code);
  };

  if (isAuthCode(code)) {
    return new AIError({
      type: "auth",
      message
    });
  }
  if (isRateLimitCode(code)) {
    return new AIError({
      type: "rate_limit",
      message
    });
  }
  if (isModelNotFoundCode(code)) {
    return new AIError({
      type: "model_not_found",
      message
    });
  }
  if (isTimeoutCode(code)) {
    return new AIError({
      type: "timeout",
      message
    });
  }
  if (isServerCode(code)) {
    return new AIError({
      type: "service",
      message
    });
  }

  return new AIError({
    type: "bad_response",
    message
  });
}

function isOpenAIResponse(error: unknown): error is OpenAI.Responses.Response {
  if (!error || typeof error !== "object") return false;

  const value = error as Partial<OpenAI.Responses.Response>;

  return value.object === "response";
}

function isOpenAIResponseError(error: unknown): error is OpenAI.Responses.ResponseError {
  if (!error || typeof error !== "object") return false;
  const value = error as Partial<OpenAI.Responses.ResponseError>;
  return typeof value.message === "string" && "code" in value;
}

function isOpenAIResponseErrorEvent(error: unknown): error is OpenAI.Responses.ResponseErrorEvent {
  if (!error || typeof error !== "object") return false;
  const value = error as Partial<OpenAI.Responses.ResponseErrorEvent>;
  return value.type === "error" && typeof value.message === "string";
}

function readResponseReasoningItems(
  context?: LLMProviderContext
): OpenAI.Responses.ResponseReasoningItem[] {
  if (context?.provider !== OpenAIResponsesProviderContext) return [];
  if (!context.data || typeof context.data !== "object") return [];

  const data = context.data as { reasoningItems?: unknown };
  if (!Array.isArray(data.reasoningItems)) return [];
  return data.reasoningItems.flatMap((item) => {
    const normalized = normalizeResponseReasoningItem(item);
    return normalized ? [normalized] : [];
  });
}

function normalizeResponseReasoningItem(
  value: unknown
): Undefinable<OpenAI.Responses.ResponseReasoningItem> {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  if (item["type"] !== "reasoning" || typeof item["id"] !== "string") return undefined;

  const summary = normalizeReasoningTextParts(item["summary"], "summary_text");
  if (!summary) return undefined;
  const content =
    item["content"] === undefined
      ? undefined
      : normalizeReasoningTextParts(item["content"], "reasoning_text");
  if (item["content"] !== undefined && !content) return undefined;

  const encryptedContent = item["encrypted_content"];
  if (
    encryptedContent !== undefined &&
    encryptedContent !== null &&
    typeof encryptedContent !== "string"
  ) {
    return undefined;
  }
  const status = item["status"];
  if (
    status !== undefined &&
    status !== "in_progress" &&
    status !== "completed" &&
    status !== "incomplete"
  ) {
    return undefined;
  }

  return {
    id: item["id"],
    type: "reasoning",
    summary,
    ...(content ? { content } : {}),
    ...(encryptedContent === undefined ? {} : { encrypted_content: encryptedContent }),
    ...(status === undefined ? {} : { status })
  } as OpenAI.Responses.ResponseReasoningItem;
}

function normalizeReasoningTextParts<TType extends "summary_text" | "reasoning_text">(
  value: unknown,
  type: TType
): Undefinable<Array<{ type: TType; text: string }>> {
  if (!Array.isArray(value)) return undefined;
  const result: Array<{ type: TType; text: string }> = [];
  for (const part of value) {
    if (!part || typeof part !== "object") return undefined;
    const candidate = part as Record<string, unknown>;
    if (candidate["type"] !== type || typeof candidate["text"] !== "string") return undefined;
    result.push({ type, text: candidate["text"] });
  }
  return result;
}
