import { AIError } from "@/result";

import type { LLMUsage } from "./interface";

const UsageKeys = [
  "inputTokens",
  "outputTokens",
  "totalTokens",
  "reasoningTokens",
  "cacheWriteTokens",
  "cachedInputTokens",
  "requestCount",
  "lastInputTokens"
] as const satisfies readonly (keyof LLMUsage)[];

/** 把提供方已经返回的用量附着到错误上，避免失败请求从账单统计中消失。 */
export function attachLLMUsageToError(error: AIError, usage?: LLMUsage): AIError {
  if (!usage) return error;
  return new AIError({
    type: error.type,
    name: error.name,
    message: error.message,
    raw: {
      cause: error.raw,
      usage: structuredClone(usage)
    }
  });
}

/** 只读取由 AI 子包写入且字段合法的错误用量。 */
export function readLLMUsageFromError(error: AIError): LLMUsage | undefined {
  if (!error.raw || typeof error.raw !== "object" || Array.isArray(error.raw)) return undefined;
  const rawUsage = (error.raw as Record<string, unknown>)["usage"];
  if (!rawUsage || typeof rawUsage !== "object" || Array.isArray(rawUsage)) return undefined;

  const usage: LLMUsage = {};
  for (const key of UsageKeys) {
    const value = (rawUsage as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) usage[key] = value;
  }
  return Object.keys(usage).length ? usage : undefined;
}
