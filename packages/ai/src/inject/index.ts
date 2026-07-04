import type { Log } from "@mahiru/log";
import type { AIResult } from "@/result";
import type { LLMCheckResponse } from "@/provider";
import type { LLMConversationSnapshot } from "@/conversations";
import type { LLMProviderConfigPublic } from "@/provider/interface";

export interface AIProviderConfigSnapshot {
  id: string;
  name: string;
  provider: string;
  createdAt: number;
  updatedAt: number;
  check: LLMCheckResponse;
  config: LLMProviderConfigPublic;
}

export interface AIProviderConfigStore {
  remove(id: string): Promise<AIResult<void>>;
  list(): Promise<AIResult<AIProviderConfigSnapshot[]>>;
  write(snapshot: AIProviderConfigSnapshot): Promise<AIResult<void>>;
  read(id: string): Promise<AIResult<Optional<AIProviderConfigSnapshot>>>;
}

export interface AIProviderAPIKeyStore {
  remove(configID: string): Promise<AIResult<void>>;
  read(configID: string): Promise<AIResult<Optional<string>>>;
  write(configID: string, apiKey: string): Promise<AIResult<void>>;
}

export interface AIConversationStore {
  remove(id: string): Promise<AIResult<void>>;
  write(snapshot: LLMConversationSnapshot): Promise<AIResult<void>>;
  read(id: string): Promise<AIResult<Optional<LLMConversationSnapshot>>>;
  list(): Promise<AIResult<Pick<AIProviderConfigSnapshot, "id" | "name">[]>>;
}

export interface AIInject {
  Log: Log;
  CreateID: NormalFunc<[], string>;
  ConversationStore: AIConversationStore;
  ProviderAPIKeyStore: AIProviderAPIKeyStore;
  ProviderConfigStore: AIProviderConfigStore;
}
