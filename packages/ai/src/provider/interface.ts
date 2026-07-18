import { z } from "zod";
import { AIResult } from "@/result";
import { LLMMinimumContextWindowTokens } from "@/model/limits";
import type { LLMToolChoice } from "@/tools/interface";
import type { LLMToolCall, LLMToolDefinition } from "@/tools";

export type LLMProviderConfigValue = number | string | boolean;
export type LLMProviderConfigInput = Record<string, LLMProviderConfigValue>;

export interface LLMProviderConfig {
  model: string;
  apiKey: string;
  baseURL?: string;
  timeoutMs?: number;
  contextWindowTokens?: number;
}

export interface LLMProviderConfigPublic extends LLMProviderConfig {
  apiKey: `${string}****${string}`;
}

export const LLMProviderConfigSchema = z.object({
  model: z.string().trim().min(1, "缺少配置模型").meta({
    title: "模型",
    description: "Provider 请求使用的模型 ID"
  }),
  baseURL: z.string().trim().min(1, "Base URL 不能为空").optional().meta({
    title: "Base URL",
    description: "可选的 API Endpoint；留空时使用 Provider 默认地址"
  }),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .meta({
      title: "请求超时",
      description: "单次请求超时时间，单位为毫秒",
      examples: [15000]
    }),
  contextWindowTokens: z
    .number()
    .int()
    .min(
      LLMMinimumContextWindowTokens,
      `上下文窗口至少需要 ${LLMMinimumContextWindowTokens} tokens`
    )
    .optional()
    .meta({
      title: "上下文窗口",
      description: `模型可用的总上下文 token 数，至少 ${LLMMinimumContextWindowTokens}；留空时按内置模型表解析`,
      examples: [128000]
    }),
  apiKey: z.string().trim().min(1, "缺少 API Key").meta({
    title: "API Key",
    description: "仅交给主进程安全存储，不会在配置列表中明文返回",
    format: "password",
    writeOnly: true
  })
});

export type LLMProviderConfigJSONSchema = z.core.JSONSchema.BaseSchema;

export interface LLMProviderDescriptor {
  id: string;
  label: string;
  description?: string;
  configSchema: LLMProviderConfigJSONSchema;
}

export interface LLMProviderCapabilities {
  /** Provider 是否接受 toolChoice=required。 */
  supportsRequiredToolChoice: boolean;
}

export interface LLMProviderOptions<TConfig extends LLMProviderConfig> {
  label?: string;
  description?: string;
  configSchema?: z.ZodType<TConfig>;
}

export abstract class LLMProvider<
  TConfig extends LLMProviderConfig = LLMProviderConfig,
  TGenerateResponse = unknown,
  TStreamResponse = unknown
> {
  readonly name: string;
  readonly label: string;
  readonly description?: string;
  readonly configSchema: z.ZodType<LLMProviderConfig>;

  protected constructor(name: string, options: LLMProviderOptions<TConfig> = {}) {
    this.name = name;
    this.label = options.label ?? name;
    this.description = options.description;
    this.configSchema =
      (options.configSchema as unknown as undefined | z.ZodType<LLMProviderConfig>) ??
      LLMProviderConfigSchema.passthrough();
  }

  get descriptor(): LLMProviderDescriptor {
    return {
      id: this.name,
      label: this.label,
      configSchema: z.toJSONSchema(this.configSchema, { io: "input" }),
      ...(this.description ? { description: this.description } : {})
    };
  }

  parseConfig<T extends TConfig = TConfig>(input: unknown): AIResult<T> {
    const parsed = this.configSchema.safeParse(input);
    if (parsed.success) return AIResult.ok(parsed.data as T);

    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    return AIResult.err({
      type: "invalid_config",
      raw: parsed.error,
      message: `${this.label} 配置无效：${path}${issue?.message ?? "未知字段错误"}`
    });
  }

  /**
   * 默认保持既有 Provider 的行为；需要兼容能力较弱端点的 Provider 应按配置覆盖。
   */
  getCapabilities<T extends TConfig>(config: T): LLMProviderCapabilities {
    void config;
    return { supportsRequiredToolChoice: true };
  }

  /**
   * 把调用方期望的工具选择收敛到 Provider 已声明支持的范围。
   * auto 仍允许模型主动调用工具，是 required 不可用时最接近的安全降级。
   */
  resolveToolChoice<T extends TConfig>(
    config: T,
    toolChoice?: LLMToolChoice
  ): undefined | LLMToolChoice {
    if (toolChoice === "required" && !this.getCapabilities(config).supportsRequiredToolChoice) {
      return "auto";
    }
    return toolChoice;
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

export interface LLMProviderContext {
  data: unknown;
  provider: string;
}

export interface LLMGenerateResponse<TRaw = unknown> {
  raw: TRaw;
  text: string;
  usage?: LLMUsage;
  toolCalls: LLMToolCall[];
  finishReason: LLMFinishReason;
  providerContext?: LLMProviderContext;
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
      providerContext?: LLMProviderContext;
    };

export interface LLMCheckResponse {
  model: string;
  provider: string;
}

export interface LLMUsage {
  inputTokens?: number;
  totalTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cacheWriteTokens?: number;
  cachedInputTokens?: number;
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
  providerContext?: LLMProviderContext;
}

export interface LLMMessageToolResult {
  name: string;
  role: "tool";
  callID: string;
  content: string;
}
