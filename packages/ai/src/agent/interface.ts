import { LLMConversation, type LLMConversationSnapshot } from "@/conversations";
import {
  type LLMUsage,
  type LLMMessage,
  type LLMProvider,
  type LLMFinishReason,
  type LLMMessageToolCall
} from "@/provider";
import type { AIInject } from "@/inject";
import type { AIErrorCode } from "@/result";
import type { LLMHistoryCompactionPolicy } from "@/history";
import type { AIAgentInstructionDefinition } from "@/skills";
import type { LLMTool, LLMToolCall, LLMToolChoice } from "@/tools";
import type { LLMContextSource, LLMContextMessageRole } from "@/context";
import type { LLMProviderConfig, LLMProviderConfigInput } from "@/provider/interface";

export interface AIAgentOptions {
  inject: AIInject;
  maxSteps: number;
  titlePrompt: string;
  systemPrompt: string;
  titleMaxOutputTokens: number;
  history?: false | LLMHistoryCompactionPolicy;
  providers: Iterable<LLMProvider<any, any, any>>;
  skills?: {
    list: Iterable<AIAgentInstructionDefinition>;
  };
  /** 为 Skill 和动态工具路由生成统一的有效意图；不会改写真实用户消息。 */
  resolveIntent?: NormalFunc<[context: { input: string; conversation: LLMConversation }], string>;
  transformFinalText?: NormalFunc<
    [context: { text: string; messages: readonly LLMMessage[] }],
    string
  >;
  context?: {
    maxChars: number;
    sources: LLMContextSource[];
    defaultRole: LLMContextMessageRole;
    placement?: "prefix" | "before_user";
  };
  tools?: {
    list: LLMTool[];
    strict: boolean;
    choice: LLMToolChoice;
    maxOutputChars?: number;
    /** 单次 Agent 循环内所有工具结果首次进入上下文时的累计字符预算。 */
    maxTotalOutputChars?: number;
    parallelSafeNames?: Iterable<string>;
    /** 中止后可安全重新执行的工具；默认不信任任何工具。 */
    retrySafeNames?: Iterable<string>;
    serializeOutput?: NormalFunc<[output: unknown], string>;
    select?: NormalFunc<
      [context: { input: string; rawInput: string; conversation: LLMConversation }],
      Iterable<string>
    >;
  };
}

export interface AIAgentCreateConfigOptions<TConfig = LLMProviderConfig> {
  id?: string;
  name: string;
  config: TConfig;
  provider: string;
}

export interface AIAgentUpdateConfigOptions<TConfig = LLMProviderConfigInput> {
  id: string;
  name: string;
  config: TConfig;
  provider: string;
}

export interface AIAgentCreateConversationResult {
  id: string;
}

export interface AIAgentChatOptions {
  input: string;
  configID: string;
  temperature?: number;
  conversationID: string;
  maxOutputTokens?: number;
  /** 仅当该 ID 仍是会话最近一次中止运行时，替换整轮后重新生成。 */
  retryAbortedRunID?: string;
}

export interface AIAgentRunState {
  runID: string;
  configID: string;
  conversationID: string;
  controller: AbortController;
}

export interface AIAgentRunContext extends AIAgentRunState {
  input: string;
  startedAt: number;
  terminal: boolean;
  temperature?: number;
  provider: LLMProvider;
  titleGenerated: boolean;
  maxOutputTokens?: number;
  config: LLMProviderConfig;
  inputMessageIndex: number;
  accumulatedUsage?: LLMUsage;
  shouldGenerateTitle: boolean;
  conversation: LLMConversation;
  partialText: Map<number, string>;
  persistedTurnMessageCount: number;
  persistedConversation: LLMConversation;
  pendingToolCall?: {
    step: number;
    usage?: LLMUsage;
    message: LLMMessageToolCall;
    finishReason: LLMFinishReason;
  };
}

export type AIAgentRunningRunSnapshot = Omit<AIAgentRunState, "controller"> & {
  eventReplayTruncated?: boolean;
  eventReplay?: AIAgentEventReplayItem[];
};

export type AIAgentEvent =
  | {
      runID: string;
      title: string;
      type: "title";
      conversationID: string;
    }
  | {
      at: number;
      runID: string;
      type: "started";
      configID: string;
      conversationID: string;
    }
  | {
      runID: string;
      type: "aborted";
      conversationID: string;
      snapshot?: LLMConversationSnapshot;
    }
  | {
      step: number;
      text: string;
      runID: string;
      type: "text_delta";
      conversationID: string;
    }
  | {
      step: number;
      runID: string;
      type: "tool_result";
      conversationID: string;
      toolResults: AIAgentToolResult[];
    }
  | {
      runID: string;
      type: "error";
      error: AIAgentError;
      conversationID: string;
      snapshot?: LLMConversationSnapshot;
    }
  | {
      type: "done";
      runID: string;
      conversationID: string;
      response: AIAgentResponse;
      snapshot: LLMConversationSnapshot;
    }
  | {
      step: number;
      runID: string;
      text?: string;
      usage?: LLMUsage;
      type: "tool_call";
      conversationID: string;
      toolCalls: LLMToolCall[];
      finishReason?: LLMFinishReason;
    };

export interface AIAgentToolResult {
  name: string;
  callID: string;
  output: string;
}

export interface AIAgentResponse {
  text: string;
  usage?: LLMUsage;
  toolCalls: LLMToolCall[];
  finishReason: LLMFinishReason;
}

export interface AIAgentError {
  message: string;
  type: AIErrorCode;
}

export interface AIAgentEventReplayItem {
  sequence: number;
  event: AIAgentEvent;
}

export interface AIAgentEventReplaySnapshot {
  runID: string;
  terminal: boolean;
  truncated: boolean;
  conversationID: string;
  eventReplay: AIAgentEventReplayItem[];
}

export type AIAgentListener<TEvent extends AIAgentEvent = AIAgentEvent> = NormalFunc<
  [event: TEvent, sequence: number]
>;
