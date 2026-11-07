import type { ThreadSnapshot } from "@mahiru/agent/browser";

import type {
  AgentTokenUsage,
  AgentRunTerminal,
  AgentAssistantTurnObservability
} from "./interface";

export const formatTokenCount = (value: number) => {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${trimDecimal(value / 1_000)}K`;
  return `${trimDecimal(value / 1_000_000)}M`;
};

export const getUncachedInputTokens = (usage?: AgentTokenUsage) => {
  if (usage?.input === undefined || usage.cachedInput === undefined) return undefined;
  if (usage.coverage === "partial" || usage.coverage === "unknown") return undefined;
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
  if (!Array.isArray(records)) return undefined;
  const requests = readUnsignedInteger(turnUsage?.["requests"]);
  const lastStep = readUnsignedInteger(turnUsage?.["last_step"]);
  if (
    (turnUsage?.["requests"] != null && requests === undefined) ||
    (turnUsage?.["last_step"] != null && lastStep === undefined) ||
    (requests !== undefined && requests < records.length) ||
    (!records.length && requests === undefined)
  ) {
    return undefined;
  }

  let input = 0;
  let output = 0;
  let total = 0;
  let lastInput: number | undefined;
  let lastReportedStep = 0;
  const details = {
    cached_tokens: [] as number[],
    cache_write_tokens: [] as number[],
    reasoning_tokens: [] as number[]
  };
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
    const totalTokens = readUnsignedInteger(usage?.["total_tokens"]);
    if (usage?.["total_tokens"] != null && totalTokens === undefined) return undefined;
    total += totalTokens ?? promptTokens + completionTokens;
    if (step >= lastReportedStep) {
      lastInput = promptTokens;
      lastReportedStep = step;
    }
    for (const key of Object.keys(details) as (keyof typeof details)[]) {
      const tokens = readUnsignedInteger(usage?.[key]);
      if (usage?.[key] != null && tokens === undefined) return undefined;
      if (tokens !== undefined) details[key].push(tokens);
    }
  }

  const coverage =
    requests === undefined ? "unknown" : requests === records.length ? "complete" : "partial";
  const completeDetail = (values: number[]) =>
    coverage === "complete" && records.length > 0 && values.length === records.length
      ? values.reduce((sum, value) => sum + value, 0)
      : undefined;
  const lastInputStatus =
    requests === 0
      ? "not_requested"
      : lastStep === undefined
        ? "unknown"
        : lastInput !== undefined && lastReportedStep === lastStep
          ? "reported"
          : "missing";
  return {
    step: lastStep ?? lastReportedStep,
    usage: {
      requests,
      coverage,
      lastInputStatus,
      reportedRequests: records.length,
      ...(records.length ? { input, output, total } : {}),
      ...(lastInputStatus === "reported" ? { lastInput } : {}),
      cachedInput: completeDetail(details.cached_tokens),
      cacheWrite: completeDetail(details.cache_write_tokens),
      reasoning: completeDetail(details.reasoning_tokens)
    }
  };
};

export const parseStoredTurnUsage = (content: string) => {
  try {
    return parseAgentTurnUsage(JSON.parse(content) as unknown);
  } catch {
    return undefined;
  }
};

/** 只有最新一轮的错误能使用 runtime.runId，历史消息没有持久化 runId。 */
export const storedRunErrorTerminal = (
  conversation: ThreadSnapshot,
  index: number
): AgentRunTerminal => {
  const latestUserIndex = conversation.messages.findLastIndex((message) => message.role === "user");
  const runID =
    conversation.runtime.status === "failed" && index > latestUserIndex
      ? conversation.runtime.runId
      : undefined;
  return {
    type: "terminal",
    status: "failed",
    id: runID ? `${runID}-terminal` : `stored-error-${index}`,
    ...(runID ? { runID } : {}),
    error: toTerminalError(conversation.messages[index]?.content)
  };
};

export const readStoredRunFailure = (conversation: ThreadSnapshot) => {
  if (conversation.runtime.status !== "failed") return undefined;
  let usage: undefined | AgentTokenUsage;
  for (let index = conversation.messages.length - 1; index >= 0; index--) {
    const message = conversation.messages[index];
    if (!message || message.role === "user") break;
    if (message.role !== "inner") continue;
    if (message.innerType === "usage") usage = parseStoredTurnUsage(message.content)?.usage;
    if (message.innerType === "error") {
      return { ...storedRunErrorTerminal(conversation, index), ...(usage ? { usage } : {}) };
    }
  }
  return undefined;
};

const asRecord = (value: unknown): undefined | Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const readUnsignedInteger = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

const trimDecimal = (value: number) => value.toFixed(1).replace(/\.0$/, "");
