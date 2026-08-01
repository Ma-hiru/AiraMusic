import type { LLMConversation } from "@/conversations";
import type { LLMToolChoice, LLMToolRegistry } from "@/tools";
import type { LLMMessageText, LLMGenerateRequest } from "@/provider";
import type { LLMHistoryBudget, LLMHistorySummarize, LLMHistoryCompactionResult } from "@/history";
import type {
  LLMContextComposer,
  LLMContextComposeResult,
  LLMContextComposeOptions
} from "@/context";

export type LLMPromptContextOptions = Omit<LLMContextComposeOptions, "signal"> & {
  composer: LLMContextComposer;
  placement?: "prefix" | "before_user";
};

export interface LLMPromptToolOptions {
  strict: boolean;
  choice: LLMToolChoice;
  selectedNames?: string[];
  /** 只有这些工具可由已选工具在当前循环中延迟激活。 */
  registry: LLMToolRegistry;
  activatableNames?: string[];
  maxTotalOutputChars?: number;
  maxRetainedToolOutputChars?: number;
}

export interface LLMPromptBuildOptions {
  input: string;
  signal: AbortSignal;
  /** 仅用于本次请求的可信开发者指令，例如已激活的技能。 */
  temperature?: number;
  maxOutputTokens?: number;
  contextWindowTokens?: number;
  tools?: LLMPromptToolOptions;
  conversation: LLMConversation;
  instructions?: readonly string[];
  context?: LLMPromptContextOptions;
  historyRuntime?: {
    summarize: LLMHistorySummarize;
  };
}

export interface LLMPromptBuildResult {
  request: LLMGenerateRequest;
  userMessage: LLMMessageText;
  historyBudget?: LLMHistoryBudget;
  context?: LLMContextComposeResult;
  history?: LLMHistoryCompactionResult;
  /** 仅用于本次请求、不得持久化到会话中的上下文和指令。 */
  transientMessages?: LLMMessageText[];
}
