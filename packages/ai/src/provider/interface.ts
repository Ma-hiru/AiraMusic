import { AIResult } from "@/result";
import type { LLMToolChoice } from "@/tools/interface";
import type { LLMToolCall, LLMToolDefinition } from "@/tools";

export interface LLMProviderConfig {
  model: string;
  apiKey: string;
  baseURL?: string;
  timeoutMs?: number;
}

export interface LLMProviderConfigPublic extends LLMProviderConfig {
  apiKey: `${string}****${string}`;
}

export abstract class LLMProvider<
  TConfig extends LLMProviderConfig = LLMProviderConfig,
  TGenerateResponse = unknown,
  TStreamResponse = unknown
> {
  readonly name: string;

  protected constructor(name: string) {
    this.name = name;
  }

  abstract check(config: TConfig): Promise<AIResult<LLMCheckResponse>>;

  abstract generate<T extends TConfig>(
    config: T,
    request: LLMGenerateRequest
  ): Promise<AIResult<LLMGenerateResponse<TGenerateResponse>>>;

  abstract stream<T extends TConfig>(
    config: T,
    request: LLMGenerateRequest
  ): AsyncGenerator<AIResult<LLMGenerateStreamResponse<TStreamResponse>>>;
}

export interface LLMGenerateRequest {
  signal?: AbortSignal;
  temperature?: number;
  messages: LLMMessage[];
  maxOutputTokens?: number;
  toolChoice?: LLMToolChoice;
  tools?: LLMToolDefinition[];
}

export interface LLMGenerateResponse<TRaw = unknown> {
  raw: TRaw;
  text: string;
  usage?: LLMUsage;
  toolCalls: LLMToolCall[];
  finishReason: LLMFinishReason;
}

export type LLMGenerateStreamResponse<TRaw = unknown> =
  | {
      text: string;
      type: "text_delta";
    }
  | {
      text: string;
      type: "done";
      usage?: LLMUsage;
      raw: Undefinable<TRaw>;
      toolCalls: LLMToolCall[];
      finishReason: LLMFinishReason;
    };

export interface LLMCheckResponse {
  model: string;
  provider: string;
}

export interface LLMUsage {
  inputTokens?: number;
  totalTokens?: number;
  outputTokens?: number;
}

export type LLMFinishReason = "stop" | "length" | "unknown" | "tool_calls" | "content_filter";

export type LLMMessage = LLMMessageText | LLMMessageToolCall | LLMMessageToolResult;

export interface LLMMessageText {
  content: string;
  role: "user" | "system" | "assistant";
}

export interface LLMMessageToolCall {
  content?: string;
  role: "assistant";
  toolCalls: LLMToolCall[];
}

export interface LLMMessageToolResult {
  name: string;
  role: "tool";
  callID: string;
  content: string;
}
