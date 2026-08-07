import { AIError, AIResult } from "@/result";
import { attachLLMUsageToError } from "@/provider/usage";
import {
  LLMProvider,
  type LLMCheckResponse,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
  type LLMGenerateStreamResponse
} from "@/provider/interface";
import {
  toChatTools,
  normalizeError,
  toChatMessages,
  toResponseInput,
  toResponseTools,
  toChatToolChoice,
  toResponseToolChoice,
  normalizeChatToolCalls,
  normalizeResponseUsage,
  normalizeChatFinishReason,
  normalizeCompletionsUsage,
  type StreamedChatToolCall,
  toResponseProviderContext,
  normalizeResponseToolCalls,
  normalizeStreamedChatToolCalls
} from "@/utils/openai";
import OpenAI from "openai";

import { LLMProviderOpenAIConfigSchema } from "./types";
import type {
  LLMProviderOpenAIConfig,
  LLMProviderOpenAIStreamResponse,
  LLMProviderOpenAIGenerateResponse,
  LLMProviderOpenAIChatInstructionRole,
  LLMProviderOpenAIChatTokenLimitField
} from "./types";

type ResolvedChatInstructionRole = Exclude<LLMProviderOpenAIChatInstructionRole, "auto">;
type ResolvedChatTokenLimitField = Exclude<LLMProviderOpenAIChatTokenLimitField, "auto">;

function isModernOpenAIChatModel(model: string): boolean {
  return /^(?:o\d|gpt-(?:4\.1|5))(?:[.-]|$)/i.test(model.trim());
}

function isOfficialOpenAIEndpoint(baseURL?: string): boolean {
  if (!baseURL) return true;
  try {
    return new URL(baseURL).hostname.toLowerCase() === "api.openai.com";
  } catch {
    return false;
  }
}

function resolveChatInstructionRole(config: LLMProviderOpenAIConfig): ResolvedChatInstructionRole {
  if (config.chatInstructionRole !== "auto") return config.chatInstructionRole;
  return isModernOpenAIChatModel(config.model) ? "developer" : "system";
}

function resolveChatTokenLimitField(config: LLMProviderOpenAIConfig): ResolvedChatTokenLimitField {
  if (config.chatTokenLimitField !== "auto") return config.chatTokenLimitField;
  return isOfficialOpenAIEndpoint(config.baseURL) || isModernOpenAIChatModel(config.model)
    ? "max_completion_tokens"
    : "max_tokens";
}

function shouldIncludeChatStreamUsage(config: LLMProviderOpenAIConfig): boolean {
  if (config.chatStreamUsage !== "auto") return config.chatStreamUsage === "include";
  return isOfficialOpenAIEndpoint(config.baseURL);
}

function shouldIncludeChatToolStrict(config: LLMProviderOpenAIConfig): boolean {
  if (config.chatToolStrict !== "auto") return config.chatToolStrict === "include";
  return isOfficialOpenAIEndpoint(config.baseURL);
}

function toChatStreamOptions(config: LLMProviderOpenAIConfig) {
  return shouldIncludeChatStreamUsage(config)
    ? { stream_options: { include_usage: true as const } }
    : {};
}

function toChatTokenLimit(
  config: LLMProviderOpenAIConfig,
  value?: number
): { max_tokens?: number; max_completion_tokens?: number } {
  if (value === undefined) return {};
  return resolveChatTokenLimitField(config) === "max_completion_tokens"
    ? { max_completion_tokens: value }
    : { max_tokens: value };
}

function toResponseInclude(
  config: LLMProviderOpenAIConfig,
  request: LLMGenerateRequest
): { include?: OpenAI.Responses.ResponseIncludable[] } {
  // encrypted reasoning 只用于官方 Responses 的无状态工具续接。标题、摘要等
  // 无工具请求不需要它；兼容端点也不应被迫实现这个可选字段。
  return isOfficialOpenAIEndpoint(config.baseURL) && request.tools?.length
    ? { include: ["reasoning.encrypted_content"] }
    : {};
}

function readUsableIncompleteText(
  response: OpenAI.Responses.Response,
  fallbackText = ""
): string | undefined {
  if (
    response.status !== "incomplete" ||
    response.incomplete_details?.reason !== "max_output_tokens"
  ) {
    return undefined;
  }
  const text = response.output_text || readResponseRefusalText(response) || fallbackText;
  return text.trim() ? text : undefined;
}

function readResponseRefusalText(response: OpenAI.Responses.Response): string {
  return response.output
    .flatMap((item) => (item.type === "message" ? item.content : []))
    .flatMap((part) => (part.type === "refusal" ? [part.refusal] : []))
    .join("");
}

function mergeResponseStreamText(
  streamedText: string,
  finalizedText: string
): {
  text: string;
  missingDelta?: string;
} {
  if (!finalizedText) return { text: streamedText };
  if (!streamedText) return { text: finalizedText, missingDelta: finalizedText };
  if (finalizedText.startsWith(streamedText)) {
    const missingDelta = finalizedText.slice(streamedText.length);
    return missingDelta ? { text: finalizedText, missingDelta } : { text: finalizedText };
  }
  // 少数兼容端点的 delta 与最终聚合文本可能不完全一致。最终消息以服务端
  // 的聚合文本为准，但不再补发不可靠的差量，避免界面出现重复内容。
  return { text: finalizedText };
}

export class LLMProviderOpenAI extends LLMProvider<
  LLMProviderOpenAIConfig,
  LLMProviderOpenAIGenerateResponse<LLMProviderOpenAIConfig["apiMode"]>,
  LLMProviderOpenAIStreamResponse<LLMProviderOpenAIConfig["apiMode"]>
> {
  constructor() {
    super("openai", {
      label: "OpenAI",
      configSchema: LLMProviderOpenAIConfigSchema,
      description: "支持 Responses 与 Chat Completions 的 OpenAI API Provider"
    });
  }

  override getCapabilities<T extends LLMProviderOpenAIConfig>(config: T) {
    const requiredToolChoice = config.requiredToolChoice ?? "auto";
    return {
      // 自定义 Endpoint 的兼容程度不可预知，默认只使用所有旧接口都支持的 auto。
      supportsRequiredToolChoice:
        requiredToolChoice === "include" ||
        (requiredToolChoice === "auto" && isOfficialOpenAIEndpoint(config.baseURL))
    };
  }

  override async check(cfg: LLMProviderOpenAIConfig): Promise<AIResult<LLMCheckResponse>> {
    const resolvedCfg = this.parseConfig(cfg);
    if (resolvedCfg.isErr()) return resolvedCfg;

    const config = resolvedCfg.unwrap();
    const client = this.createClient(config);
    const signal = AbortSignal.timeout(config.timeoutMs ?? 15_000);

    if (config.apiMode === "chat_completions") {
      const responseResult = await AIResult.from(
        client.chat.completions.create(
          {
            model: config.model,
            ...toChatTokenLimit(config, 8),
            messages: [{ role: "user", content: "ping" }],
            stream: false
          },
          { signal }
        )
      );

      if (responseResult.isErr()) {
        return AIResult.err(normalizeError(responseResult.reason.raw));
      }

      return AIResult.ok({
        provider: this.name,
        model: responseResult.unwrap().model ?? config.model
      });
    }

    const responseResult = await AIResult.from(
      client.responses.create(
        { model: config.model, input: "ping", max_output_tokens: 8, store: false },
        { signal }
      )
    );

    if (responseResult.isErr()) {
      return AIResult.err(normalizeError(responseResult.reason.raw));
    }

    const response = responseResult.unwrap();
    const checkHitOutputLimit =
      response.status === "incomplete" &&
      response.incomplete_details?.reason === "max_output_tokens";
    if (
      response.error ||
      response.status === "failed" ||
      (response.status === "incomplete" && !checkHitOutputLimit)
    ) {
      return AIResult.err(normalizeError(response));
    }

    return AIResult.ok({
      provider: this.name,
      model: responseResult.unwrap().model ?? config.model
    });
  }

  override async generate<T extends LLMProviderOpenAIConfig>(
    cfg: T,
    request: LLMGenerateRequest
  ): Promise<AIResult<LLMGenerateResponse<LLMProviderOpenAIGenerateResponse<T["apiMode"]>>>> {
    const resolvedCfg = this.parseConfig(cfg);
    if (resolvedCfg.isErr()) return resolvedCfg;

    const config = resolvedCfg.unwrap();
    const client = this.createClient(config);

    if (config.apiMode === "chat_completions") {
      const responseResult = await AIResult.from(
        client.chat.completions.create(
          {
            model: config.model,
            messages: toChatMessages(request.messages, resolveChatInstructionRole(config)),
            ...toChatTokenLimit(config, request.maxOutputTokens),
            temperature: request.temperature,
            tools: toChatTools(request.tools, shouldIncludeChatToolStrict(config)),
            tool_choice: toChatToolChoice(this.resolveToolChoice(config, request.toolChoice)),
            stream: false
          },
          { signal: request.signal }
        )
      );
      if (responseResult.isErr()) {
        return AIResult.err(normalizeError(responseResult.reason.raw));
      }

      const response = responseResult.unwrap();
      const choice = response.choices[0];
      if (!choice) {
        return AIResult.err({
          type: "bad_response",
          message: "缺少响应"
        });
      }
      if (choice.finish_reason === "content_filter") {
        return AIResult.err(
          attachLLMUsageToError(
            new AIError({
              type: "service",
              message: "生成内容被服务提供方的内容过滤器拦截"
            }),
            normalizeCompletionsUsage(response.usage).unwrapOr(undefined)
          )
        );
      }

      const toolCalls = normalizeChatToolCalls(choice.message.tool_calls);
      return AIResult.ok<
        LLMGenerateResponse<LLMProviderOpenAIGenerateResponse<"chat_completions">>
      >({
        usage: normalizeCompletionsUsage(response.usage).unwrapOr(undefined),
        text: choice.message.content ?? choice.message.refusal ?? "",
        toolCalls,
        finishReason: toolCalls.length
          ? "tool_calls"
          : normalizeChatFinishReason(choice.finish_reason),
        raw: response
      }) as unknown as AIResult<
        LLMGenerateResponse<LLMProviderOpenAIGenerateResponse<T["apiMode"]>>
      >;
    }

    const responseResult = await AIResult.from(
      client.responses.create(
        {
          model: config.model,
          input: toResponseInput(request.messages),
          max_output_tokens: request.maxOutputTokens,
          temperature: request.temperature,
          tools: toResponseTools(request.tools),
          tool_choice: toResponseToolChoice(this.resolveToolChoice(config, request.toolChoice)),
          ...toResponseInclude(config, request),
          store: false,
          stream: false
        },
        { signal: request.signal }
      )
    );
    if (responseResult.isErr()) {
      return AIResult.err(normalizeError(responseResult.reason.raw));
    }

    const response = responseResult.unwrap();
    if (response.error || response.status === "failed") {
      return AIResult.err(
        attachLLMUsageToError(
          normalizeError(response),
          normalizeResponseUsage(response.usage).unwrapOr(undefined)
        )
      );
    }

    const toolCalls = normalizeResponseToolCalls(response);
    const incompleteText = readUsableIncompleteText(response);
    if (response.status === "incomplete" && (!incompleteText || toolCalls.length)) {
      return AIResult.err(
        attachLLMUsageToError(
          normalizeError(response),
          normalizeResponseUsage(response.usage).unwrapOr(undefined)
        )
      );
    }
    const providerContext = toolCalls.length ? toResponseProviderContext(response) : undefined;
    return AIResult.ok<LLMGenerateResponse<LLMProviderOpenAIGenerateResponse<"responses">>>({
      usage: normalizeResponseUsage(response.usage).unwrapOr(undefined),
      text: incompleteText ?? (response.output_text || readResponseRefusalText(response)),
      toolCalls,
      finishReason: toolCalls.length ? "tool_calls" : incompleteText ? "length" : "stop",
      ...(providerContext ? { providerContext } : {}),
      raw: response
    }) as unknown as AIResult<LLMGenerateResponse<LLMProviderOpenAIGenerateResponse<T["apiMode"]>>>;
  }

  override async *stream<T extends LLMProviderOpenAIConfig>(
    cfg: T,
    request: LLMGenerateRequest
  ): AsyncGenerator<
    AIResult<LLMGenerateStreamResponse<LLMProviderOpenAIStreamResponse<T["apiMode"]>>>
  > {
    const resolvedCfg = this.parseConfig(cfg);
    if (resolvedCfg.isErr()) {
      yield resolvedCfg;
      return;
    }

    const config = resolvedCfg.unwrap();
    const client = this.createClient(config);

    if (config.apiMode === "chat_completions") {
      const streamResult = await AIResult.from(
        client.chat.completions.create(
          {
            model: config.model,
            messages: toChatMessages(request.messages, resolveChatInstructionRole(config)),
            ...toChatTokenLimit(config, request.maxOutputTokens),
            temperature: request.temperature,
            tools: toChatTools(request.tools, shouldIncludeChatToolStrict(config)),
            tool_choice: toChatToolChoice(this.resolveToolChoice(config, request.toolChoice)),
            stream: true,
            ...toChatStreamOptions(config)
          },
          { signal: request.signal }
        )
      );
      if (streamResult.isErr()) {
        yield AIResult.err(normalizeError(streamResult.reason.raw));
        return;
      }

      try {
        let text = "";
        let usage: Undefinable<OpenAI.CompletionUsage>;
        let finishReason: OpenAI.ChatCompletionChunk.Choice["finish_reason"] = null;
        let lastChunk: Undefinable<OpenAI.Chat.Completions.ChatCompletionChunk>;
        const streamedToolCalls = new Map<number, StreamedChatToolCall>();

        for await (const chunk of streamResult.unwrap()) {
          lastChunk = chunk;
          chunk.usage && (usage = chunk.usage);

          for (const choice of chunk.choices) {
            if (choice.finish_reason) finishReason = choice.finish_reason;

            for (const delta of [choice.delta.content, choice.delta.refusal]) {
              if (delta) {
                text += delta;
                yield AIResult.ok({
                  type: "text_delta",
                  text: delta
                });
              }
            }

            for (const toolCall of choice.delta.tool_calls ?? []) {
              const current = streamedToolCalls.get(toolCall.index) ?? { arguments: "" };
              if (toolCall.id) current.callID = toolCall.id;
              if (toolCall.function?.name) current.name = toolCall.function.name;
              if (toolCall.function?.arguments) current.arguments += toolCall.function.arguments;
              streamedToolCalls.set(toolCall.index, current);
            }
          }
        }
        if (finishReason === "content_filter") {
          yield AIResult.err(
            attachLLMUsageToError(
              new AIError({
                type: "service",
                message: "生成内容被服务提供方的内容过滤器拦截"
              }),
              normalizeCompletionsUsage(usage).unwrapOr(undefined)
            )
          );
          return;
        }
        if (finishReason === "length") {
          yield AIResult.err(
            attachLLMUsageToError(
              new AIError({
                type: "bad_response",
                message: "生成内容达到最大 token 限制，响应未完整结束"
              }),
              normalizeCompletionsUsage(usage).unwrapOr(undefined)
            )
          );
          return;
        }

        const toolCallsResult = normalizeStreamedChatToolCalls(streamedToolCalls);
        if (toolCallsResult.isErr()) {
          yield toolCallsResult;
          return;
        }
        const toolCalls = toolCallsResult.unwrap();

        yield AIResult.ok<
          LLMGenerateStreamResponse<LLMProviderOpenAIStreamResponse<"chat_completions">>
        >({
          text,
          type: "done",
          raw: lastChunk,
          toolCalls,
          finishReason: toolCalls.length ? "tool_calls" : normalizeChatFinishReason(finishReason),
          usage: normalizeCompletionsUsage(usage).unwrapOr(undefined)
        }) as AIResult<LLMGenerateStreamResponse<LLMProviderOpenAIStreamResponse<T["apiMode"]>>>;
      } catch (error) {
        yield AIResult.err(normalizeError(error));
      }

      return;
    }

    const streamResult = await AIResult.from(
      client.responses.create(
        {
          model: config.model,
          input: toResponseInput(request.messages),
          max_output_tokens: request.maxOutputTokens,
          temperature: request.temperature,
          tools: toResponseTools(request.tools),
          tool_choice: toResponseToolChoice(this.resolveToolChoice(config, request.toolChoice)),
          ...toResponseInclude(config, request),
          store: false,
          stream: true
        },
        { signal: request.signal }
      )
    );
    if (streamResult.isErr()) {
      yield AIResult.err(normalizeError(streamResult.reason.raw));
      return;
    }

    try {
      let text = "";
      let finalizedEventText = "";
      let finalizedRefusalText = "";
      for await (const event of streamResult.unwrap()) {
        switch (event.type) {
          case "response.output_text.delta": {
            text += event.delta;
            yield AIResult.ok({
              type: "text_delta",
              text: event.delta
            });
            break;
          }
          case "response.output_text.done": {
            finalizedEventText += event.text;
            break;
          }
          case "response.refusal.delta": {
            text += event.delta;
            yield AIResult.ok({
              type: "text_delta",
              text: event.delta
            });
            break;
          }
          case "response.refusal.done": {
            finalizedRefusalText += event.refusal;
            break;
          }
          case "response.completed": {
            const merged = mergeResponseStreamText(
              text,
              event.response.output_text ||
                finalizedEventText ||
                finalizedRefusalText ||
                readResponseRefusalText(event.response)
            );
            text = merged.text;
            if (merged.missingDelta) {
              yield AIResult.ok({ type: "text_delta", text: merged.missingDelta });
            }
            const toolCalls = normalizeResponseToolCalls(event.response);
            const providerContext = toolCalls.length
              ? toResponseProviderContext(event.response)
              : undefined;
            yield AIResult.ok<
              LLMGenerateStreamResponse<LLMProviderOpenAIStreamResponse<"responses">>
            >({
              type: "done",
              text,
              toolCalls,
              finishReason: toolCalls.length ? "tool_calls" : "stop",
              ...(providerContext ? { providerContext } : {}),
              usage: normalizeResponseUsage(event.response.usage).unwrapOr(undefined),
              raw: event.response
            }) as AIResult<
              LLMGenerateStreamResponse<LLMProviderOpenAIStreamResponse<T["apiMode"]>>
            >;
            return;
          }
          case "response.failed": {
            yield AIResult.err(
              attachLLMUsageToError(
                normalizeError(event.response.error),
                normalizeResponseUsage(event.response.usage).unwrapOr(undefined)
              )
            );
            return;
          }
          case "error": {
            yield AIResult.err(normalizeError(event));
            return;
          }
          case "response.incomplete": {
            const incompleteText = readUsableIncompleteText(
              event.response,
              finalizedEventText || text
            );
            const toolCalls = normalizeResponseToolCalls(event.response);
            if (incompleteText && !toolCalls.length) {
              const merged = mergeResponseStreamText(text, incompleteText);
              text = merged.text;
              if (merged.missingDelta) {
                yield AIResult.ok({ type: "text_delta", text: merged.missingDelta });
              }
              yield AIResult.ok<
                LLMGenerateStreamResponse<LLMProviderOpenAIStreamResponse<"responses">>
              >({
                type: "done",
                text,
                toolCalls: [],
                finishReason: "length",
                usage: normalizeResponseUsage(event.response.usage).unwrapOr(undefined),
                raw: event.response
              }) as AIResult<
                LLMGenerateStreamResponse<LLMProviderOpenAIStreamResponse<T["apiMode"]>>
              >;
              return;
            }
            yield AIResult.err(
              attachLLMUsageToError(
                normalizeError(event.response),
                normalizeResponseUsage(event.response.usage).unwrapOr(undefined)
              )
            );
            return;
          }
        }
      }

      yield AIResult.err({
        type: "bad_response",
        message: "Responses 流在 completed 事件之前结束"
      });
    } catch (err) {
      yield AIResult.err(normalizeError(err));
    }
    return;
  }

  private createClient(config: LLMProviderOpenAIConfig) {
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeoutMs,
      maxRetries: 0
    });
  }
}
