import type { AIResult } from "@/result";
import type { LLMMessage, LLMGenerateRequest, LLMGenerateResponse } from "@/provider/interface";

export type LLMHistoryCompactionFallback = "error" | "window_only";

export interface LLMHistoryCompactionPolicy {
  targetRatio?: number;
  triggerRatio?: number;
  minRecentTurns?: number;
  keepRecentTurns?: number;
  /** 历史压缩的日常输入软上限；物理上下文窗口仍负责容纳不可裁剪的当前轮。 */
  maxWorkingSetTokens?: number;
  estimator?: LLMTokenEstimator;
  defaultMaxOutputTokens?: number;
  summaryMaxOutputTokens?: number;
  defaultContextWindowTokens?: number;
  fallback?: LLMHistoryCompactionFallback;
}

export interface LLMHistoryCompactionPolicyResolved {
  targetRatio: number;
  triggerRatio: number;
  minRecentTurns: number;
  keepRecentTurns: number;
  estimator: LLMTokenEstimator;
  maxWorkingSetTokens?: number;
  defaultMaxOutputTokens: number;
  summaryMaxOutputTokens: number;
  defaultContextWindowTokens: number;
  fallback: LLMHistoryCompactionFallback;
}

export interface LLMHistoryBudgetRuntimeLimits {
  contextWindowTokens?: number;
  outputReserveTokens?: number;
}

export interface LLMConversationCompactionSnapshot {
  version: 1;
  summary: string;
  updatedAt: number;
  coveredDigest: string;
  coveredMessageCount: number;
  fallback?: {
    attempt: number;
    retryAt: number;
    lastError: string;
    /** 摘要服务恢复后应从这里继续；null 表示从完整原始历史重新摘要。 */
    retryState?: null | LLMConversationCompactionRetrySnapshot;
  };
}

export interface LLMConversationCompactionRetrySnapshot {
  summary: string;
  updatedAt: number;
  coveredDigest: string;
  coveredMessageCount: number;
}

export interface LLMTokenEstimator {
  estimateText(text: string): number;
  estimateRequest(request: LLMGenerateRequest): number;
  estimateMessages(messages: readonly LLMMessage[]): number;
}

export type LLMHistorySummarize = NormalFunc<
  [request: LLMGenerateRequest],
  Promise<AIResult<LLMGenerateResponse>>
>;

export interface LLMHistoryTurn {
  end: number;
  start: number;
  messages: LLMMessage[];
}

export interface LLMHistoryCompactionResult {
  warnings: string[];
  retainedTurnCount: number;
  request: LLMGenerateRequest;
  estimatedInputTokens: number;
  compactedMessageCount: number;
  state?: LLMConversationCompactionSnapshot;
}
