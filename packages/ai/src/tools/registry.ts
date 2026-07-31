import { z } from "zod";
import { AIError, AIResult } from "@/result";

import type {
  LLMTool,
  LLMToolCall,
  LLMToolResult,
  LLMToolContext,
  LLMToolDefinition
} from "./interface";

export interface LLMToolRegistryOptions {
  maxOutputChars?: number;
  parallelSafeNames?: Iterable<string>;
  /** 中止后允许整轮重新执行的工具；必须没有不可逆或重复副作用。 */
  retrySafeNames?: Iterable<string>;
  serializeOutput?: NormalFunc<[output: unknown], string>;
}

export class LLMToolRegistry {
  private readonly tools = new Map<string, LLMTool>();
  private readonly parallelSafeNames: Set<string>;
  private readonly retrySafeNames: Set<string>;
  private readonly maxOutputChars?: number;
  private readonly serializeOutput: NormalFunc<[output: unknown], string>;

  constructor(options: LLMToolRegistryOptions = {}) {
    this.maxOutputChars =
      options.maxOutputChars === undefined ? undefined : Math.max(256, options.maxOutputChars);
    this.serializeOutput = options.serializeOutput ?? this.defaultSerializeOutput.bind(this);
    this.parallelSafeNames = new Set(options.parallelSafeNames ?? []);
    this.retrySafeNames = new Set(options.retrySafeNames ?? []);
  }

  register(tool: LLMTool | LLMTool[]): AIResult<void> {
    for (const item of Array.isArray(tool) ? tool : [tool]) {
      if (!item.name) {
        return AIResult.err({
          type: "invalid_tool_config",
          message: "工具缺少 name"
        });
      }

      if (this.tools.has(item.name)) {
        return AIResult.err({
          type: "invalid_tool_config",
          message: `工具重复注册：${item.name}`
        });
      }

      this.tools.set(item.name, item);
    }
    return AIResult.ok(undefined);
  }

  definitions(strict = true, selectedNames?: Iterable<string>): LLMToolDefinition[] {
    const selected = selectedNames ? new Set(selectedNames) : undefined;
    return Array.from(this.tools.values())
      .filter((tool) => !selected || selected.has(tool.name))
      .map((tool) => ({
        strict,
        name: tool.name,
        description: tool.description,
        inputSchema: this.toJsonSchema(tool)
      }));
  }

  isParallelSafe(name: string): boolean {
    return this.parallelSafeNames.has(name);
  }

  isRetrySafe(name: string): boolean {
    return this.retrySafeNames.has(name);
  }

  get(name: string): AIResult<LLMTool> {
    const tool = this.tools.get(name);

    if (!tool) {
      return AIResult.err({
        type: "unknown_tool",
        message: `未知工具：${name}`
      });
    }

    return AIResult.ok(tool);
  }

  async execute(
    call: LLMToolCall,
    context: LLMToolContext,
    selectedNames?: readonly string[]
  ): Promise<AIResult<LLMToolResult>> {
    const toolResult = this.get(call.name);
    if (toolResult.isErr()) return toolResult;

    if (selectedNames && !selectedNames.includes(call.name)) {
      return AIResult.err({
        type: "unknown_tool",
        message: "内部工具路由不匹配，请改用本轮提供的工具。",
        raw: { reason: "not_selected", visibility: "internal" }
      });
    }

    const argsResult = this.parseToolArguments(call);
    if (argsResult.isErr()) return argsResult;

    const tool = toolResult.unwrap();
    const inputResult = await tool.inputSchema.safeParseAsync(argsResult.unwrap());
    if (!inputResult.success) {
      return AIResult.err({
        type: "invalid_tool_call",
        message: `工具参数校验失败：${call.name}`,
        raw: inputResult.error
      });
    }

    let executionResult: Awaited<ReturnType<LLMTool["execute"]>>;
    try {
      executionResult = await tool.execute(inputResult.data, context);
    } catch (error) {
      return AIResult.err(AIError.raw(error));
    }
    if (executionResult.isErr()) return executionResult;

    const raw = executionResult.unwrap();
    const output = this.limitOutput(this.serializeOutput(raw));
    return AIResult.ok({
      name: call.name,
      callID: call.callID,
      raw,
      output
    });
  }

  private parseToolArguments<T = unknown>(call: LLMToolCall): AIResult<T> {
    const raw = call.arguments.trim();
    if (!raw) return AIResult.ok(undefined as T);

    try {
      return AIResult.ok(JSON.parse(raw));
    } catch (error) {
      return AIResult.err({
        type: "invalid_tool_call",
        message: `工具参数不是合法 JSON：${call.name}`,
        raw: error
      });
    }
  }

  private toJsonSchema(tool: LLMTool): Record<string, unknown> {
    const jsonSchema = z.toJSONSchema(tool.inputSchema);
    if (!jsonSchema || typeof jsonSchema !== "object" || Array.isArray(jsonSchema)) return {};
    return jsonSchema;
  }

  private defaultSerializeOutput(output: unknown) {
    if (typeof output === "string") return output;
    if (output === undefined) return "";
    try {
      return JSON.stringify(output);
    } catch {
      return String(output);
    }
  }

  limitOutput(output: string, maxOutputChars = this.maxOutputChars) {
    const limit =
      maxOutputChars === undefined ? undefined : Math.max(256, Math.floor(maxOutputChars));
    if (!limit || output.length <= limit) return output;

    const originalChars = output.length;
    try {
      JSON.parse(output);
      return this.buildJSONPreview(output, originalChars, limit);
    } catch {
      const marker = `\n… [工具结果已裁剪，原始共 ${originalChars} 个字符]`;
      const contentChars = Math.max(0, limit - marker.length);
      return `${output.slice(0, contentChars)}${marker}`.slice(0, limit);
    }
  }

  private buildJSONPreview(output: string, originalChars: number, limit: number) {
    const create = (preview: string) =>
      JSON.stringify({
        _meta: {
          truncated: true,
          originalChars,
          returnedAs: "json-preview"
        },
        preview
      });

    let low = 0;
    let high = output.length;
    let result = create("");
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = create(output.slice(0, mid));
      if (candidate.length <= limit) {
        result = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return result.length <= limit ? result : result.slice(0, limit);
  }
}
