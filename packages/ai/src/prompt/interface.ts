import type { LLMToolRegistry } from "@/tools";
import type { LLMConversation } from "@/conversation";
import type { LLMToolChoice, LLMGenerateRequest } from "@/provider";
import type {
  LLMContextComposer,
  LLMContextComposeResult,
  LLMContextComposeOptions
} from "@/context";

export type LLMPromptContextOptions = {
  composer: LLMContextComposer;
} & Omit<LLMContextComposeOptions, "signal">;

export interface LLMPromptToolOptions {
  strict: boolean;
  choice: LLMToolChoice;
  registry: LLMToolRegistry;
}

export interface LLMPromptBuildOptions {
  input: string;
  signal: AbortSignal;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: LLMPromptToolOptions;
  conversation: LLMConversation;
  context?: LLMPromptContextOptions;
}

export interface LLMPromptBuildResult {
  request: LLMGenerateRequest;
  context?: LLMContextComposeResult;
}
