import type { UIMessage } from "ai";

export type AgentTokenUsage = {
  input?: number;
  total?: number;
  output?: number;
  requests?: number;
  lastInput?: number;
  reasoning?: number;
  cacheWrite?: number;
  cachedInput?: number;
  reportedRequests?: number;
  coverage?: "partial" | "unknown" | "complete";
  lastInputStatus?: "missing" | "unknown" | "reported" | "not_requested";
};

export type AgentAssistantTurnObservability = {
  step: number;
  runID?: string;
  finishReason?: string;
  usage?: AgentTokenUsage;
  status: "complete" | "incomplete";
};

export type AgentRunTerminal = {
  id: string;
  error?: string;
  runID?: string;
  endedAt?: number;
  type: "terminal";
  startedAt?: number;
  usage?: AgentTokenUsage;
  status: "failed" | "aborted" | "max_steps";
};

export interface AgentMessageMetadata {
  runID?: string;
  terminal?: AgentRunTerminal;
  turns?: AgentAssistantTurnObservability[];
}

export type AgentUIMessage = UIMessage<AgentMessageMetadata>;
