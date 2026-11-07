import { createStore } from "jotai";
import { it, vi, expect, describe, afterEach, beforeEach } from "vitest";
import type { AGUIEvent, ThreadSnapshot } from "@mahiru/agent/browser";

const mocks = vi.hoisted(() => ({
  createRun: vi.fn(),
  cancelRun: vi.fn(),
  getThread: vi.fn()
}));

vi.mock("@mahiru/ui/wins/agent/lib/agent", () => ({
  RendererAgent: mocks
}));
vi.mock("@mahiru/ui/common/lib/key-value", () => ({
  RendererKeyValue: class {
    setItem() {
      return Promise.resolve(true);
    }
    removeItem() {
      return Promise.resolve(true);
    }
  }
}));

import { RendererAgentChat } from "@mahiru/ui/wins/agent/lib/chat";
import {
  agentConversationStatesAtom,
  createAgentConversationState,
  agentRemoveConversationStateAtom
} from "@mahiru/ui/wins/agent/atoms/agent";

const usageRecords = {
  requests: 1,
  last_step: 1,
  records: [{ step: 1, usage: { prompt_tokens: 100, completion_tokens: 20 } }]
};
const expectedUsage = {
  input: 100,
  output: 20,
  total: 120,
  requests: 1,
  lastInput: 100,
  coverage: "complete",
  lastInputStatus: "reported",
  reportedRequests: 1,
  cachedInput: undefined,
  cacheWrite: undefined,
  reasoning: undefined
};
const entries: RendererAgentChat[] = [];

const event = (type: AGUIEvent["type"], fields: Record<string, unknown> = {}) =>
  ({ type, threadId: "thread-1", runId: "run-1", ...fields }) as AGUIEvent;

const snapshot = (
  messages: ThreadSnapshot["messages"] = [],
  runtime: ThreadSnapshot["runtime"] = { status: "idle" },
  id = "thread-1"
): ThreadSnapshot => ({ id, name: "测试会话", createdAt: 1, updatedAt: 2, messages, runtime });

const createEntry = (conversationID = "thread-1", store = createStore()) => {
  const entry = RendererAgentChat.get(store, conversationID);
  entries.push(entry);
  return { entry, store };
};

const start = async (entry: RendererAgentChat) => {
  expect(await entry.submit("分析歌曲", "config-1")).toBe(true);
  await entry.push(event("RUN_STARTED"));
};

beforeEach(() => {
  mocks.createRun.mockReset().mockImplementation(async ({ threadId }: { threadId: string }) => ({
    ok: true,
    data: { threadId, runId: threadId.replace("thread", "run") }
  }));
  mocks.cancelRun.mockReset().mockResolvedValue({ ok: true, data: undefined });
  mocks.getThread.mockReset().mockResolvedValue({ ok: true, data: snapshot() });
});

afterEach(async () => {
  await Promise.all(entries.splice(0).map((entry) => entry.chat.dispose()));
});

describe("Agent SDK 消息状态", () => {
  it("由 SDK 将独立思考增量累计到同一 part，并在结束事件后标记 done", async () => {
    const { entry } = createEntry();
    await start(entry);
    await entry.push(event("REASONING_MESSAGE_START", { messageId: "reasoning-1" }));
    await entry.push(
      event("REASONING_MESSAGE_CONTENT", { messageId: "reasoning-1", delta: "先分析" })
    );
    await entry.push(
      event("REASONING_MESSAGE_CONTENT", { messageId: "reasoning-1", delta: "当前歌曲" })
    );
    await vi.waitFor(() =>
      expect(entry.chat.lastMessage).toMatchObject({
        metadata: { runID: "run-1" },
        parts: [{ type: "reasoning", text: "先分析当前歌曲", state: "streaming" }]
      })
    );

    await entry.push(event("REASONING_MESSAGE_END", { messageId: "reasoning-1" }));
    await vi.waitFor(() =>
      expect(entry.chat.lastMessage?.parts).toEqual([
        expect.objectContaining({ type: "reasoning", text: "先分析当前歌曲", state: "done" })
      ])
    );
  });

  it("同步失败快照时保留 RUN_ERROR 的错误和 usage", async () => {
    const { entry, store } = createEntry();
    await start(entry);
    mocks.getThread.mockResolvedValue({
      ok: true,
      data: snapshot([], { status: "failed", runId: "run-1" })
    });
    expect(
      await entry.push(
        event("RUN_ERROR", { message: "provider disconnected", usages: usageRecords })
      )
    ).toBe(true);

    expect(store.get(agentConversationStatesAtom)["thread-1"]?.conversation?.runtime.status).toBe(
      "failed"
    );
    expect(entry.chat.lastMessage?.metadata?.terminal).toMatchObject({
      type: "terminal",
      status: "failed",
      runID: "run-1",
      error: "provider disconnected",
      usage: expectedUsage
    });
  });

  it("快照请求失败时仍保留 SDK 消息中的错误 usage，并标记待恢复", async () => {
    const { entry, store } = createEntry();
    await start(entry);
    mocks.getThread.mockResolvedValue({
      ok: false,
      reason: { code: "network", message: "暂时无法同步" }
    });
    await entry.push(
      event("RUN_ERROR", { message: "provider disconnected", usages: usageRecords })
    );

    expect(entry.chat.lastMessage?.metadata?.terminal).toMatchObject({
      status: "failed",
      error: "provider disconnected",
      usage: expectedUsage
    });
    expect(store.get(agentConversationStatesAtom)["thread-1"]).toMatchObject({
      recovering: true,
      runningRunID: ""
    });
  });

  it("轮询恢复 InnerError 失败快照时保留错误和持久化 usage", async () => {
    const { entry, store } = createEntry();
    store.set(agentConversationStatesAtom, {
      "thread-1": {
        ...createAgentConversationState(),
        latestRunID: "run-1",
        runningRunID: "run-1",
        recovering: true
      }
    });
    await entry.restore(
      snapshot(
        [
          { role: "user", content: "分析歌曲" },
          { role: "inner", innerType: "error", content: "provider disconnected" },
          { role: "inner", innerType: "usage", content: JSON.stringify(usageRecords) }
        ],
        { status: "failed", runId: "run-1" }
      )
    );

    expect(store.get(agentConversationStatesAtom)["thread-1"]).toMatchObject({
      runningRunID: "",
      recovering: false
    });
    expect(entry.chat.lastMessage?.metadata?.terminal).toMatchObject({
      type: "terminal",
      status: "failed",
      runID: "run-1",
      error: "provider disconnected",
      usage: expectedUsage
    });
  });

  it.each([
    ["部分回复", "《雪之舞》的旋律", "模型回复未完整结束"],
    ["空正文", "", "模型未返回正文或有效工具调用"]
  ])(
    "%s 失败时连续终态保留正文、原因和用量，冷恢复后仍只有一个失败回复",
    async (_, text, error) => {
      const { entry, store } = createEntry();
      await start(entry);
      if (text) {
        await entry.push(
          event("TEXT_MESSAGE_CONTENT", { messageId: "partial-reply", delta: text })
        );
      }
      const failed = snapshot(
        [
          { role: "user", content: "分析歌曲" },
          { role: "assistant", content: text },
          { role: "inner", innerType: "error", content: error },
          { role: "inner", innerType: "usage", content: JSON.stringify(usageRecords) }
        ],
        { status: "failed" }
      );
      const stored = Promise.withResolvers<{ ok: true; data: ThreadSnapshot }>();
      mocks.getThread.mockReturnValueOnce(stored.promise);

      const errorEvent = entry.push(event("RUN_ERROR", { message: error, usages: null }));
      const finishing = entry.push(event("RUN_FINISHED", { result: error, usages: usageRecords }));
      expect(await errorEvent).toBe(false);
      await vi.waitFor(() =>
        expect(entry.chat.lastMessage?.metadata?.terminal).toMatchObject({
          status: "failed",
          error,
          usage: expectedUsage
        })
      );
      expect(entry.chat.lastMessage?.parts.filter((part) => part.type === "text")).toEqual(
        text ? [expect.objectContaining({ text, state: "done" })] : []
      );
      expect(entry.chat.messages.filter((message) => message.metadata?.terminal)).toHaveLength(1);

      stored.resolve({ ok: true, data: failed });
      expect(await finishing).toBe(true);
      expect(store.get(agentConversationStatesAtom)["thread-1"]).toMatchObject({
        runningRunID: "",
        recovering: false
      });
      expect(entry.chat.lastMessage?.metadata?.terminal).toMatchObject({
        status: "failed",
        error,
        usage: expectedUsage
      });
      expect(entry.chat.lastMessage?.parts.filter((part) => part.type === "text")).toEqual(
        text ? [{ type: "text", text, state: "done" }] : []
      );
      expect(entry.chat.messages.filter((message) => message.metadata?.terminal)).toHaveLength(1);

      const { entry: restored } = createEntry();
      await restored.restore(failed);
      expect(restored.chat.lastMessage?.parts.filter((part) => part.type === "text")).toEqual(
        text ? [{ type: "text", text, state: "done" }] : []
      );
      expect(restored.chat.lastMessage?.metadata?.terminal).toMatchObject({
        status: "failed",
        error,
        usage: expectedUsage
      });
      expect(restored.chat.messages.filter((message) => message.role === "assistant")).toHaveLength(
        1
      );
      expect(restored.chat.messages.filter((message) => message.metadata?.terminal)).toHaveLength(
        1
      );
    }
  );

  it("服务端还未接受 run 时恢复快照不清除发送态和乐观用户消息", async () => {
    const accepted = Promise.withResolvers<{
      ok: true;
      data: { runId: string; threadId: string };
    }>();
    mocks.createRun.mockReturnValue(accepted.promise);
    const { entry, store } = createEntry();
    const submission = entry.submit("新请求", "config-1");
    await vi.waitFor(() => expect(mocks.createRun).toHaveBeenCalledOnce());
    const previousState = store.get(agentConversationStatesAtom)["thread-1"];
    await entry.restore(snapshot());

    expect(store.get(agentConversationStatesAtom)["thread-1"]).toBe(previousState);
    expect(previousState).toMatchObject({ sending: true, pendingUserMessage: "新请求" });
    expect(entry.chat.messages).toEqual([
      expect.objectContaining({ role: "user", parts: [{ type: "text", text: "新请求" }] })
    ]);
    accepted.resolve({ ok: true, data: { runId: "run-1", threadId: "thread-1" } });
    expect(await submission).toBe(true);
  });

  it("同一步的两个工具结果分别保存在 SDK parts 中", async () => {
    const { entry } = createEntry();
    await start(entry);
    await entry.push(event("STEP_STARTED", { stepName: "turn1-step2" }));
    for (const [id, name, args] of [
      ["call-1", "agent-search", '{"query":"Aira"}'],
      ["call-2", "agent-track", '{"id":42}']
    ]) {
      await entry.push(event("TOOL_CALL_START", { toolCallId: id, toolCallName: name }));
      await entry.push(event("TOOL_CALL_ARGS", { toolCallId: id, delta: args }));
      await entry.push(event("TOOL_CALL_END", { toolCallId: id }));
    }
    await entry.push(event("TOOL_CALL_RESULT", { toolCallId: "call-1", content: "search result" }));
    await entry.push(event("TOOL_CALL_RESULT", { toolCallId: "call-2", content: "track result" }));

    await vi.waitFor(() =>
      expect(entry.chat.lastMessage?.parts.filter((part) => part.type === "dynamic-tool")).toEqual([
        expect.objectContaining({
          toolCallId: "call-1",
          toolName: "agent-search",
          state: "output-available",
          output: "search result"
        }),
        expect.objectContaining({
          toolCallId: "call-2",
          toolName: "agent-track",
          state: "output-available",
          output: "track result"
        })
      ])
    );
  });
});

describe("Agent SDK 运行竞态", () => {
  it.each([false, true])(
    "新建实例按 run 身份恢复当前用户问题，不按同文去重，快照已覆盖=%s",
    async (covered) => {
      const store = createStore();
      const history: ThreadSnapshot["messages"] = [
        { role: "user", content: "继续" },
        { role: "assistant", content: "第一答" },
        { role: "user", content: "继续" },
        { role: "assistant", content: "第二答" }
      ];
      store.set(agentConversationStatesAtom, {
        "thread-1": {
          ...createAgentConversationState(),
          conversation: snapshot(
            covered ? [...history, { role: "user", content: "继续" }] : history,
            covered ? { status: "running", runId: "run-1" } : { status: "idle" }
          ),
          latestRunID: "run-1",
          runningRunID: "run-1",
          pendingUserMessage: "继续"
        }
      });
      const { entry } = createEntry("thread-1", store);
      const readTexts = () =>
        entry.chat.messages.map((message) =>
          message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("")
        );
      const publications = [readTexts()];
      const unsubscribe = entry.chat["~registerMessagesCallback"](() => {
        publications.push(readTexts());
      });
      try {
        await entry.push(event("RUN_STARTED"));
        await entry.push(
          event("TEXT_MESSAGE_CONTENT", { messageId: "third-reply", delta: "第三答" })
        );
        await vi.waitFor(() => expect(readTexts().at(-1)).toBe("第三答"));
        const expectedPrefix = ["继续", "第一答", "继续", "第二答", "继续"];
        expect(readTexts()).toEqual([...expectedPrefix, "第三答"]);
        expect(entry.chat.messages.filter((message) => message.role === "user")).toHaveLength(3);
        for (const texts of publications) expect(texts.slice(0, 5)).toEqual(expectedPrefix);
      } finally {
        unsubscribe();
      }
    }
  );

  it("从已有多轮快照新建实例后，流式工具和正文始终保留全部历史", async () => {
    const store = createStore();
    const history: ThreadSnapshot["messages"] = [
      { role: "user", content: "第一问" },
      { role: "assistant", content: "第一答" },
      { role: "user", content: "第二问" },
      { role: "assistant", content: "第二答" }
    ];
    const current = snapshot(
      [
        ...history,
        { role: "user", content: "第三问" },
        {
          role: "assistant",
          content: "先搜索歌曲。",
          toolCalls: [{ id: "call-current", name: "search", args: { query: "雪之舞" } }]
        }
      ],
      { status: "running", runId: "run-1" }
    );
    store.set(agentConversationStatesAtom, {
      "thread-1": {
        ...createAgentConversationState(),
        conversation: current,
        latestRunID: "run-1",
        runningRunID: "run-1"
      }
    });
    const { entry } = createEntry("thread-1", store);
    const readTexts = () =>
      entry.chat.messages.map((message) =>
        message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("")
      );
    const publications = [readTexts()];
    const unsubscribe = entry.chat["~registerMessagesCallback"](() => {
      publications.push(readTexts());
    });

    try {
      await entry.push(event("RUN_STARTED"));
      await entry.push(
        event("TOOL_CALL_RESULT", { toolCallId: "call-current", content: "找到《雪之舞》" })
      );
      await entry.push(event("STEP_STARTED", { stepName: "turn3-step2" }));
      await entry.push(
        event("TEXT_MESSAGE_CONTENT", {
          messageId: "current-reply",
          delta: "这是《雪之舞》的介绍。"
        })
      );
      await vi.waitFor(() => expect(readTexts().at(-1)).toContain("这是《雪之舞》的介绍。"));

      const expectedPrefix = ["第一问", "第一答", "第二问", "第二答", "第三问"];
      expect(readTexts()).toEqual([...expectedPrefix, "先搜索歌曲。这是《雪之舞》的介绍。"]);
      expect(entry.chat.lastMessage?.parts).toContainEqual(
        expect.objectContaining({
          type: "dynamic-tool",
          toolCallId: "call-current",
          state: "output-available",
          output: "找到《雪之舞》"
        })
      );
      expect(
        publications.every((texts) => texts.slice(0, 5).join("|") === expectedPrefix.join("|"))
      ).toBe(true);

      mocks.getThread.mockResolvedValue({
        ok: true,
        data: snapshot([
          ...current.messages,
          { role: "tool", toolCallId: "call-current", content: "找到《雪之舞》" },
          { role: "assistant", content: "这是《雪之舞》的介绍。" }
        ])
      });
      await entry.push(event("RUN_FINISHED", { result: "success", usages: usageRecords }));
      expect(readTexts()).toEqual([...expectedPrefix, "先搜索歌曲。这是《雪之舞》的介绍。"]);
      expect(entry.chat.messages).toHaveLength(6);
    } finally {
      unsubscribe();
    }
  });

  it("多轮历史在新提交、热重连和断流续接的每次 SDK 发布中都完整保留", async () => {
    const { entry, store } = createEntry();
    const history: ThreadSnapshot["messages"] = [
      { role: "user", content: "第一问" },
      { role: "assistant", content: "第一答" },
      { role: "user", content: "第二问" },
      { role: "assistant", content: "第二答" }
    ];
    await entry.restore(snapshot(history));
    const readTexts = () =>
      entry.chat.messages.map((message) =>
        message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("")
      );
    const publications: string[][] = [];
    const unsubscribe = entry.chat["~registerMessagesCallback"](() => {
      publications.push(readTexts());
    });

    try {
      expect(await entry.submit("第三问", "config-1")).toBe(true);
      await entry.push(event("STEP_STARTED", { stepName: "turn3-step1" }));
      await entry.push(
        event("TEXT_MESSAGE_CONTENT", { messageId: "search-prefix", delta: "先搜索歌曲。" })
      );
      await entry.push(
        event("TOOL_CALL_START", { toolCallId: "call-current", toolCallName: "search" })
      );
      await entry.push(
        event("TOOL_CALL_ARGS", { toolCallId: "call-current", delta: '{"query":"雪之舞"}' })
      );
      await entry.push(event("TOOL_CALL_END", { toolCallId: "call-current" }));
      const expectedPrefix = ["第一问", "第一答", "第二问", "第二答", "第三问"];
      await vi.waitFor(() => expect(readTexts()).toEqual([...expectedPrefix, "先搜索歌曲。"]));

      const current = snapshot(
        [
          ...history,
          { role: "user", content: "第三问" },
          {
            role: "assistant",
            content: "先搜索歌曲。",
            toolCalls: [{ id: "call-current", name: "search", args: { query: "雪之舞" } }]
          }
        ],
        { status: "running", runId: "run-1" }
      );
      await entry.restore(current, () => true, true);
      await entry.push(
        event("TOOL_CALL_RESULT", { toolCallId: "call-current", content: "找到《雪之舞》" })
      );
      await vi.waitFor(() =>
        expect(entry.chat.lastMessage?.parts).toContainEqual(
          expect.objectContaining({ toolCallId: "call-current", state: "output-available" })
        )
      );
      RendererAgentChat.disconnect(store);
      await entry.push(event("STEP_STARTED", { stepName: "turn3-step2" }));
      await entry.push(
        event("TEXT_MESSAGE_CONTENT", { messageId: "current-reply", delta: "这是歌曲介绍。" })
      );
      await vi.waitFor(() =>
        expect(readTexts()).toEqual([...expectedPrefix, "先搜索歌曲。这是歌曲介绍。"])
      );
      expect(publications.length).toBeGreaterThan(5);
      for (const texts of publications) expect(texts.slice(0, 5)).toEqual(expectedPrefix);
      expect(entry.chat.messages).toHaveLength(6);
      expect(mocks.createRun).toHaveBeenCalledOnce();
    } finally {
      unsubscribe();
    }
  });

  it("迟到终态和恢复快照保留新标题，并使用快照自己的更新时间", async () => {
    const { entry, store } = createEntry();
    await start(entry);
    store.set(agentConversationStatesAtom, {
      ...store.get(agentConversationStatesAtom),
      "thread-1": {
        ...store.get(agentConversationStatesAtom)["thread-1"]!,
        metadataUpdatedAt: 10,
        conversation: {
          ...snapshot(),
          name: "新标题",
          createdAt: 3,
          updatedAt: 10,
          auxiliaryUsage: {
            title: { requests: 1, reportedRequests: 1, promptTokens: 100, completionTokens: 10 },
            compaction: { requests: 0, reportedRequests: 0, promptTokens: 0, completionTokens: 0 }
          }
        }
      }
    });
    await entry.push(event("RUN_FINISHED", { result: "success", usages: { records: [] } }));
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.conversation).toMatchObject({
      name: "新标题",
      createdAt: 3,
      updatedAt: 2
    });
    expect(
      store.get(agentConversationStatesAtom)["thread-1"]?.conversation?.auxiliaryUsage?.title
        .requests
    ).toBe(1);
    await entry.restore({ ...snapshot(), name: "第二个旧标题", updatedAt: 5 });
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.conversation).toMatchObject({
      name: "新标题",
      createdAt: 3,
      updatedAt: 5
    });
    await entry.restore({ ...snapshot(), name: "服务端新标题", updatedAt: 11 });
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.conversation?.name).toBe(
      "服务端新标题"
    );
    await entry.restore({ ...snapshot(), name: "更新前的旧标题", updatedAt: 9 });
    await entry.restore({ ...snapshot(), name: "再次迟到的旧标题", updatedAt: 10 });
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.conversation).toMatchObject({
      name: "服务端新标题",
      updatedAt: 10
    });
  });

  it("run 响应前排队的开始、内容和完成事件归属已接受的运行", async () => {
    const accepted = Promise.withResolvers<{
      ok: true;
      data: { runId: string; threadId: string };
    }>();
    const stored = Promise.withResolvers<{ ok: true; data: ThreadSnapshot }>();
    mocks.createRun.mockReturnValue(accepted.promise);
    mocks.getThread.mockReturnValue(stored.promise);
    const { entry, store } = createEntry();
    const submission = entry.submit("分析歌曲", "config-1");
    await vi.waitFor(() => expect(mocks.createRun).toHaveBeenCalledOnce());
    await entry.push(event("RUN_STARTED"));
    await entry.push(event("TEXT_MESSAGE_CONTENT", { messageId: "m-1", delta: "快速回复" }));
    await entry.push(event("RUN_FINISHED", { result: "success", usages: { records: [] } }));
    expect(mocks.getThread).not.toHaveBeenCalled();

    accepted.resolve({ ok: true, data: { runId: "run-1", threadId: "thread-1" } });
    expect(await submission).toBe(true);
    await vi.waitFor(() =>
      expect(entry.chat.lastMessage).toMatchObject({
        metadata: { runID: "run-1" },
        parts: [{ type: "text", text: "快速回复", state: "done" }]
      })
    );
    stored.resolve({
      ok: true,
      data: snapshot([
        { role: "user", content: "分析歌曲" },
        { role: "assistant", content: "快速回复" }
      ])
    });
    await vi.waitFor(() =>
      expect(store.get(agentConversationStatesAtom)["thread-1"]?.runningRunID).toBe("")
    );
    expect(entry.chat.messages.filter((message) => message.role === "user")).toHaveLength(1);
  });

  it("旧 run 和重复终态不干扰正在等待快照的终态提交", async () => {
    const stored = Promise.withResolvers<{ ok: true; data: ThreadSnapshot }>();
    const { entry, store } = createEntry();
    await start(entry);
    mocks.getThread.mockReturnValue(stored.promise);
    const finishing = entry.push(
      event("RUN_FINISHED", { result: "success", usages: usageRecords })
    );
    await vi.waitFor(() => expect(mocks.getThread).toHaveBeenCalledOnce());
    const version = entry.version;
    await entry.push(
      event("TEXT_MESSAGE_CONTENT", {
        runId: "old-run",
        messageId: "old-message",
        delta: "旧内容"
      })
    );
    expect(
      await entry.push(event("RUN_FINISHED", { result: "success", usages: usageRecords }))
    ).toBe(false);
    expect(mocks.getThread).toHaveBeenCalledOnce();
    await vi.waitFor(() =>
      expect(entry.chat.lastMessage?.metadata?.turns).toEqual([
        expect.objectContaining({ usage: expectedUsage })
      ])
    );
    const afterLateEvent = entry.version;
    stored.resolve({ ok: true, data: snapshot() });
    expect(await finishing).toBe(true);
    expect(afterLateEvent).toBe(version);
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.runningRunID).toBe("");
    expect(JSON.stringify(entry.chat.messages)).not.toContain("旧内容");
  });

  it("冷恢复重放已落盘步骤后接收工具结果与新步骤，终态按权威快照替换", async () => {
    const { entry, store } = createEntry();
    const firstStepMessages: ThreadSnapshot["messages"] = [
      { role: "user", content: "推荐一首歌" },
      {
        role: "assistant",
        content: "先搜索歌曲。",
        toolCalls: [{ id: "call-1", name: "search", args: { query: "周杰伦" } }]
      }
    ];
    await entry.restore(snapshot(firstStepMessages, { status: "running", runId: "run-1" }));
    await vi.waitFor(() =>
      expect(entry.chat.lastMessage).toMatchObject({
        metadata: { runID: "run-1" },
        parts: [
          { type: "step-start" },
          { type: "text", text: "先搜索歌曲。", state: "done" },
          {
            type: "dynamic-tool",
            toolName: "search",
            toolCallId: "call-1",
            state: "input-available",
            input: { query: "周杰伦" }
          }
        ]
      })
    );

    await entry.push(event("TOOL_CALL_RESULT", { toolCallId: "call-1", content: "晴天" }));
    await entry.push(event("STEP_STARTED", { stepName: "turn1-step2" }));
    await entry.push(event("TEXT_MESSAGE_CONTENT", { messageId: "m-2", delta: "找到了晴天" }));
    await entry.push(event("TEXT_MESSAGE_CONTENT", { messageId: "m-2", delta: "，已加入队列。" }));
    await vi.waitFor(() =>
      expect(entry.chat.lastMessage?.parts).toMatchObject([
        { type: "step-start" },
        { type: "text", text: "先搜索歌曲。", state: "done" },
        {
          type: "dynamic-tool",
          toolName: "search",
          toolCallId: "call-1",
          state: "output-available",
          input: { query: "周杰伦" },
          output: "晴天"
        },
        { type: "step-start" },
        { type: "text", text: "找到了晴天，已加入队列。", state: "streaming" }
      ])
    );
    expect(entry.chat.messages.filter((message) => message.role === "assistant")).toHaveLength(1);

    const authoritative = snapshot(
      [
        ...firstStepMessages,
        { role: "tool", toolCallId: "call-1", content: "晴天" },
        { role: "assistant", content: "服务端确认：晴天已入队。" }
      ],
      { status: "idle", runId: "run-1" }
    );
    mocks.getThread.mockResolvedValue({ ok: true, data: authoritative });
    expect(
      await entry.push(event("RUN_FINISHED", { result: "success", usages: usageRecords }))
    ).toBe(true);
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.conversation).toBe(authoritative);
    expect(entry.chat.messages.filter((message) => message.role === "assistant")).toHaveLength(1);
    expect(entry.chat.lastMessage?.parts).toMatchObject([
      { type: "step-start" },
      { type: "text", text: "先搜索歌曲。", state: "done" },
      {
        type: "dynamic-tool",
        toolCallId: "call-1",
        state: "output-available",
        input: { query: "周杰伦" },
        output: "晴天"
      },
      { type: "step-start" },
      { type: "text", text: "服务端确认：晴天已入队。", state: "done" }
    ]);
  });

  it("冷首帧只有 RUN_ERROR 时维持一个 assistant，并等待后续终态用量", async () => {
    const { entry } = createEntry();
    const stored = Promise.withResolvers<{ ok: true; data: ThreadSnapshot }>();
    mocks.getThread.mockReturnValue(stored.promise);
    expect(
      await entry.push(event("RUN_ERROR", { message: "provider disconnected", usages: null }))
    ).toBe(false);
    await vi.waitFor(() =>
      expect(entry.chat.lastMessage?.metadata?.terminal).toMatchObject({
        status: "failed",
        error: "provider disconnected"
      })
    );
    expect(entry.chat.messages.filter((message) => message.role === "assistant")).toHaveLength(1);
    const finishing = entry.push(event("RUN_FINISHED", { result: "error", usages: usageRecords }));
    await vi.waitFor(() =>
      expect(entry.chat.lastMessage?.metadata?.terminal?.usage).toEqual(expectedUsage)
    );
    expect(entry.chat.messages.filter((message) => message.role === "assistant")).toHaveLength(1);
    stored.resolve({
      ok: true,
      data: snapshot([{ role: "inner", innerType: "error", content: "provider disconnected" }], {
        status: "failed",
        runId: "run-1"
      })
    });
    expect(await finishing).toBe(true);
    expect(entry.chat.messages.filter((message) => message.role === "assistant")).toHaveLength(1);
    expect(entry.chat.lastMessage?.metadata?.terminal).toMatchObject({
      error: "provider disconnected",
      usage: expectedUsage
    });
  });

  it("同一窗口的后台会话持有独立 SDK 实例和消息流", async () => {
    const { store, entry: first } = createEntry();
    const { entry: second } = createEntry("thread-2", store);
    expect(RendererAgentChat.get(store, "thread-1")).toBe(first);
    expect(second.chat).not.toBe(first.chat);
    await Promise.all([
      first.submit("第一会话", "config-1"),
      second.submit("第二会话", "config-1")
    ]);
    await first.push(event("TEXT_MESSAGE_CONTENT", { messageId: "m-1", delta: "回复 A" }));
    const secondEvent = event("TEXT_MESSAGE_CONTENT", {
      threadId: "thread-2",
      runId: "run-2",
      messageId: "m-2",
      delta: "回复 B"
    });
    expect(await first.push(secondEvent)).toBe(false);
    await second.push(secondEvent);
    await vi.waitFor(() => {
      expect(first.chat.lastMessage?.parts).toMatchObject([{ type: "text", text: "回复 A" }]);
      expect(second.chat.lastMessage?.parts).toMatchObject([{ type: "text", text: "回复 B" }]);
    });
  });

  it("请求被拒绝后回滚乐观 user，保留此前的消息和运行态", async () => {
    const { entry, store } = createEntry();
    await entry.restore(
      snapshot([
        { role: "user", content: "已有问题" },
        { role: "assistant", content: "已有回复" }
      ])
    );
    const previousMessages = entry.chat.messages;
    mocks.createRun.mockResolvedValue({
      ok: false,
      reason: { code: "run_rejected", message: "配置不可用" }
    });
    expect(await entry.submit("被拒绝的请求", "config-1")).toBe(false);
    expect(entry.chat.messages).toEqual(previousMessages);
    expect(store.get(agentConversationStatesAtom)["thread-1"]).toMatchObject({
      sending: false,
      runningRunID: "",
      pendingUserMessage: ""
    });
  });

  it("慢快照到达前的新事件使恢复失效，保留当前 SDK 消息", async () => {
    const { entry } = createEntry();
    await start(entry);
    const version = entry.version;
    const stored = Promise.withResolvers<ThreadSnapshot>();
    const restoring = stored.promise.then((value) =>
      entry.restore(value, () => entry.version === version)
    );
    await entry.push(event("TEXT_MESSAGE_CONTENT", { messageId: "m-1", delta: "新回复" }));
    stored.resolve(snapshot([{ role: "assistant", content: "过时快照" }]));
    await restoring;
    await vi.waitFor(() =>
      expect(entry.chat.lastMessage?.parts).toMatchObject([{ type: "text", text: "新回复" }])
    );
    expect(JSON.stringify(entry.chat.messages)).not.toContain("过时快照");
  });

  it("SDK 本地停止和实例释放只断开消费，显式 cancel 才请求 Rust 取消", async () => {
    const { entry, store } = createEntry();
    await start(entry);
    await entry.chat.stop();
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.runningRunID).toBe("run-1");
    await entry.chat.dispose();
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    await entry.cancel();
    expect(mocks.cancelRun).toHaveBeenCalledExactlyOnceWith("run-1");
  });

  it("取消请求和实际已取消终态保留正文、思考及工具，冷恢复仍为停止状态", async () => {
    const { entry } = createEntry();
    await start(entry);
    await entry.push(
      event("TOOL_CALL_START", { toolCallId: "call-before-cancel", toolCallName: "search" })
    );
    await entry.push(event("TOOL_CALL_ARGS", { toolCallId: "call-before-cancel", delta: "{}" }));
    await entry.push(event("TOOL_CALL_END", { toolCallId: "call-before-cancel" }));
    await entry.push(
      event("TOOL_CALL_RESULT", { toolCallId: "call-before-cancel", content: "已找到歌曲" })
    );
    await entry.push(
      event("REASONING_MESSAGE_CONTENT", {
        messageId: "partial-reasoning",
        delta: "已有部分思考。"
      })
    );
    await entry.push(
      event("TEXT_MESSAGE_CONTENT", { messageId: "partial-text", delta: "已有部分介绍。" })
    );
    await vi.waitFor(() =>
      expect(entry.chat.lastMessage?.parts).toContainEqual(
        expect.objectContaining({ type: "text", text: "已有部分介绍。" })
      )
    );
    const beforeCancel = entry.chat.messages;
    await entry.cancel();
    expect(mocks.cancelRun).toHaveBeenCalledExactlyOnceWith("run-1");
    expect(entry.chat.messages).toEqual(beforeCancel);

    const cancelled = snapshot([
      { role: "user", content: "分析歌曲" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "call-before-cancel", name: "search", args: {} }]
      },
      { role: "tool", toolCallId: "call-before-cancel", content: "已找到歌曲" },
      { role: "assistant", content: "已有部分介绍。", reasoningContent: "已有部分思考。" },
      { role: "system", content: "[cancel]: 已取消" },
      { role: "inner", innerType: "usage", content: JSON.stringify(usageRecords) }
    ]);
    mocks.getThread.mockResolvedValue({ ok: true, data: cancelled });
    await entry.push(event("RUN_FINISHED", { result: "已取消", usages: usageRecords }));
    const { entry: restored } = createEntry();
    await restored.restore(cancelled);

    for (const current of [entry, restored]) {
      expect(current.chat.lastMessage?.metadata?.terminal).toMatchObject({
        status: "aborted",
        usage: expectedUsage
      });
      expect(current.chat.lastMessage?.metadata?.terminal?.error).toBeUndefined();
      expect(current.chat.lastMessage?.parts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "text", text: "已有部分介绍。", state: "done" }),
          expect.objectContaining({ type: "reasoning", text: "已有部分思考。", state: "done" }),
          expect.objectContaining({
            type: "dynamic-tool",
            toolCallId: "call-before-cancel",
            state: "output-available",
            output: "已找到歌曲"
          })
        ])
      );
      expect(JSON.stringify(current.chat.messages)).not.toContain("[cancel]: 已取消");
      expect(current.chat.messages.filter((message) => message.metadata?.terminal)).toHaveLength(1);
    }
  });

  it("完成 run 再恢复 idle 快照后，迟到内容不能重新启动生成", async () => {
    const { entry, store } = createEntry();
    await start(entry);
    await entry.push(event("RUN_FINISHED", { result: "success", usages: { records: [] } }));
    await entry.restore(snapshot());
    const version = entry.version;
    expect(
      await entry.push(event("TEXT_MESSAGE_CONTENT", { messageId: "late", delta: "迟到正文" }))
    ).toBe(false);
    expect(entry.version).toBe(version);
    expect(store.get(agentConversationStatesAtom)["thread-1"]).toMatchObject({
      runningRunID: "",
      recovering: false
    });
    expect(entry.chat.status).toBe("ready");
    expect(entry.chat.messages).toEqual([]);
  });

  it("普通打开保留实时前缀，热重连则用同 run 的权威前缀与工具重建流", async () => {
    const { entry } = createEntry();
    await start(entry);
    await entry.push(event("TEXT_MESSAGE_CONTENT", { messageId: "m-1", delta: "实时前缀" }));
    await vi.waitFor(() =>
      expect(entry.chat.lastMessage?.parts).toMatchObject([{ type: "text", text: "实时前缀" }])
    );
    const current = snapshot(
      [
        { role: "user", content: "分析歌曲" },
        {
          role: "assistant",
          content: "权威完整前缀",
          toolCalls: [{ id: "call-1", name: "search", args: { query: "周杰伦" } }]
        }
      ],
      { status: "running", runId: "run-1" }
    );
    await entry.restore(current);
    expect(entry.chat.lastMessage?.parts).toMatchObject([{ type: "text", text: "实时前缀" }]);

    await entry.restore(current, () => true, true);
    await entry.push(event("TOOL_CALL_RESULT", { toolCallId: "call-1", content: "晴天" }));
    await vi.waitFor(() =>
      expect(entry.chat.lastMessage?.parts).toMatchObject([
        { type: "step-start" },
        { type: "text", text: "权威完整前缀", state: "done" },
        {
          type: "dynamic-tool",
          toolCallId: "call-1",
          state: "output-available",
          input: { query: "周杰伦" },
          output: "晴天"
        }
      ])
    );
    expect(entry.chat.messages.filter((message) => message.role === "assistant")).toHaveLength(1);
  });

  it("移除会话后，在途 run 创建响应不能污染同 id 的新实例", async () => {
    const accepted = Promise.withResolvers<{
      ok: true;
      data: { runId: string; threadId: string };
    }>();
    mocks.createRun.mockReturnValueOnce(accepted.promise);
    const { entry, store } = createEntry();
    const submission = entry.submit("旧实例请求", "config-1");
    await vi.waitFor(() => expect(mocks.createRun).toHaveBeenCalledOnce());
    const version = entry.version;
    RendererAgentChat.remove(store, "thread-1");
    store.set(agentRemoveConversationStateAtom, "thread-1");
    expect(entry.version).toBeGreaterThan(version);
    const { entry: replacement } = createEntry("thread-1", store);
    expect(replacement).not.toBe(entry);
    mocks.createRun.mockResolvedValueOnce({
      ok: true,
      data: { runId: "new-run", threadId: "thread-1" }
    });
    expect(await replacement.submit("新实例请求", "config-1")).toBe(true);
    accepted.resolve({ ok: true, data: { runId: "run-1", threadId: "thread-1" } });
    expect(await submission).toBe(false);
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.runningRunID).toBe("new-run");
    expect(replacement.chat.messages.filter((message) => message.role === "user")).toMatchObject([
      { role: "user", parts: [{ type: "text", text: "新实例请求" }] }
    ]);
    expect(
      await entry.push(event("TEXT_MESSAGE_CONTENT", { messageId: "late", delta: "旧输出" }))
    ).toBe(false);
    expect(await entry.submit("移除后的请求", "config-1")).toBe(false);
  });

  it("移除会话后，在途终态快照不能覆盖新实例消息", async () => {
    const stored = Promise.withResolvers<{ ok: true; data: ThreadSnapshot }>();
    const { entry, store } = createEntry();
    await start(entry);
    mocks.getThread.mockReturnValueOnce(stored.promise);
    const finishing = entry.push(
      event("RUN_FINISHED", { result: "success", usages: { records: [] } })
    );
    await vi.waitFor(() => expect(mocks.getThread).toHaveBeenCalledOnce());
    RendererAgentChat.remove(store, "thread-1");
    store.set(agentRemoveConversationStateAtom, "thread-1");
    const { entry: replacement } = createEntry("thread-1", store);
    await replacement.restore(snapshot([{ role: "assistant", content: "新实例消息" }]));
    stored.resolve({ ok: true, data: snapshot([{ role: "assistant", content: "过时终态" }]) });
    expect(await finishing).toBe(false);
    expect(replacement.chat.lastMessage?.parts).toMatchObject([
      { type: "step-start" },
      { type: "text", text: "新实例消息" }
    ]);
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.conversation?.messages).toEqual([
      { role: "assistant", content: "新实例消息" }
    ]);
  });

  it.each([
    ["cancel", "aborted"],
    ["已取消", "aborted"],
    ["max-step", "max_steps"]
  ] as const)("%s 终态快照失败后保留状态和用量，下一用户轮次不继承", async (result, status) => {
    const { entry } = createEntry();
    await start(entry);
    mocks.getThread.mockResolvedValue({
      ok: false,
      reason: { code: "network", message: "暂时无法同步" }
    });
    await entry.push(event("RUN_FINISHED", { result, usages: usageRecords }));
    const completed: ThreadSnapshot["messages"] = [
      { role: "user", content: "分析歌曲" },
      { role: "assistant", content: "已生成部分回复" },
      { role: "system", content: result }
    ];
    await entry.restore(snapshot(completed));
    expect(entry.chat.lastMessage?.metadata?.terminal).toMatchObject({
      runID: "run-1",
      status,
      usage: expectedUsage
    });

    await entry.restore(
      snapshot([
        ...completed,
        { role: "user", content: "分析歌曲" },
        { role: "assistant", content: "同样问题的新回复" }
      ])
    );
    expect(entry.chat.lastMessage?.parts).toMatchObject([
      { type: "step-start" },
      { type: "text", text: "同样问题的新回复" }
    ]);
    expect(entry.chat.lastMessage?.metadata?.terminal).toBeUndefined();
  });
});
