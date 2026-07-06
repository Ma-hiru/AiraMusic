import { AIError, type AIErrorCode } from "@/result";
import { LLMConversation, type LLMConversationSnapshot } from "@/conversations";
import { type LLMUsage, type LLMProvider, type LLMFinishReason } from "@/provider";
import type { AIInject } from "@/inject";
import type { LLMProviderConfig } from "@/provider/interface";
import type { LLMTool, LLMToolCall, LLMToolChoice } from "@/tools";
import type { LLMContextSource, LLMContextMessageRole } from "@/context";

export interface AIAgentOptions {
  inject: AIInject;
  maxSteps: number;
  titlePrompt: string;
  systemPrompt: string;
  titleMaxOutputTokens: number;
  providers: Iterable<LLMProvider<any, any, any>>;
  context?: {
    maxChars: number;
    sources: LLMContextSource[];
    defaultRole: LLMContextMessageRole;
  };
  tools?: {
    list: LLMTool[];
    strict: boolean;
    choice: LLMToolChoice;
    serializeOutput?: NormalFunc<[output: unknown], string>;
  };
}

export interface AIAgentCreateConfigOptions<TConfig extends LLMProviderConfig = LLMProviderConfig> {
  id?: string;
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
}

export interface AIAgentRunState {
  runID: string;
  configID: string;
  conversationID: string;
  controller: AbortController;
}

export interface AIAgentRunContext extends AIAgentRunState {
  input: string;
  temperature?: number;
  provider: LLMProvider;
  maxOutputTokens?: number;
  config: LLMProviderConfig;
  conversation: LLMConversation;
}

export type AIAgentRunningRunSnapshot = Omit<AIAgentRunState, "controller">;

export type AIAgentEvent =
  | {
      runID: string;
      type: "aborted";
      conversationID: string;
    }
  | {
      runID: string;
      title: string;
      type: "title";
      conversationID: string;
    }
  | {
      runID: string;
      type: "error";
      error: AIError;
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
      type: "tool_call";
      conversationID: string;
      toolCalls: LLMToolCall[];
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

export type AIAgentListener<TEvent extends AIAgentEvent = AIAgentEvent> = NormalFunc<
  [event: TEvent]
>;
