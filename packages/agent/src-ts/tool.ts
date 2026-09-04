import { z } from "zod";

import type { AIResult } from "./result";

export abstract class LLMTool<TSchema extends z.ZodType = z.ZodType, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  abstract readonly inputSchema: TSchema;

  protected constructor(props: { name: string; description: string }) {
    this.name = props.name;
    this.description = props.description;
  }

  abstract execute(input: z.infer<TSchema>, context: LLMToolContext): Promise<AIResult<TOutput>>;
}

export interface LLMToolContext {
  signal?: AbortSignal;
  conversationID: string;
  /** 请求在后续模型步骤中按需加载已授权的延迟工具。 */
  activateTools?: NormalFunc<[names: readonly string[]]>;
  /** 模型为本次调用选择的输出信息密度；工具仍必须遵守应用侧硬上限。 */
  outputDetail: LLMToolOutputDetail;
}

export type LLMToolOutputDetail = "compact" | "detailed" | "standard";

export interface LLMToolDefinition {
  name: string;
  strict: boolean;
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
