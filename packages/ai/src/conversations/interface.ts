import type { AIErrorCode } from "@/result";
import type { LLMMessage, LLMFinishReason } from "@/provider";
import type { LLMConversationCompactionSnapshot } from "@/history";

export type LLMConversationRuntimeStatus =
  | "idle"
  | "failed"
  | "aborted"
  | "running"
  | "completed"
  | "max_steps";

export type LLMConversationAssistantTurnStatus = "complete" | "incomplete";

export interface LLMConversationUsage {
  input?: number;
  total?: number;
  output?: number;
  reasoning?: number;
  cacheWrite?: number;
  cachedInput?: number;
}

export interface LLMConversationRuntimeSnapshot {
  runID: string;
  endedAt?: number;
  startedAt: number;
  terminal: boolean;
  incomplete: boolean;
  /** 回退该轮时一并撤销自动生成的标题。 */
  titleGenerated?: boolean;
  /** 用于安全回退最近一次中止运行。 */
  inputMessageIndex?: number;
  usage?: LLMConversationUsage;
  status: LLMConversationRuntimeStatus;
  error?: {
    message: string;
    type: AIErrorCode;
  };
}

export interface LLMConversationAssistantTurnSnapshot {
  step: number;
  runID: string;
  messageIndex: number;
  usage?: LLMConversationUsage;
  finishReason?: LLMFinishReason;
  status: LLMConversationAssistantTurnStatus;
}

export interface LLMConversationSnapshot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messages: LLMMessage[];
  metadata: Record<string, unknown>;
  runtime?: LLMConversationRuntimeSnapshot;
  compaction?: LLMConversationCompactionSnapshot;
  assistantTurns?: LLMConversationAssistantTurnSnapshot[];
}

export interface LLMConversationCreateOptions {
  id: string;
  name?: string;
  messages?: LLMMessage[];
  metadata?: Record<string, unknown>;
  runtime?: LLMConversationRuntimeSnapshot;
  assistantTurns?: LLMConversationAssistantTurnSnapshot[];
}
