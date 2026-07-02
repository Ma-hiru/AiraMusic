import { z } from "zod";
import { AIResult } from "@/result";

export abstract class LLMTool<TSchema extends z.ZodType, TOutput> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: TSchema;

  abstract execute(input: z.infer<TSchema>, context: LLMToolContext): Promise<AIResult<TOutput>>;
}

export interface LLMToolContext {
  signal?: AbortSignal;
  conversationID: string;
}

export interface LLMToolDefinition {
  name: string;
  strict?: boolean;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LLMToolCall {
  name: string;
  raw?: unknown;
  callID: string;
  /** 模型生成的原始 JSON 字符串 */
  arguments: string;
}

export interface LLMToolResult<TRaw = unknown> {
  raw: TRaw;
  name: string;
  callID: string;
  output: string;
}

export type LLMToolChoice = "auto" | "none" | "required";
