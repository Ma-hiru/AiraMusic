import { z } from "zod";
import { AIResult } from "@/result";

import type {
  LLMTool,
  LLMToolCall,
  LLMToolResult,
  LLMToolContext,
  LLMToolDefinition
} from "./interface";

export interface LLMToolRegistryOptions {
  serializeOutput?: NormalFunc<[output: unknown], string>;
}

export class LLMToolRegistry {
  private readonly tools = new Map<string, LLMTool>();
  private readonly serializeOutput: NormalFunc<[output: unknown], string>;

  constructor(options: LLMToolRegistryOptions = {}) {
    this.serializeOutput = options.serializeOutput ?? this.defaultSerializeOutput.bind(this);
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

  definitions(strict = true): LLMToolDefinition[] {
    return Array.from(this.tools.values(), (tool) => ({
      strict,
      name: tool.name,
      description: tool.description,
      inputSchema: this.toJsonSchema(tool)
    }));
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

  async execute(call: LLMToolCall, context: LLMToolContext): Promise<AIResult<LLMToolResult>> {
    const toolResult = this.get(call.name);
    if (toolResult.isErr()) return toolResult;

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

    const executionResult = await tool.execute(inputResult.data, context);
    if (executionResult.isErr()) return executionResult;

    const raw = executionResult.unwrap();
    return AIResult.ok({
      name: call.name,
      callID: call.callID,
      raw,
      output: this.serializeOutput(raw)
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
}
