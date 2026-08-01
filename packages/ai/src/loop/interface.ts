import type { AIResult } from "@/result";
import type { LLMContextComposeResult } from "@/context";
import type { LLMToolCall, LLMToolResult } from "@/tools";
import type { AIAgentEvidenceRequirement } from "@/skills";
import type { LLMProviderConfig } from "@/provider/interface";
import type { LLMPromptBuilder, LLMPromptBuildOptions } from "@/prompt";
import type {
  LLMUsage,
  LLMMessage,
  LLMProvider,
  LLMFinishReason,
  LLMMessageToolCall,
  LLMGenerateResponse
} from "@/provider";

export type LLMLoopRunOptions<TConfig extends LLMProviderConfig = LLMProviderConfig> =
  LLMPromptBuildOptions & {
    config: TConfig;
    maxSteps: number;
    provider: LLMProvider<TConfig>;
    promptBuilder: LLMPromptBuilder;
    onUsage?: NormalFunc<[usage: Undefinable<LLMUsage>]>;
    requiredEvidence?: readonly AIAgentEvidenceRequirement[];
    /**
     * 连续调用工具但未推进必要证据时，允许的停滞步数上限（默认 3，最大 12）。
     * 联网取证类流程搜索质量波动大，可由 skill 经 core 传入更大的预算。
     */
    maxNoEvidenceProgressSteps?: number;
    transformFinalText?: NormalFunc<
      [context: { text: string; messages: readonly LLMMessage[] }],
      string
    >;
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
      type: "done";
      messages: LLMMessage[];
      response: LLMLoopEventResponse;
      context?: LLMContextComposeResult;
    }
  | {
      step: number;
      text?: string;
      usage?: LLMUsage;
      type: "tool_call";
      toolCalls: LLMToolCall[];
      message: LLMMessageToolCall;
      finishReason: LLMFinishReason;
    };

export type LLMLoopEventResponse = Pick<
  LLMGenerateResponse,
  "text" | "usage" | "toolCalls" | "finishReason"
>;
