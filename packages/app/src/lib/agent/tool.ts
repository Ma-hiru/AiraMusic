import { z } from "zod";
import { MainIPC } from "@mahiru/ipc/main";
import {
  McpToolRisk,
  type McpTool,
  McpToolError,
  type ToolOptions,
  type McpToolContext,
  type McpToolOutputDetail,
  type RendererToolOptions
} from "@/types/tool";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { AgentToolRequest, AgentToolResponse } from "@mahiru/ipc/types";

export class MainAgentTool {
  /** 工具声明与执行约定；参数由 MCP SDK 按同一份 schema 校验。 */
  static createMcpTool<TSchema extends z.ZodObject>(options: ToolOptions<TSchema>) {
    const inputSchema = options.inputSchema.safeExtend({
      detail: z.enum(["compact", "standard", "detailed"]).optional().describe("结果信息密度")
    }) as unknown as z.ZodType<
      z.output<TSchema> & { detail?: McpToolOutputDetail },
      z.input<TSchema> & { detail?: McpToolOutputDetail }
    >;
    return {
      name: options.name,
      description: options.description,
      inputSchema,
      risk: options.risk,
      execution: options.execution ?? "main",
      timeoutMs: options.timeoutMs ?? 20_000,
      openWorld: options.openWorld ?? false,
      async execute(input, context = { conversationID: "mcp", outputDetail: "standard" }) {
        if (context.signal?.aborted)
          throw new McpToolError("aborted", `工具请求已取消：${options.name}`);
        const { detail, ...payload } = input;
        return options.execute(payload as z.output<TSchema>, {
          ...context,
          outputDetail: detail ?? context.outputDetail
        });
      }
    } satisfies McpTool<z.output<TSchema> & { detail?: McpToolOutputDetail }>;
  }

  /** 播放器主窗口持有的数据与播放能力经 IPC 调用，业务工具文件只声明参数和策略 */
  static createRendererTool<TSchema extends z.ZodObject>(options: RendererToolOptions<TSchema>) {
    return this.createMcpTool({
      ...options,
      execution: "renderer",
      execute: (input, context) =>
        this.requestRendererTool(
          options,
          options.mapInput ? options.mapInput(input) : input,
          context
        )
    });
  }
  private static async requestRendererTool(
    options: Pick<
      RendererToolOptions<z.ZodObject>,
      "name" | "risk" | "timeoutMs" | "commitUnknownOnTimeout"
    >,
    input: unknown,
    context: McpToolContext
  ): Promise<JsonValue> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      let settled = false;
      const cancel = (reason: "aborted" | "timeout") =>
        MainIPC.MessageChannel.commit({
          sender: "process",
          receiver: "main",
          type: "message_cancel_agent_tool_request",
          data: { id, reason }
        });
      const finish = (error?: Error, data?: JsonValue) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        context.signal?.removeEventListener("abort", abort);
        if (error) reject(error);
        else resolve(data!);
      };
      const abort = () => {
        cancel("aborted");
        finish(new McpToolError("aborted", `工具请求已取消：${options.name}`));
      };
      const timer = setTimeout(() => {
        cancel("timeout");
        const uncertain = options.commitUnknownOnTimeout ?? options.risk !== McpToolRisk.Read;
        finish(
          new McpToolError(
            uncertain ? "commit_unknown" : "timeout",
            uncertain
              ? `工具响应超时，无法确认操作是否已经提交；禁止自动重试：${options.name}`
              : `工具请求超时：${options.name}`
          )
        );
      }, options.timeoutMs ?? 20_000);
      const unsubscribe = MainIPC.MessageChannel.listen(
        "message_deliver_agent_tool_response",
        (response: AgentToolResponse) => {
          if (response.id !== id) return;
          if (response.ok) finish(undefined, response.data);
          else finish(new McpToolError("invalid_tool_call", response.reason));
        }
      );
      context.signal?.addEventListener("abort", abort, { once: true });
      if (context.signal?.aborted) {
        abort();
        return;
      }
      MainIPC.MessageChannel.commit({
        sender: "process",
        receiver: "main",
        type: "message_dispatch_agent_tool_request",
        data: {
          id,
          tool: options.name,
          input,
          detail: context.outputDetail,
          conversationID: context.conversationID
        } as AgentToolRequest
      });
    });
  }

  static beforeCall(
    tool: McpTool,
    context: McpToolContext,
    isRendererAvailable: () => boolean
  ): void {
    if (context.signal?.aborted) throw new McpToolError("aborted", `工具请求已取消：${tool.name}`);
    if (tool.execution === "renderer" && !isRendererAvailable())
      throw new McpToolError(
        "renderer_unavailable",
        "AiraMusic 主界面尚未就绪，无法提供此查询；请打开主界面后重试。"
      );
  }

  static formatResult(output: unknown, tool: McpTool, context: McpToolContext): CallToolResult {
    let value: unknown = output === undefined ? "" : output;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        // 普通文本直接作为工具结果。
      }
    }
    const normalized = this.normalizeMcpValue(value, context.access !== "internal", new WeakSet());
    const { text, result } = this.limitOutput(normalized);
    return {
      content: [{ type: "text", text }],
      structuredContent: { ok: true, tool: tool.name, result }
    };
  }

  static formatError(error: unknown, tool: McpTool): CallToolResult {
    const code = error instanceof McpToolError ? error.code : "unknown";
    const payload = {
      ok: false,
      tool: tool.name,
      error: {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: ["network", "service", "timeout", "busy", "renderer_unavailable"].includes(code)
      }
    };
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload
    };
  }

  static getMcpToolAnnotations(tool: McpTool) {
    const readOnly = tool.risk === McpToolRisk.Read;
    return {
      readOnlyHint: readOnly,
      destructiveHint: tool.risk === McpToolRisk.Destructive,
      idempotentHint: readOnly,
      openWorldHint: tool.openWorld
    };
  }

  static readonly AiraMcpToolOutputMaxChars = 18_000;
  private static limitOutput(value: JsonValue): { text: string; result: JsonValue } {
    const limit = this.AiraMcpToolOutputMaxChars;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (text.length <= limit) return { result: value, text };
    const originalChars = text.length;
    if (typeof value === "string") {
      const marker = `\n… [工具结果已裁剪，原始共 ${originalChars} 个字符]`;
      const contentChars = Math.max(0, limit - marker.length);
      const bounded = `${value.slice(0, contentChars)}${marker}`;
      return { result: bounded, text: bounded };
    }

    const create = (budget: number): JsonValue => {
      const projected = this.projectJSONValue(value, budget);
      const metadata = {
        truncated: true,
        originalChars,
        returnedAs: "structured-json-preview"
      };
      if (projected && typeof projected === "object" && !Array.isArray(projected)) {
        return { ...projected, _meta: metadata };
      }
      return { _meta: metadata, value: projected };
    };

    let low = 0;
    let high = limit;
    let result: JsonValue = create(0);
    let boundedText = JSON.stringify(result);
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = create(mid);
      const candidateText = JSON.stringify(candidate);
      if (candidateText.length <= limit) {
        result = candidate;
        boundedText = candidateText;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return { result, text: boundedText };
  }
  private static projectJSONValue(value: JsonValue, budget: number, depth = 0): JsonValue {
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

    const entries = Object.entries(value).sort(
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
  private static jsonProjectionKeyPriority(key: string): number {
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

  private static SensitiveMcpOutputKeys = new Set([
    "account",
    "accounts",
    "backgroundimgid",
    "backgroundurl",
    "cellphone",
    "city",
    "creator",
    "creators",
    "defaultavatar",
    "email",
    "experttags",
    "experts",
    "followed",
    "gender",
    "mobile",
    "mutual",
    "nickname",
    "owner",
    "owners",
    "phone",
    "province",
    "remarkname",
    "signature",
    "subscriber",
    "subscribers",
    "uid"
  ]);
  private static normalizeMcpValue(
    value: unknown,
    redact: boolean,
    visited: WeakSet<object>
  ): JsonValue {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "bigint") return String(value);
    if (typeof value !== "object") return null;
    if (value instanceof Date) return value.toJSON();
    if (visited.has(value)) return "[循环引用已省略]";
    visited.add(value);
    try {
      if (Array.isArray(value)) {
        return value.map((item) => this.normalizeMcpValue(item, redact, visited));
      }
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([key, child]) => child !== undefined && !(redact && this.isSensitiveMcpOutputKey(key))
          )
          .map(([key, child]) => [key, this.normalizeMcpValue(child, redact, visited)])
      );
    } finally {
      visited.delete(value);
    }
  }
  private static isSensitiveMcpOutputKey(key: string): boolean {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    return (
      this.SensitiveMcpOutputKeys.has(normalized) ||
      normalized.startsWith("avatar") ||
      normalized.startsWith("creator") ||
      normalized.startsWith("owner") ||
      normalized.startsWith("user") ||
      normalized.includes("profile")
    );
  }
}
