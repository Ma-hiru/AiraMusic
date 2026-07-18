import { z } from "zod";
import { LLMProviderConfigSchema } from "@/provider/interface";
import type OpenAI from "openai";

export const LLMProviderOpenAIAPIModes = ["responses", "chat_completions"] as const;
export type LLMProviderOpenAIAPIMode = (typeof LLMProviderOpenAIAPIModes)[number];

export const LLMProviderOpenAIChatTokenLimitFields = [
  "auto",
  "max_completion_tokens",
  "max_tokens"
] as const;
export type LLMProviderOpenAIChatTokenLimitField =
  (typeof LLMProviderOpenAIChatTokenLimitFields)[number];

export const LLMProviderOpenAIChatInstructionRoles = ["auto", "developer", "system"] as const;
export type LLMProviderOpenAIChatInstructionRole =
  (typeof LLMProviderOpenAIChatInstructionRoles)[number];

export const LLMProviderOpenAIChatStreamUsageModes = ["auto", "include", "omit"] as const;
export type LLMProviderOpenAIChatStreamUsageMode =
  (typeof LLMProviderOpenAIChatStreamUsageModes)[number];

export const LLMProviderOpenAIChatToolStrictModes = ["auto", "include", "omit"] as const;
export type LLMProviderOpenAIChatToolStrictMode =
  (typeof LLMProviderOpenAIChatToolStrictModes)[number];

export const LLMProviderOpenAIRequiredToolChoiceModes = ["auto", "include", "omit"] as const;
export type LLMProviderOpenAIRequiredToolChoiceMode =
  (typeof LLMProviderOpenAIRequiredToolChoiceModes)[number];

export type LLMProviderOpenAIGenerateResponse<T extends LLMProviderOpenAIAPIMode> =
  T extends "responses" ? OpenAI.Responses.Response : OpenAI.Chat.Completions.ChatCompletion;

export type LLMProviderOpenAIStreamResponse<T extends LLMProviderOpenAIAPIMode> =
  T extends "responses" ? OpenAI.Responses.Response : OpenAI.Chat.Completions.ChatCompletionChunk;

export const LLMProviderOpenAIConfigSchema = z
  .object({
    model: LLMProviderConfigSchema.shape.model.meta({
      title: "模型",
      description: "OpenAI 或兼容服务提供的模型 ID",
      examples: ["gpt-5"]
    }),
    apiMode: z.enum(LLMProviderOpenAIAPIModes).default("responses").meta({
      title: "API 模式",
      description: "Responses 为新接口；Chat Completions 用于旧接口或兼容服务"
    }),
    chatTokenLimitField: z.enum(LLMProviderOpenAIChatTokenLimitFields).default("auto").meta({
      title: "Chat token 上限字段",
      description:
        "自动模式会为 OpenAI 官方接口及新模型使用 max_completion_tokens，旧兼容接口使用 max_tokens"
    }),
    chatInstructionRole: z.enum(LLMProviderOpenAIChatInstructionRoles).default("auto").meta({
      title: "Chat 指令角色",
      description: "自动模式会为 o 系列、GPT-4.1 与 GPT-5 使用 developer，兼容接口使用 system"
    }),
    chatStreamUsage: z.enum(LLMProviderOpenAIChatStreamUsageModes).default("auto").meta({
      title: "Chat 流式 usage",
      description:
        "自动模式仅在 OpenAI 官方接口发送 stream_options.include_usage；兼容接口可显式开启或关闭"
    }),
    chatToolStrict: z.enum(LLMProviderOpenAIChatToolStrictModes).default("auto").meta({
      title: "Chat 工具严格模式",
      description: "自动模式仅在 OpenAI 官方接口发送 function.strict；兼容接口可显式开启或关闭"
    }),
    requiredToolChoice: z.enum(LLMProviderOpenAIRequiredToolChoiceModes).default("auto").meta({
      title: "Required 工具选择",
      description:
        "自动模式仅对 OpenAI 官方端点启用；确认兼容服务支持 tool_choice=required 后可显式开启"
    }),
    baseURL: LLMProviderConfigSchema.shape.baseURL.meta({
      title: "Base URL",
      description: "可选的 OpenAI 兼容 Endpoint；留空时使用官方地址",
      examples: ["https://api.openai.com/v1"]
    }),
    contextWindowTokens: LLMProviderConfigSchema.shape.contextWindowTokens,
    timeoutMs: LLMProviderConfigSchema.shape.timeoutMs,
    apiKey: LLMProviderConfigSchema.shape.apiKey.meta({
      title: "API Key",
      description: "仅交给主进程安全存储，不会在配置列表中明文返回",
      examples: ["sk-..."],
      format: "password",
      writeOnly: true
    })
  })
  .strict();

export type LLMProviderOpenAIConfig = z.infer<typeof LLMProviderOpenAIConfigSchema>;
