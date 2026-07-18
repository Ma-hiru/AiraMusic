import type { LLMMessage, AIAgentEvent } from "@mahiru/ai";
import type {
  AgentTokenUsage,
  AgentRunTerminal,
  AgentAssistantTurnObservability
} from "@/wins/agent/page/types";

export type AgentEventReplayEntry = {
  sequence: number;
  event: AIAgentEvent;
};

export type AgentEventEnvelope = {
  sequence?: number;
  event: AIAgentEvent;
};

const MAX_EVENT_REPLAY = 128;

export const readAssistantTurn = (
  snapshot: unknown,
  messageIndex: number,
  message?: LLMMessage
): undefined | AgentAssistantTurnObservability => {
  const snapshotRecord = asRecord(snapshot);
  const turns = Array.isArray(snapshotRecord?.["assistantTurns"])
    ? snapshotRecord["assistantTurns"]
    : [];
  const turn = turns.find((item) => {
    const record = asRecord(item);
    return record?.["messageIndex"] === messageIndex;
  });
  const turnRecord = asRecord(turn);
  const messageRecord = asRecord(message);
  const usage = mergeUsage(messageRecord?.["usage"], turnRecord?.["usage"]);
  const status = readTurnStatus(turnRecord?.["status"] ?? messageRecord?.["status"]);
  const finishReason = readString(turnRecord?.["finishReason"] ?? messageRecord?.["finishReason"]);
  const step = readFiniteNumber(turnRecord?.["step"] ?? messageRecord?.["step"]);
  const runID = readString(turnRecord?.["runID"] ?? messageRecord?.["runID"]);

  if (!usage && !status && !finishReason && step === undefined && !runID) return undefined;
  return {
    step: step ?? 0,
    status: status ?? "complete",
    ...(runID ? { runID } : {}),
    ...(finishReason ? { finishReason } : {}),
    ...(usage ? { usage } : {})
  };
};

export const readRunTerminal = (snapshot: unknown): undefined | AgentRunTerminal => {
  const snapshotRecord = asRecord(snapshot);
  const runtime = asRecord(snapshotRecord?.["runtime"]);
  const status = readTerminalStatus(runtime?.["status"]);
  if (status && runtime) {
    const runID = readString(runtime?.["runID"]);
    const usage = mergeUsage(undefined, runtime["usage"]);
    return {
      id: runID ? `${runID}-terminal` : "snapshot-terminal",
      type: "terminal",
      status,
      ...(runID ? { runID } : {}),
      ...(usage ? { usage } : {}),
      ...readTerminalDetails(runtime)
    };
  }

  const turns = Array.isArray(snapshotRecord?.["assistantTurns"])
    ? snapshotRecord["assistantTurns"]
    : [];
  const lastIncomplete = [...turns].reverse().find((item) => {
    return asRecord(item)?.["status"] === "incomplete";
  });
  const turnRecord = asRecord(lastIncomplete);
  const fallbackStatus = readTerminalStatus(turnRecord?.["finishReason"]);
  if (!fallbackStatus) return undefined;
  const usage = mergeUsage(undefined, turnRecord?.["usage"]);
  const runID = readString(turnRecord?.["runID"]);

  return {
    type: "terminal",
    status: fallbackStatus,
    ...(runID ? { runID } : {}),
    ...(usage ? { usage } : {}),
    id: runID
      ? `${runID}-terminal`
      : `assistant-turn-${readFiniteNumber(turnRecord?.["messageIndex"]) ?? "last"}-terminal`
  };
};

export const readAgentEventReplay = (...sources: unknown[]): AgentEventReplayEntry[] => {
  const candidates = sources.flatMap(readReplayCandidates);
  const bySequence = new Map<number, AgentEventReplayEntry>();

  for (const [index, candidate] of candidates.entries()) {
    const entry = readReplayEntry(candidate, index);
    if (entry) bySequence.set(entry.sequence, entry);
  }

  return [...bySequence.values()]
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-MAX_EVENT_REPLAY);
};

export const readPersistedAssistantSteps = (snapshot: unknown, runID: string) => {
  const snapshotRecord = asRecord(snapshot);
  const turns = Array.isArray(snapshotRecord?.["assistantTurns"])
    ? snapshotRecord["assistantTurns"]
    : [];
  return new Set(
    turns.flatMap((item) => {
      const turn = asRecord(item);
      const step = readFiniteNumber(turn?.["step"]);
      return turn?.["runID"] === runID && turn["status"] === "complete" && step !== undefined
        ? [step]
        : [];
    })
  );
};

export const readAgentEventEnvelope = (value: unknown): undefined | AgentEventEnvelope => {
  const record = asRecord(value);
  if (!record) return undefined;
  const nestedEvent = asRecord(record["event"]);
  const event = nestedEvent ?? record;
  if (!isAgentEvent(event)) return undefined;
  const sequence = readFiniteNumber(
    record["sequence"] ??
      record["cursor"] ??
      record["eventID"] ??
      event["sequence"] ??
      event["cursor"]
  );
  return {
    event: event as unknown as AIAgentEvent,
    ...(sequence !== undefined ? { sequence } : {})
  };
};

export const formatTokenCount = (value: number) => {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${trimDecimal(value / 1_000)}K`;
  return `${trimDecimal(value / 1_000_000)}M`;
};

export const getUncachedInputTokens = (usage?: AgentTokenUsage) => {
  if (usage?.input === undefined || usage.cachedInput === undefined) return undefined;
  return Math.max(0, usage.input - usage.cachedInput);
};

export const readTokenUsage = (value: unknown) => readUsage(value);

export const getAgentEventFingerprint = (event: AIAgentEvent) => {
  switch (event.type) {
    case "started":
      return `${event.runID}:started:${event.at}`;
    case "title":
      return `${event.runID}:title:${event.title}`;
    case "text_delta":
      return `${event.runID}:text:${event.step}:${event.text}`;
    case "tool_call":
      return `${event.runID}:tool-call:${event.step}:${event.toolCalls.map((call) => call.callID).join(",")}`;
    case "tool_result":
      return `${event.runID}:tool-result:${event.step}:${event.toolResults.map((result) => result.callID).join(",")}`;
    case "done":
    case "aborted":
    case "error":
      return `${event.runID}:${event.type}`;
  }
};

export const toTerminalError = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim() || undefined;
  const record = asRecord(value);
  if (!record) return undefined;
  const type = readString(record["type"]);
  const message = readString(record["message"]);
  if (type && message) return `${type}: ${message}`;
  return message ?? type;
};

const readTerminalDetails = (runtime: Record<string, unknown>) => {
  const error = toTerminalError(runtime["error"]);
  const endedAt = readFiniteNumber(runtime["endedAt"]);
  const startedAt = readFiniteNumber(runtime["startedAt"]);
  return {
    ...(error ? { error } : {}),
    ...(endedAt !== undefined ? { endedAt } : {}),
    ...(startedAt !== undefined ? { startedAt } : {})
  };
};

const readReplayCandidates = (source: unknown): unknown[] => {
  if (Array.isArray(source)) return source;
  const record = asRecord(source);
  if (!record) return [];

  for (const key of ["eventReplay", "replay", "events"] as const) {
    if (Array.isArray(record[key])) return record[key];
  }

  const runtime = asRecord(record["runtime"]);
  if (runtime) {
    for (const key of ["eventReplay", "replay", "events"] as const) {
      if (Array.isArray(runtime[key])) return runtime[key];
    }
  }

  const nestedSnapshot = asRecord(record["snapshot"]);
  return nestedSnapshot ? readReplayCandidates(nestedSnapshot) : [];
};

const readReplayEntry = (value: unknown, legacyIndex = 0): undefined | AgentEventReplayEntry => {
  const record = asRecord(value);
  if (!record) return undefined;

  const nestedEvent = asRecord(record["event"]);
  const event = nestedEvent ?? record;
  if (!isAgentEvent(event)) return undefined;

  const rawSequence =
    record["sequence"] ??
    record["cursor"] ??
    record["eventID"] ??
    event["sequence"] ??
    event["cursor"] ??
    legacyIndex;
  const sequence = readFiniteNumber(rawSequence);
  if (sequence === undefined) return undefined;

  return {
    sequence,
    event: event as unknown as AIAgentEvent
  };
};

const isAgentEvent = (value: Record<string, unknown>) => {
  return (
    typeof value["type"] === "string" &&
    typeof value["runID"] === "string" &&
    typeof value["conversationID"] === "string"
  );
};

const mergeUsage = (fallback: unknown, preferred: unknown): undefined | AgentTokenUsage => {
  const fallbackUsage = readUsage(fallback);
  const preferredUsage = readUsage(preferred);
  if (!fallbackUsage && !preferredUsage) return undefined;

  const usage = {
    input: preferredUsage?.input ?? fallbackUsage?.input,
    output: preferredUsage?.output ?? fallbackUsage?.output,
    total: preferredUsage?.total ?? fallbackUsage?.total,
    reasoning: preferredUsage?.reasoning ?? fallbackUsage?.reasoning,
    cacheWrite: preferredUsage?.cacheWrite ?? fallbackUsage?.cacheWrite,
    cachedInput: preferredUsage?.cachedInput ?? fallbackUsage?.cachedInput
  };
  if (usage.total === undefined && (usage.input !== undefined || usage.output !== undefined)) {
    usage.total = (usage.input ?? 0) + (usage.output ?? 0);
  }
  return Object.fromEntries(
    Object.entries(usage).filter(([, item]) => item !== undefined)
  ) as AgentTokenUsage;
};

const readUsage = (value: unknown): undefined | AgentTokenUsage => {
  const record = asRecord(value);
  if (!record) return undefined;

  const inputDetails = asRecord(record["inputTokensDetails"] ?? record["input_tokens_details"]);
  const outputDetails = asRecord(record["outputTokensDetails"] ?? record["output_tokens_details"]);
  const usage = {
    input: readFirstNumber(record, ["input", "inputTokens", "input_tokens", "promptTokens"]),
    output: readFirstNumber(record, [
      "output",
      "outputTokens",
      "output_tokens",
      "completionTokens"
    ]),
    total: readFirstNumber(record, ["total", "totalTokens", "total_tokens"]),
    reasoning:
      readFirstNumber(record, ["reasoning", "reasoningTokens", "reasoning_tokens"]) ??
      readFirstNumber(outputDetails, ["reasoningTokens", "reasoning_tokens"]),
    cacheWrite: readFirstNumber(record, ["cacheWrite", "cacheWriteTokens", "cache_write_tokens"]),
    cachedInput:
      readFirstNumber(record, ["cachedInput", "cachedInputTokens", "cached_input_tokens"]) ??
      readFirstNumber(inputDetails, ["cachedTokens", "cached_tokens"])
  } satisfies AgentTokenUsage;

  return Object.values(usage).some((item) => item !== undefined) ? usage : undefined;
};

const readFirstNumber = (record: undefined | Record<string, unknown>, keys: readonly string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = readFiniteNumber(record[key]);
    if (value !== undefined) return value;
  }
  return undefined;
};

const readTurnStatus = (value: unknown): undefined | "complete" | "incomplete" => {
  if (value === "complete" || value === "incomplete") return value;
  return undefined;
};

const readTerminalStatus = (value: unknown): "failed" | "aborted" | undefined | "max_steps" => {
  if (typeof value !== "string") return undefined;
  switch (value.toLowerCase().replaceAll("-", "_")) {
    case "failed":
    case "error":
      return "failed";
    case "aborted":
    case "cancelled":
    case "canceled":
      return "aborted";
    case "max_step":
    case "max_steps":
    case "maxsteps":
      return "max_steps";
    default:
      return undefined;
  }
};

const readFiniteNumber = (value: unknown): number | undefined => {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
};

const readString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const asRecord = (value: unknown): undefined | Record<string, unknown> => {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
};

const trimDecimal = (value: number) => value.toFixed(1).replace(/\.0$/, "");
