import type { LLMMessage } from "@/provider";

export interface LLMConversationSnapshot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messages: LLMMessage[];
  metadata: Record<string, unknown>;
}

export interface LLMConversationCreateOptions {
  id: string;
  name?: string;
  messages?: LLMMessage[];
  metadata?: Record<string, unknown>;
}
