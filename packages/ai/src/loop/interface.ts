import type { AIResult } from "@/result";
import type { LLMContextComposeResult } from "@/context";
import type { LLMToolCall, LLMToolResult } from "@/tools";
import type { LLMProviderConfig } from "@/provider/interface";
import type { LLMPromptBuilder, LLMPromptBuildOptions } from "@/prompt";
import type { LLMMessage, LLMProvider, LLMMessageToolCall, LLMGenerateResponse } from "@/provider";

export type LLMLoopRunOptions<TConfig extends LLMProviderConfig = LLMProviderConfig> =
  LLMPromptBuildOptions & {
    config: TConfig;
    maxSteps: number;
    provider: LLMProvider<TConfig>;
    promptBuilder: LLMPromptBuilder;
  };

export type LLMLoopRunStream = AsyncGenerator<AIResult<LLMLoopEvent>, AIResult<LLMLoopRunResult>>;

export interface LLMLoopRunResult {
  steps: LLMLoopStep[];
  messages: LLMMessage[];
  response: LLMGenerateResponse;
  context?: LLMContextComposeResult;
}

export interface LLMLoopStep {
  toolResults: LLMToolResult[];
  response: LLMGenerateResponse;
}

export type LLMLoopEvent =
  | {
      step: number;
      text: string;
      type: "text_delta";
    }
  | {
      step: number;
      type: "tool_result";
      messages: LLMMessage[];
      toolResults: LLMToolResult[];
    }
  | {
      step: number;
      text?: string;
      type: "tool_call";
      toolCalls: LLMToolCall[];
      message: LLMMessageToolCall;
    }
  | {
      step: number;
      type: "done";
      messages: LLMMessage[];
      response: LLMLoopEventResponse;
      context?: LLMContextComposeResult;
    };

export type LLMLoopEventResponse = Pick<
  LLMGenerateResponse,
  "text" | "usage" | "toolCalls" | "finishReason"
>;
