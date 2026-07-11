import type { LLMConversation } from "@/conversations";
import type { LLMToolChoice, LLMToolRegistry } from "@/tools";
import type { LLMMessageText, LLMGenerateRequest } from "@/provider";
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
  userMessage: LLMMessageText;
  context?: LLMContextComposeResult;
}
