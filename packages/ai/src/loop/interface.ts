import type { LLMToolResult } from "@/tools";
import type { LLMContextComposeResult } from "@/context";
import type { LLMProvider, LLMGenerateResponse } from "@/provider";
import type { LLMPromptBuilder, LLMPromptBuildOptions } from "@/prompt";

export interface LLMLoopOptions<TConfig> {
  config: TConfig;
  maxSteps: number;
  prompt: LLMPromptBuilder;
  provider: LLMProvider<TConfig>;
}

export type LLMLoopRunOptions = LLMPromptBuildOptions;

export interface LLMLoopRunResult {
  steps: LLMLoopStep[];
  response: LLMGenerateResponse;
  context?: LLMContextComposeResult;
}

export interface LLMLoopStep {
  toolResults: LLMToolResult[];
  response: LLMGenerateResponse;
}
