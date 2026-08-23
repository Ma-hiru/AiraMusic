import { z } from "zod";
import { McpServer, type ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type LLMTool,
  LLMToolRegistry,
  type LLMToolResult,
  type LLMToolContext
} from "@mahiru/agent";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { getAiraMcpToolAnnotations } from "./public-tools";

export const AiraMcpToolOutputMaxChars = 18_000;

const SensitiveMcpOutputKeys = new Set([
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

export interface AiraMcpToolAdapterOptions {
  createCallID(): string;
  isRendererAvailable(): boolean;
  requiresRenderer(name: string): boolean;
}

type AiraMcpSuccessPayload = {
  ok: true;
  tool: string;
  result: unknown;
};

type AiraMcpErrorPayload = {
  ok: false;
  tool: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
};

export function createAiraMcpToolRegistry(tools: readonly LLMTool[]): LLMToolRegistry {
  const registry = new LLMToolRegistry({
    maxOutputChars: AiraMcpToolOutputMaxChars,
    // MCP 是独立的公共出口，先递归去除用户字段，再进入现有字符预算裁剪。
    serializeOutput: serializeAiraMcpOutput
  });
  const result = registry.register([...tools]);
  if (result.isErr()) throw result.reason;
  return registry;
}

/** 把现有 LLMTool/Zod 定义注册为 MCP 工具，不复制业务实现。 */
export function registerLLMToolAsMcp<TSchema extends z.ZodType>(
  server: McpServer,
  registry: LLMToolRegistry,
  tool: LLMTool<TSchema>,
  options: AiraMcpToolAdapterOptions
): void {
  const handler = async (
    input: z.infer<TSchema>,
    extra: { signal: AbortSignal }
  ): Promise<CallToolResult> => {
    if (options.requiresRenderer(tool.name) && !options.isRendererAvailable()) {
      return errorResult(tool.name, {
        code: "renderer_unavailable",
        message: "AiraMusic 主界面尚未就绪，无法提供此查询；请打开主界面后重试。",
        retryable: true
      });
    }

    const context: LLMToolContext = {
      conversationID: "mcp",
      signal: extra.signal,
      outputDetail: "standard"
    };
    const result = await registry.execute(
      {
        name: tool.name,
        callID: options.createCallID(),
        arguments: JSON.stringify(input ?? {})
      },
      context,
      [tool.name]
    );

    if (result.isErr()) {
      return errorResult(tool.name, {
        code: result.reason.type,
        message: result.reason.message,
        retryable: isRetryableError(result.reason.type)
      });
    }
    return successResult(result.unwrap());
  };

  server.registerTool(
    tool.name,
    {
      title: toolTitle(tool),
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: getAiraMcpToolAnnotations(tool.name)
    },
    handler as ToolCallback<TSchema>
  );
}

export function registerLLMToolsAsMcp(
  server: McpServer,
  registry: LLMToolRegistry,
  tools: readonly LLMTool[],
  options: AiraMcpToolAdapterOptions
): void {
  for (const tool of tools) registerLLMToolAsMcp(server, registry, tool, options);
}

function successResult(result: LLMToolResult): CallToolResult {
  const payload: AiraMcpSuccessPayload = {
    ok: true,
    tool: result.name,
    // 只能使用已经过 LLMToolRegistry 预算限制的 output，不能把 raw 绕过裁剪后交给 MCP。
    result: parseBoundedOutput(result.output)
  };
  return {
    content: [{ type: "text", text: result.output }],
    structuredContent: payload
  };
}

/**
 * MCP 公共出口的最后一道字段级脱敏。
 * 歌单等公共数据里仍可能夹带创建者或订阅者资料，不能只依赖通用密钥脱敏。
 */
export function sanitizeAiraMcpOutput(value: unknown): unknown {
  return sanitizeMcpValue(value, new WeakSet<object>());
}

function errorResult(tool: string, error: AiraMcpErrorPayload["error"]): CallToolResult {
  const payload: AiraMcpErrorPayload = { ok: false, tool, error };
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload
  };
}

function toolTitle(tool: LLMTool): string {
  const firstLine = tool.description.split(/\r?\n/, 1)[0]?.trim();
  return firstLine?.slice(0, 80) || tool.name;
}

function parseBoundedOutput(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}

function serializeAiraMcpOutput(output: unknown): string {
  if (output === undefined) return "";

  let value = output;
  if (typeof output === "string") {
    try {
      value = JSON.parse(output);
    } catch {
      return output;
    }
  }

  const sanitized = sanitizeAiraMcpOutput(value);
  if (typeof sanitized === "string") return sanitized;
  try {
    return JSON.stringify(sanitized);
  } catch {
    return String(sanitized);
  }
}

function sanitizeMcpValue(value: unknown, visited: WeakSet<object>): unknown {
  if (!value || typeof value !== "object") return value;
  if (visited.has(value)) return "[重复引用已省略]";
  visited.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMcpValue(item, visited));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveMcpOutputKey(key)) continue;
    sanitized[key] = sanitizeMcpValue(child, visited);
  }
  return sanitized;
}

function isSensitiveMcpOutputKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    SensitiveMcpOutputKeys.has(normalized) ||
    normalized.startsWith("avatar") ||
    normalized.startsWith("creator") ||
    normalized.startsWith("owner") ||
    normalized.startsWith("user") ||
    normalized.includes("profile")
  );
}

function isRetryableError(code: string): boolean {
  return code === "network" || code === "service" || code === "timeout";
}
