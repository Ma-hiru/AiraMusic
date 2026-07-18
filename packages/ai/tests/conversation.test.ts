import { AIResult } from "@/result";
import {
  LLMConversation,
  LLMConversationRepository,
  type LLMConversationSnapshot
} from "@/conversations";
import type { AIConversationStore } from "@/inject";

const toolCall = {
  name: "search_music",
  callID: "call_1",
  arguments: JSON.stringify({ keyword: "Aira" })
};

class MemoryConversationStore implements AIConversationStore {
  private readonly snapshots = new Map<string, LLMConversationSnapshot>();

  async list(): Promise<AIResult<{ id: string; name: string }[]>> {
    return AIResult.ok(
      Array.from(this.snapshots.values(), (snapshot) => ({ id: snapshot.id, name: snapshot.name }))
    );
  }

  async read(id: string): Promise<AIResult<Optional<LLMConversationSnapshot>>> {
    const snapshot = this.snapshots.get(id);
    return AIResult.ok(snapshot ? cloneSnapshot(snapshot) : undefined);
  }

  async write(snapshot: LLMConversationSnapshot): Promise<AIResult<void>> {
    this.snapshots.set(snapshot.id, cloneSnapshot(snapshot));
    return AIResult.ok(undefined);
  }

  async remove(id: string): Promise<AIResult<void>> {
    this.snapshots.delete(id);
    return AIResult.ok(undefined);
  }
}

describe("LLMConversation", () => {
  it("blocks normal messages until pending tool calls receive results", () => {
    const conversation = LLMConversation.create({ id: "conversation-1" }).unwrap();

    expect(conversation.appendMessage({ role: "user", content: "找一首歌" }).isOk()).toBe(true);
    expect(conversation.appendMessage({ role: "assistant", toolCalls: [toolCall] }).isOk()).toBe(
      true
    );
    expect(conversation.pendingToolCalls()).toHaveLength(1);

    const blocked = conversation.appendMessage({ role: "user", content: "继续" });
    expect(blocked.isErr()).toBe(true);

    expect(
      conversation
        .appendMessage({ role: "tool", name: "search_music", callID: "call_1", content: "[]" })
        .isOk()
    ).toBe(true);
    expect(conversation.pendingToolCalls()).toHaveLength(0);
    expect(conversation.appendMessage({ role: "user", content: "继续" }).isOk()).toBe(true);
  });

  it("rejects repeated tool call ids across the conversation", () => {
    const conversation = LLMConversation.create({ id: "conversation-2" }).unwrap();

    expect(conversation.appendMessage({ role: "assistant", toolCalls: [toolCall] }).isOk()).toBe(
      true
    );
    expect(
      conversation
        .appendMessage({ role: "tool", name: "search_music", callID: "call_1", content: "[]" })
        .isOk()
    ).toBe(true);

    const repeated = conversation.appendMessage({ role: "assistant", toolCalls: [toolCall] });
    expect(repeated.isErr()).toBe(true);
  });

  it("advances updatedAt and round-trips runtime and assistant turn metadata", () => {
    const conversation = LLMConversation.create({ id: "conversation-observability" }).unwrap();
    const initialUpdatedAt = conversation.updatedAt;

    expect(conversation.appendMessage({ role: "user", content: "hello" }).isOk()).toBe(true);
    const afterUser = conversation.updatedAt;
    expect(afterUser).toBeGreaterThan(initialUpdatedAt);

    expect(conversation.appendMessage({ role: "assistant", content: "world" }).isOk()).toBe(true);
    expect(
      conversation
        .recordAssistantTurn({
          runID: "run-1",
          step: 0,
          status: "complete",
          messageIndex: 1,
          finishReason: "stop",
          usage: {
            input: 10,
            output: 2,
            total: 12,
            cachedInput: 3,
            cacheWrite: 4,
            reasoning: 1
          }
        })
        .isOk()
    ).toBe(true);
    const afterTurn = conversation.updatedAt;
    expect(afterTurn).toBeGreaterThan(afterUser);

    expect(
      conversation
        .setRuntime({
          runID: "run-1",
          status: "completed",
          startedAt: 100,
          endedAt: 200,
          terminal: true,
          incomplete: false
        })
        .isOk()
    ).toBe(true);
    expect(conversation.updatedAt).toBeGreaterThan(afterTurn);

    const snapshot = conversation.snapshot();
    const restored = LLMConversation.fromSnapshot(snapshot);
    expect(restored.isOk()).toBe(true);
    expect(restored.unwrap().snapshot()).toEqual(snapshot);
  });
});

describe("LLMConversationRepository", () => {
  it("persists and loads conversations through injected storage", async () => {
    const store = new MemoryConversationStore();
    const repository = new LLMConversationRepository({
      ConversationStore: store,
      CreateID: () => "generated-conversation"
    });

    const created = await repository.create({ metadata: { source: "test" } });
    expect(created.isOk()).toBe(true);

    const conversation = created.unwrap();
    expect(conversation.appendMessage({ role: "user", content: "hello" }).isOk()).toBe(true);
    expect((await repository.save(conversation)).isOk()).toBe(true);

    const loaded = await repository.load("generated-conversation");
    expect(loaded.isOk()).toBe(true);

    const loadedConversation = loaded.unwrap();
    expect(loadedConversation?.snapshot()).toEqual(conversation.snapshot());
  });
});

function cloneSnapshot(snapshot: LLMConversationSnapshot): LLMConversationSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as LLMConversationSnapshot;
}
