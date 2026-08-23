import type { AgentAssistantTurnObservability, AgentTokenUsage } from "../types";

export const formatTokenCount = (value: number) => {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${trimDecimal(value / 1_000)}K`;
  return `${trimDecimal(value / 1_000_000)}M`;
};

export const getUncachedInputTokens = (usage?: AgentTokenUsage) => {
  if (usage?.input === undefined || usage.cachedInput === undefined) return undefined;
  return Math.max(0, usage.input - usage.cachedInput);
};

export const toTerminalError = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim() || undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const code = typeof record["code"] === "string" ? record["code"] : undefined;
  const message = typeof record["message"] === "string" ? record["message"] : undefined;
  if (code && message) return `${code}: ${message}`;
  return message ?? code;
};

export const parseAgentTurnUsage = (
  value: unknown
): undefined | Pick<AgentAssistantTurnObservability, "step" | "usage"> => {
  const turnUsage = asRecord(value);
  const records = turnUsage?.["records"];
  if (!Array.isArray(records) || !records.length) return undefined;

  let input = 0;
  let output = 0;
  let lastInput = 0;
  let lastStep = 0;
  for (const value of records) {
    const record = asRecord(value);
    const usage = asRecord(record?.["usage"]);
    const step = readUnsignedInteger(record?.["step"]);
    const promptTokens = readUnsignedInteger(usage?.["prompt_tokens"]);
    const completionTokens = readUnsignedInteger(usage?.["completion_tokens"]);
    if (step === undefined || promptTokens === undefined || completionTokens === undefined) {
      return undefined;
    }
    input += promptTokens;
    output += completionTokens;
    lastInput = promptTokens;
    lastStep = step;
  }

  return {
    step: lastStep,
    usage: {
      input,
      output,
      lastInput,
      requests: records.length,
      total: input + output
    }
  };
};

const asRecord = (value: unknown): undefined | Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const readUnsignedInteger = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

const trimDecimal = (value: number) => value.toFixed(1).replace(/\.0$/, "");
