import type { AIResult } from "@/result";
import type { LLMConversationSnapshot } from "@/conversation/types";

export interface AIConversationStore {
  remove(id: string): Promise<AIResult<void>>;
  list(): Promise<AIResult<{ id: string; name: string }[]>>;
  write(snapshot: LLMConversationSnapshot): Promise<AIResult<void>>;
  read(id: string): Promise<AIResult<Optional<LLMConversationSnapshot>>>;
}

export interface AIInject {
  Log: NormalFunc<any[]>;
  CreateID: NormalFunc<[], string>;
  ConversationStore: AIConversationStore;
}
