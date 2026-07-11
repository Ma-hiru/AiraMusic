import OpenAI from "openai";
import type { LLMProviderConfig } from "@/provider/interface";

export type LLMProviderOpenAIAPIMode = "responses" | "chat_completions";

export type LLMProviderOpenAIGenerateResponse<T extends LLMProviderOpenAIAPIMode> =
  T extends "responses" ? OpenAI.Responses.Response : OpenAI.Chat.Completions.ChatCompletion;

export type LLMProviderOpenAIStreamResponse<T extends LLMProviderOpenAIAPIMode> =
  T extends "responses" ? OpenAI.Responses.Response : OpenAI.Chat.Completions.ChatCompletionChunk;

export interface LLMProviderOpenAIConfig extends LLMProviderConfig {
  apiMode: LLMProviderOpenAIAPIMode;
}
