import { AIResult } from "@/result";
import { digestHistoryPrefix } from "@/history";
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

  it("只回退最近一次已中止运行，并同步清理该轮消息、元数据和失效摘要", () => {
    const previousMessages = [
      { role: "user" as const, content: "上一轮问题" },
      { role: "assistant" as const, content: "上一轮回答" }
    ];
    const messages = [
      ...previousMessages,
      { role: "user" as const, content: "原始问题" },
      {
        role: "assistant" as const,
        content: "先搜索资料",
        toolCalls: [toolCall]
      },
      {
        role: "tool" as const,
        name: toolCall.name,
        callID: toolCall.callID,
        content: "搜索结果"
      },
      { role: "assistant" as const, content: "半截回复" }
    ];
    const conversation = LLMConversation.fromSnapshot({
      id: "conversation-retry",
      name: "重试对话",
      createdAt: 1,
      updatedAt: 2,
      metadata: {},
      messages,
      runtime: {
        runID: "run-aborted",
        titleGenerated: true,
        status: "aborted",
        startedAt: 10,
        endedAt: 20,
        terminal: true,
        incomplete: true,
        inputMessageIndex: 2,
        error: { type: "aborted", message: "用户停止生成" }
      },
      assistantTurns: [
        {
          runID: "run-previous",
          step: 0,
          status: "complete",
          messageIndex: 1,
          finishReason: "stop"
        },
        {
          runID: "run-aborted",
          step: 0,
          status: "complete",
          messageIndex: 3,
          finishReason: "tool_calls"
        },
        {
          runID: "run-aborted",
          step: 1,
          status: "incomplete",
          messageIndex: 5
        }
      ],
      compaction: {
        version: 1,
        summary: "错误地覆盖到了本轮消息",
        updatedAt: 2,
        coveredMessageCount: 5,
        coveredDigest: digestHistoryPrefix(messages.slice(0, 5))
      }
    }).unwrap();
    const before = conversation.snapshot();

    const stale = conversation.rewindAbortedRun("run-other");
    expect(stale.isErr()).toBe(true);
    expect(conversation.snapshot()).toEqual(before);

    const rewound = conversation.rewindAbortedRun(
      "run-aborted",
      (toolName) => toolName === "search_music"
    );
    expect(rewound.isOk()).toBe(true);
    expect(conversation.snapshot()).toMatchObject({
      messages: previousMessages,
      assistantTurns: [
        {
          runID: "run-previous",
          step: 0,
          status: "complete",
          messageIndex: 1,
          finishReason: "stop"
        }
      ]
    });
    expect(conversation.getRuntime()).toBeUndefined();
    expect(conversation.getCompaction()).toBeUndefined();
    expect(conversation.name).toBe("");
  });

  it("发现不可安全重试的工具后拒绝回退，且不修改任何快照字段", () => {
    const conversation = LLMConversation.fromSnapshot({
      id: "conversation-unsafe-retry",
      name: "保留标题",
      createdAt: 1,
      updatedAt: 2,
      metadata: {},
      messages: [
        { role: "user", content: "发送评论" },
        {
          role: "assistant",
          content: "正在发送",
          toolCalls: [{ ...toolCall, name: "comment_send" }]
        },
        {
          role: "tool",
          name: "comment_send",
          callID: toolCall.callID,
          content: "发送成功"
        }
      ],
      runtime: {
        runID: "run-unsafe",
        status: "aborted",
        startedAt: 10,
        endedAt: 20,
        terminal: true,
        incomplete: true,
        inputMessageIndex: 0,
        error: { type: "aborted", message: "用户停止生成" }
      },
      assistantTurns: [
        {
          runID: "run-unsafe",
          step: 0,
          status: "complete",
          messageIndex: 1,
          finishReason: "tool_calls"
        }
      ]
    }).unwrap();
    const before = conversation.snapshot();

    const rewound = conversation.rewindAbortedRun("run-unsafe", () => false);

    expect(rewound.isErr()).toBe(true);
    if (rewound.isErr()) expect(rewound.reason.message).toContain("comment_send");
    expect(conversation.snapshot()).toEqual(before);
  });

  it("拒绝回退未中止的运行", () => {
    const conversation = LLMConversation.fromSnapshot({
      id: "conversation-completed",
      name: "已完成对话",
      createdAt: 1,
      updatedAt: 2,
      metadata: {},
      messages: [
        { role: "user", content: "问题" },
        { role: "assistant", content: "完整回答" }
      ],
      runtime: {
        runID: "run-completed",
        status: "completed",
        startedAt: 10,
        endedAt: 20,
        terminal: true,
        incomplete: false,
        inputMessageIndex: 0
      },
      assistantTurns: [
        {
          runID: "run-completed",
          step: 0,
          status: "complete",
          messageIndex: 1,
          finishReason: "stop"
        }
      ]
    }).unwrap();
    const before = conversation.snapshot();

    expect(conversation.rewindAbortedRun("run-completed").isErr()).toBe(true);
    expect(conversation.snapshot()).toEqual(before);
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
