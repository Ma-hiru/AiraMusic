import { z } from "zod";
import { AIError, AIResult } from "@/result";

import type {
  LLMTool,
  LLMToolCall,
  LLMToolResult,
  LLMToolContext,
  LLMToolDefinition,
  LLMToolOutputDetail
} from "./interface";

const ToolOutputDetailKey = "detail";
const ToolOutputDetails = ["compact", "standard", "detailed"] as const;

export interface LLMToolRegistryOptions {
  maxOutputChars?: number;
  parallelSafeNames?: Iterable<string>;
  /** 单轮内相同参数可直接复用结果的稳定只读工具。 */
  reuseSafeNames?: Iterable<string>;
  /** 中止后允许整轮重新执行的工具；必须没有不可逆或重复副作用。 */
  retrySafeNames?: Iterable<string>;
  serializeOutput?: NormalFunc<[output: unknown], string>;
}

export class LLMToolRegistry {
  private readonly tools = new Map<string, LLMTool>();
  private readonly parallelSafeNames: Set<string>;
  private readonly reuseSafeNames: Set<string>;
  private readonly retrySafeNames: Set<string>;
  private readonly maxOutputChars?: number;
  private readonly serializeOutput: NormalFunc<[output: unknown], string>;

  constructor(options: LLMToolRegistryOptions = {}) {
    this.maxOutputChars =
      options.maxOutputChars === undefined ? undefined : Math.max(256, options.maxOutputChars);
    this.serializeOutput = options.serializeOutput ?? this.defaultSerializeOutput.bind(this);
    this.parallelSafeNames = new Set(options.parallelSafeNames ?? []);
    this.reuseSafeNames = new Set(options.reuseSafeNames ?? []);
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

  isReuseSafe(name: string): boolean {
    return this.reuseSafeNames.has(name);
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

  /** 使用与实际执行相同的 Zod 规则规范化参数，供去重、审计等只读逻辑复用。 */
  async normalizeCallArguments(call: LLMToolCall): Promise<
    AIResult<{
      input: unknown;
      outputDetail: LLMToolOutputDetail;
    }>
  > {
    const toolResult = this.get(call.name);
    if (toolResult.isErr()) return toolResult;
    const argsResult = this.parseToolArguments(call);
    if (argsResult.isErr()) return argsResult;

    const { input, outputDetail } = this.extractOutputDetail(argsResult.unwrap());
    const inputResult = await toolResult.unwrap().inputSchema.safeParseAsync(input);
    if (!inputResult.success) {
      return AIResult.err({
        type: "invalid_tool_call",
        message: `工具参数校验失败：${call.name}`,
        raw: inputResult.error
      });
    }
    return AIResult.ok({ input: inputResult.data, outputDetail });
  }

  async execute(
    call: LLMToolCall,
    context: Omit<LLMToolContext, "outputDetail"> & Partial<Pick<LLMToolContext, "outputDetail">>,
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

    const normalized = await this.normalizeCallArguments(call);
    if (normalized.isErr()) return normalized;
    const { input, outputDetail } = normalized.unwrap();

    let executionResult: Awaited<ReturnType<LLMTool["execute"]>>;
    try {
      executionResult = await toolResult.unwrap().execute(input, { ...context, outputDetail });
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
    if (jsonSchema["type"] !== "object") return jsonSchema;

    const properties =
      jsonSchema["properties"] &&
      typeof jsonSchema["properties"] === "object" &&
      !Array.isArray(jsonSchema["properties"])
        ? (jsonSchema["properties"] as Record<string, unknown>)
        : {};
    const required = Array.isArray(jsonSchema["required"])
      ? jsonSchema["required"].filter((item): item is string => typeof item === "string")
      : [];

    return {
      ...jsonSchema,
      properties: {
        ...properties,
        [ToolOutputDetailKey]: {
          type: "string",
          enum: ToolOutputDetails,
          default: "standard",
          description:
            "结果信息密度。通常使用 standard；仅当标准结果缺少回答所需事实时使用 detailed，快速消歧可用 compact。即使 detailed 也会保留硬裁剪。"
        }
      },
      // OpenAI 严格工具 schema 要求所有属性都在 required 中；执行前会剥离保留字段。
      required: Array.from(new Set([...required, ToolOutputDetailKey]))
    };
  }

  private extractOutputDetail(value: unknown): {
    input: unknown;
    outputDetail: LLMToolOutputDetail;
  } {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { input: value, outputDetail: "standard" };
    }

    const record = value as Record<string, unknown>;
    const requested = record[ToolOutputDetailKey];
    const outputDetail = ToolOutputDetails.includes(requested as LLMToolOutputDetail)
      ? (requested as LLMToolOutputDetail)
      : "standard";
    const { [ToolOutputDetailKey]: _detail, ...input } = record;
    void _detail;
    return { input, outputDetail };
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
    const parsed = JSON.parse(output) as unknown;
    const create = (budget: number) => {
      const projected = this.projectJSONValue(parsed, budget);
      const metadata = {
        truncated: true,
        originalChars,
        returnedAs: "structured-json-preview"
      };
      if (projected && typeof projected === "object" && !Array.isArray(projected)) {
        return JSON.stringify({ ...(projected as Record<string, unknown>), _meta: metadata });
      }
      return JSON.stringify({ _meta: metadata, value: projected });
    };

    let low = 0;
    let high = limit;
    let result = create(0);
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = create(mid);
      if (candidate.length <= limit) {
        result = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return result.length <= limit ? result : result.slice(0, limit);
  }

  private projectJSONValue(value: unknown, budget: number, depth = 0): unknown {
    if (typeof value === "string") {
      if (value.length <= budget) return value;
      if (budget <= 1) return "";
      return `${value.slice(0, budget - 1).trimEnd()}…`;
    }
    if (value === null || typeof value !== "object") return value;
    if (depth >= 8 || budget <= 0) return Array.isArray(value) ? [] : {};

    if (Array.isArray(value)) {
      if (!value.length) return [];
      const count = Math.min(value.length, 20, Math.max(1, Math.floor(budget / 64)));
      const perItem = Math.max(1, Math.floor(budget / count));
      return value.slice(0, count).map((item) => this.projectJSONValue(item, perItem, depth + 1));
    }

    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) =>
        this.jsonProjectionKeyPriority(left) - this.jsonProjectionKeyPriority(right)
    );
    const count = Math.min(entries.length, Math.max(1, Math.floor(budget / 20)));
    const selected = entries.slice(0, count);
    const perField = Math.max(1, Math.floor(budget / selected.length));
    return Object.fromEntries(
      selected.map(([key, item]) => [key, this.projectJSONValue(item, perField, depth + 1)])
    );
  }

  private jsonProjectionKeyPriority(key: string): number {
    const critical = [
      "url",
      "results",
      "content",
      "contentRange",
      "find",
      "nextCursor",
      "nextOffset",
      "title",
      "error"
    ];
    const index = critical.indexOf(key);
    return index < 0 ? critical.length : index;
  }
}
