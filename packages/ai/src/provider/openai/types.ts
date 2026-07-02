import OpenAI from "openai";

export type LLMProviderOpenAIAPIMode = "responses" | "chat_completions";

export type LLMProviderOpenAIGenerateResponse<T extends LLMProviderOpenAIAPIMode> =
  T extends "responses" ? OpenAI.Responses.Response : OpenAI.Chat.Completions.ChatCompletion;

export type LLMProviderOpenAIStreamResponse<T extends LLMProviderOpenAIAPIMode> =
  T extends "responses" ? OpenAI.Responses.Response : OpenAI.Chat.Completions.ChatCompletionChunk;

export type LLMProviderOpenAIConfig = {
  model: string;
  apiKey: string;
  baseURL?: string;
  timeoutMs?: number;
  apiMode: LLMProviderOpenAIAPIMode;
};
