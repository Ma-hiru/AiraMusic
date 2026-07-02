import { AIResult } from "@/result";
import type { LLMToolChoice } from "@/tools/interface";
export type { LLMToolChoice } from "@/tools/interface";
import type { LLMToolCall, LLMToolDefinition } from "@/tools";

export abstract class LLMProvider<TConfig = unknown> {
  readonly name: string;

  protected constructor(name: string) {
    this.name = name;
  }

  abstract check(config: TConfig): Promise<AIResult<LLMCheckResponse>>;

  abstract generate(
    config: TConfig,
    request: LLMGenerateRequest
  ): Promise<AIResult<LLMGenerateResponse>>;

  abstract stream(
    config: TConfig,
    request: LLMGenerateRequest
  ): AsyncGenerator<AIResult<LLMGenerateStreamResponse>>;
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
