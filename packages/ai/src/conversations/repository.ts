import { AIResult } from "@/result";
import type { AIInject } from "@/inject";

import { LLMConversation } from "./conversation";
import type { LLMConversationCreateOptions } from "./interface";

export class LLMConversationRepository {
  private readonly inject: Pick<AIInject, "CreateID" | "ConversationStore">;

  constructor(inject: Pick<AIInject, "CreateID" | "ConversationStore">) {
    this.inject = inject;
  }

  private async wrap<T>(action: string, fn: PromiseFunc<[], AIResult<T>>): Promise<AIResult<T>> {
    try {
      return await fn();
    } catch (error) {
      return AIResult.err({
        type: "conversation_storage",
        message: `${action} 异常`,
        raw: error
      });
    }
  }

  async create(
    options: Partial<LLMConversationCreateOptions> = {}
  ): Promise<AIResult<LLMConversation>> {
    const id = options.id ?? this.inject.CreateID();
    const conversation = LLMConversation.create({ id, ...options });
    if (conversation.isErr()) return conversation;

    const saved = await this.save(conversation.unwrap());
    if (saved.isErr()) return saved;

    return conversation;
  }

  async load(id: string): Promise<AIResult<Optional<LLMConversation>>> {
    const snapshot = await this.wrap("read", () => this.inject.ConversationStore.read(id));
    if (snapshot.isErr()) return snapshot;
    if (!snapshot.unwrap()) return AIResult.ok(undefined);

    return LLMConversation.fromSnapshot(snapshot.unwrap()!);
  }

  async save(conversation: LLMConversation) {
    return this.wrap("write", () => this.inject.ConversationStore.write(conversation.snapshot()));
  }

  async remove(id: string) {
    return this.wrap("delete", () => this.inject.ConversationStore.remove(id));
  }
}
