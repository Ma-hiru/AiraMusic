import { AIResult } from "@/result";
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
  normalizeResponseToolCalls,
  normalizeStreamedChatToolCalls
} from "@/utils/openai";
import OpenAI from "openai";

import type {
  LLMProviderOpenAIConfig,
  LLMProviderOpenAIStreamResponse,
  LLMProviderOpenAIGenerateResponse
} from "./types";

export class LLMProviderOpenAI extends LLMProvider<LLMProviderOpenAIConfig> {
  constructor() {
    super("openai");
  }

  override async check(cfg: LLMProviderOpenAIConfig): Promise<AIResult<LLMCheckResponse>> {
    const resolvedCfg = this.resolveConfig(cfg);
    if (resolvedCfg.isErr()) return resolvedCfg;

    const config = resolvedCfg.unwrap();
    const client = this.createClient(config);
    const signal = AbortSignal.timeout(config.timeoutMs ?? 15_000);

    if (config.apiMode === "chat_completions") {
      const responseResult = await AIResult.from(
        client.chat.completions.create(
          {
            model: config.model,
            max_completion_tokens: 8,
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
        { model: config.model, input: "ping", max_output_tokens: 8 },
        { signal }
      )
    );

    if (responseResult.isErr()) {
      return AIResult.err(normalizeError(responseResult.reason.raw));
    }

    const response = responseResult.unwrap();
    if (response.error || response.status === "failed" || response.status === "incomplete") {
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
    const resolvedCfg = this.resolveConfig(cfg);
    if (resolvedCfg.isErr()) return resolvedCfg;

    const config = resolvedCfg.unwrap();
    const client = this.createClient(config);

    if (config.apiMode === "chat_completions") {
      const responseResult = await AIResult.from(
        client.chat.completions.create(
          {
            model: config.model,
            messages: toChatMessages(request.messages),
            max_completion_tokens: request.maxOutputTokens,
            temperature: request.temperature,
            tools: toChatTools(request.tools),
            tool_choice: toChatToolChoice(request.toolChoice),
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
        return AIResult.err({
          type: "service",
          message: "生成内容被服务提供方的内容过滤器拦截"
        });
      }

      const toolCalls = normalizeChatToolCalls(choice.message.tool_calls);
      return AIResult.ok<
        LLMGenerateResponse<LLMProviderOpenAIGenerateResponse<"chat_completions">>
      >({
        usage: normalizeCompletionsUsage(response.usage).unwrapOr(undefined),
        text: choice.message.content ?? "",
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
          tool_choice: toResponseToolChoice(request.toolChoice),
          stream: false
        },
        { signal: request.signal }
      )
    );
    if (responseResult.isErr()) {
      return AIResult.err(normalizeError(responseResult.reason.raw));
    }

    const response = responseResult.unwrap();
    if (response.error || response.status === "failed" || response.status === "incomplete") {
      return AIResult.err(normalizeError(response));
    }

    const toolCalls = normalizeResponseToolCalls(response);
    return AIResult.ok<LLMGenerateResponse<LLMProviderOpenAIGenerateResponse<"responses">>>({
      usage: normalizeResponseUsage(response.usage).unwrapOr(undefined),
      text: response.output_text,
      toolCalls,
      finishReason: toolCalls.length ? "tool_calls" : "stop",
      raw: response
    }) as unknown as AIResult<LLMGenerateResponse<LLMProviderOpenAIGenerateResponse<T["apiMode"]>>>;
  }

  override async *stream<T extends LLMProviderOpenAIConfig>(
    cfg: T,
    request: LLMGenerateRequest
  ): AsyncGenerator<
    AIResult<LLMGenerateStreamResponse<LLMProviderOpenAIStreamResponse<T["apiMode"]>>>
  > {
    const resolvedCfg = this.resolveConfig(cfg);
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
            messages: toChatMessages(request.messages),
            max_completion_tokens: request.maxOutputTokens,
            temperature: request.temperature,
            tools: toChatTools(request.tools),
            tool_choice: toChatToolChoice(request.toolChoice),
            stream: true,
            stream_options: { include_usage: true }
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

            const delta = choice.delta.content;
            if (delta) {
              text += delta;
              yield AIResult.ok({
                type: "text_delta",
                text: delta
              });
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
          yield AIResult.err({
            type: "service",
            message: "生成内容被服务提供方的内容过滤器拦截"
          });
          return;
        }
        if (finishReason === "length") {
          yield AIResult.err({
            type: "bad_response",
            message: "生成内容达到最大 token 限制，响应未完整结束"
          });
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
          tool_choice: toResponseToolChoice(request.toolChoice),
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
          case "response.completed": {
            const toolCalls = normalizeResponseToolCalls(event.response);
            yield AIResult.ok<
              LLMGenerateStreamResponse<LLMProviderOpenAIStreamResponse<"responses">>
            >({
              type: "done",
              text,
              toolCalls,
              finishReason: toolCalls.length ? "tool_calls" : "stop",
              usage: normalizeResponseUsage(event.response.usage).unwrapOr(undefined),
              raw: event.response
            }) as AIResult<
              LLMGenerateStreamResponse<LLMProviderOpenAIStreamResponse<T["apiMode"]>>
            >;
            return;
          }
          case "response.failed": {
            yield AIResult.err(normalizeError(event.response.error));
            return;
          }
          case "error": {
            yield AIResult.err(normalizeError(event));
            return;
          }
          case "response.incomplete": {
            yield AIResult.err(normalizeError(event.response));
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

  private resolveConfig(
    config: Optional<LLMProviderOpenAIConfig>
  ): AIResult<LLMProviderOpenAIConfig> {
    if (!config) {
      return AIResult.err({
        type: "no_config",
        message: "缺少配置"
      });
    }
    if (!config.apiKey) {
      return AIResult.err({
        type: "invalid_config",
        message: "缺少apiKey"
      });
    }
    if (!config.model) {
      return AIResult.err({
        type: "invalid_config",
        message: "缺少配置模型"
      });
    }
    config.apiMode ??= "responses";
    return AIResult.ok(config);
  }
}
