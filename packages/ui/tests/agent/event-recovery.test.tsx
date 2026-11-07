import { Provider, createStore } from "jotai";
import { act, waitFor, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import type { AGUIEvent, ThreadSummary, ThreadSnapshot } from "@mahiru/agent/browser";

const mocks = vi.hoisted(() => ({
  listRuns: vi.fn(),
  cancelRun: vi.fn(),
  getThread: vi.fn(),
  createThread: vi.fn(),
  deleteThread: vi.fn(),
  getStorageItem: vi.fn(),
  listenEvents: vi.fn(),
  listProviders: vi.fn(),
  listConfigs: vi.fn(),
  listThreads: vi.fn()
}));

vi.mock("@mahiru/ui/wins/agent/lib/agent", () => ({ RendererAgent: mocks }));
vi.mock("@mahiru/ui/common/lib/window", () => ({
  RendererWindow: {
    current: { addEventListener: () => vi.fn(), close: vi.fn(), hide: vi.fn() }
  }
}));
vi.mock("@mahiru/ui/common/components/display/toast", () => ({
  default: { show: vi.fn() }
}));
vi.mock("@mahiru/ui/common/lib/key-value", () => ({
  RendererKeyValue: class {
    getItem(_key: string, initialValue: unknown) {
      return mocks.getStorageItem(_key, initialValue);
    }
    setItem() {
      return Promise.resolve(true);
    }
    removeItem() {
      return Promise.resolve(true);
    }
  }
}));

import { useAgent } from "@mahiru/ui/wins/agent/hooks/useAgent";
import { RendererAgentChat } from "@mahiru/ui/wins/agent/lib/chat";
import {
  agentConversationStatesAtom,
  agentUpdateConversationStateAtom
} from "@mahiru/ui/wins/agent/atoms/agent";

const snapshot = (): ThreadSnapshot => ({
  id: "thread-1",
  name: "测试会话",
  createdAt: 1,
  updatedAt: 2,
  runtime: { status: "failed", runId: "run-1" },
  messages: [
    { role: "user", content: "分析歌曲" },
    { role: "inner", innerType: "error", content: "provider disconnected" }
  ]
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStorageItem.mockImplementation((_key, initialValue) => Promise.resolve(initialValue));
  mocks.listProviders.mockResolvedValue({ ok: true, data: [] });
  mocks.listConfigs.mockResolvedValue({ ok: true, data: [] });
  mocks.listThreads.mockResolvedValue({ ok: true, data: [] });
  mocks.listRuns.mockResolvedValue({ ok: true, data: [] });
  mocks.cancelRun.mockResolvedValue({ ok: true, data: undefined });
  mocks.getThread.mockResolvedValue({ ok: true, data: snapshot() });
  mocks.listenEvents.mockImplementation(() => vi.fn());
});

it("初始化等待选中会话的快照，列表刷新先完成时不显示已就绪", async () => {
  const selected = snapshot();
  const summaries = Promise.withResolvers<{ data: []; ok: true }>();
  const conversation = Promise.withResolvers<{ ok: true; data: ThreadSnapshot }>();
  mocks.getStorageItem.mockImplementation((key, initialValue) =>
    Promise.resolve(key === "agent.selectedConversationID" ? selected.id : initialValue)
  );
  mocks.listThreads.mockReturnValueOnce(summaries.promise);
  mocks.getThread.mockReturnValueOnce(conversation.promise);
  const store = createStore();
  const wrapper = ({ children }: PropsWithChildren) => (
    <Provider store={store}>{children}</Provider>
  );
  const hook = renderHook(() => useAgent(), { wrapper });
  try {
    await waitFor(() => expect(mocks.getThread).toHaveBeenCalledWith(selected.id));
    expect(hook.result.current.loading).toBe(true);
    await act(async () => summaries.resolve({ ok: true, data: [] }));
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.loaded).toBe(false);
    expect(hook.result.current.conversation).toBeNull();
    await act(async () => conversation.resolve({ ok: true, data: selected }));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    expect(hook.result.current.conversation?.id).toBe(selected.id);
    expect(JSON.stringify(RendererAgentChat.get(store, selected.id).chat.messages)).toContain(
      "分析歌曲"
    );
  } finally {
    await act(async () => {
      summaries.resolve({ ok: true, data: [] });
      conversation.resolve({ ok: true, data: selected });
    });
    hook.unmount();
  }
});

it("切换会话只采用最后一次点击，较早请求晚返回不抢回选中项", async () => {
  const store = createStore();
  const wrapper = ({ children }: PropsWithChildren) => (
    <Provider store={store}>{children}</Provider>
  );
  const hook = renderHook(() => useAgent(), { wrapper });
  const first = Promise.withResolvers<{ ok: true; data: ThreadSnapshot }>();
  const second = Promise.withResolvers<{ ok: true; data: ThreadSnapshot }>();
  try {
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    mocks.getThread.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    let openingFirst!: Promise<void>;
    let openingSecond!: Promise<void>;
    act(() => {
      openingFirst = hook.result.current.openConversation("first");
      openingSecond = hook.result.current.openConversation("second");
    });
    await act(async () => {
      second.resolve({ ok: true, data: { ...snapshot(), id: "second" } });
      await openingSecond;
    });
    expect(hook.result.current.selectedConversationID).toBe("second");
    await act(async () => {
      first.resolve({ ok: true, data: { ...snapshot(), id: "first" } });
      await openingFirst;
    });
    expect(hook.result.current.selectedConversationID).toBe("second");
    expect(hook.result.current.conversation?.id).toBe("second");
  } finally {
    await act(async () => {
      first.resolve({ ok: true, data: { ...snapshot(), id: "first" } });
      second.resolve({ ok: true, data: { ...snapshot(), id: "second" } });
    });
    hook.unmount();
  }
});

const mountRunningAgent = async () => {
  const store = createStore();
  const wrapper = ({ children }: PropsWithChildren) => (
    <Provider store={store}>{children}</Provider>
  );
  const hook = renderHook(() => useAgent(), { wrapper });
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  act(() => {
    store.set(agentUpdateConversationStateAtom, {
      conversationID: "thread-1",
      update: (state) => ({ ...state, latestRunID: "run-1", runningRunID: "run-1" })
    });
  });
  const [onEvent, options] = mocks.listenEvents.mock.calls[0] as [
    (event: AGUIEvent) => void,
    { onReconnect: (signal?: AbortSignal) => Promise<void> }
  ];
  return { ...hook, store, onEvent, onReconnect: options.onReconnect };
};

it("复用空会话时使较早的打开请求失效", async () => {
  const blank: ThreadSnapshot = {
    ...snapshot(),
    id: "blank",
    name: "",
    messages: [],
    runtime: { status: "idle" }
  };
  mocks.listThreads.mockResolvedValue({
    ok: true,
    data: [{ id: blank.id, name: blank.name, createdAt: 1, updatedAt: 2 }]
  });
  const { result, unmount } = await mountRunningAgent();
  const older = Promise.withResolvers<{ ok: true; data: ThreadSnapshot }>();
  try {
    mocks.getThread.mockImplementation((id) =>
      id === "older" ? older.promise : Promise.resolve({ ok: true, data: blank })
    );
    let opening!: Promise<void>;
    act(() => {
      opening = result.current.openConversation("older");
    });
    await act(async () => result.current.createConversation());
    expect(result.current.selectedConversationID).toBe("blank");
    await act(async () => {
      older.resolve({ ok: true, data: { ...snapshot(), id: "older" } });
      await opening;
    });
    expect(result.current.selectedConversationID).toBe("blank");
    expect(mocks.createThread).not.toHaveBeenCalled();
  } finally {
    await act(async () => older.resolve({ ok: true, data: { ...snapshot(), id: "older" } }));
    unmount();
  }
});

it("创建请求较晚完成时保留期间新选择的会话", async () => {
  const { result, unmount } = await mountRunningAgent();
  const created = Promise.withResolvers<{ ok: true; data: ThreadSummary }>();
  mocks.createThread.mockReturnValueOnce(created.promise);
  try {
    let creating!: Promise<void>;
    act(() => {
      creating = result.current.createConversation();
    });
    await waitFor(() => expect(mocks.createThread).toHaveBeenCalledOnce());
    mocks.getThread.mockImplementation((id) =>
      Promise.resolve({ ok: true, data: { ...snapshot(), id } })
    );
    await act(async () => result.current.openConversation("newer"));
    await act(async () => {
      created.resolve({ ok: true, data: { id: "created", name: "", createdAt: 1, updatedAt: 2 } });
      await creating;
    });
    expect(result.current.selectedConversationID).toBe("newer");
  } finally {
    await act(async () =>
      created.resolve({
        ok: true,
        data: { id: "created", name: "", createdAt: 1, updatedAt: 2 }
      })
    );
    unmount();
  }
});

it("删除当前会话使旧打开请求失效，也保留删除期间的新选择", async () => {
  const { result, unmount } = await mountRunningAgent();
  const older = Promise.withResolvers<{ ok: true; data: ThreadSnapshot }>();
  const deleted = Promise.withResolvers<{ ok: true; data: undefined }>();
  try {
    await act(async () => result.current.openConversation("thread-1"));
    mocks.getThread.mockReturnValueOnce(older.promise);
    mocks.deleteThread.mockReturnValueOnce(deleted.promise);
    let opening!: Promise<void>;
    let removing!: Promise<void>;
    act(() => {
      opening = result.current.openConversation("older");
      removing = result.current.removeConversation("thread-1");
    });
    await act(async () => {
      older.resolve({ ok: true, data: { ...snapshot(), id: "older" } });
      await opening;
    });
    expect(result.current.selectedConversationID).toBe("thread-1");
    mocks.getThread.mockResolvedValue({ ok: true, data: { ...snapshot(), id: "newer" } });
    await act(async () => result.current.openConversation("newer"));
    await act(async () => {
      deleted.resolve({ ok: true, data: undefined });
      await removing;
    });
    expect(result.current.selectedConversationID).toBe("newer");
  } finally {
    await act(async () => {
      older.resolve({ ok: true, data: { ...snapshot(), id: "older" } });
      deleted.resolve({ ok: true, data: undefined });
    });
    unmount();
  }
});

it("删除非当前会话不使有效的打开请求失效", async () => {
  const { result, unmount } = await mountRunningAgent();
  const opening = Promise.withResolvers<{ ok: true; data: ThreadSnapshot }>();
  try {
    await act(async () => result.current.openConversation("thread-1"));
    mocks.getThread.mockReturnValueOnce(opening.promise);
    mocks.deleteThread.mockResolvedValueOnce({ ok: true, data: undefined });
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.openConversation("newer");
    });
    await act(async () => result.current.removeConversation("unselected"));
    await act(async () => {
      opening.resolve({ ok: true, data: { ...snapshot(), id: "newer" } });
      await pending;
    });
    expect(result.current.selectedConversationID).toBe("newer");
  } finally {
    await act(async () => opening.resolve({ ok: true, data: { ...snapshot(), id: "newer" } }));
    unmount();
  }
});

it("已加载对话刷新列表时保留就绪状态和历史消息", async () => {
  const { store, result, unmount } = await mountRunningAgent();
  const refreshed = Promise.withResolvers<{ data: []; ok: true }>();
  try {
    await act(async () => result.current.openConversation("thread-1"));
    const conversation = result.current.conversation;
    const messages = RendererAgentChat.get(store, "thread-1").chat.messages;
    mocks.listThreads.mockReturnValueOnce(refreshed.promise);
    act(() => result.current.refreshConversations());
    expect(result.current.loading).toBe(true);
    expect(result.current.loaded).toBe(true);
    expect(result.current.conversation).toBe(conversation);
    expect(RendererAgentChat.get(store, "thread-1").chat.messages).toBe(messages);
    await act(async () => refreshed.resolve({ ok: true, data: [] }));
    expect(result.current.loading).toBe(false);
    expect(result.current.loaded).toBe(true);
    expect(result.current.selectedConversationID).toBe("thread-1");
  } finally {
    await act(async () => refreshed.resolve({ ok: true, data: [] }));
    unmount();
  }
});

it("后台标题事件只更新元信息，不打断下一轮 SDK 消息", async () => {
  const { onEvent, store, unmount } = await mountRunningAgent();
  const entry = RendererAgentChat.get(store, "thread-1");
  const conversation = snapshot();
  act(() => {
    store.set(agentUpdateConversationStateAtom, {
      conversationID: "thread-1",
      update: (state) => ({ ...state, conversation })
    });
    entry.chat.messages = [
      {
        id: "next-answer",
        role: "assistant",
        parts: [{ type: "text", text: "下一轮正在输出" }]
      }
    ];
  });
  const version = entry.version;
  const messages = entry.chat.messages;
  try {
    await act(async () => {
      onEvent({
        type: "CUSTOM",
        threadId: "thread-1",
        runId: "previous-run",
        name: "thread-metadata",
        value: {
          name: "概括后的标题",
          createdAt: 1,
          updatedAt: 10,
          auxiliaryUsage: {
            title: { requests: 1, reportedRequests: 1, promptTokens: 100, completionTokens: 10 },
            compaction: { requests: 0, reportedRequests: 0, promptTokens: 0, completionTokens: 0 }
          }
        }
      });
    });
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.conversation?.name).toBe(
      "概括后的标题"
    );
    expect(
      store.get(agentConversationStatesAtom)["thread-1"]?.conversation?.auxiliaryUsage?.title
    ).toEqual({
      requests: 1,
      reportedRequests: 1,
      promptTokens: 100,
      completionTokens: 10
    });
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.runningRunID).toBe("run-1");
    expect(entry.chat.messages).toBe(messages);
    expect(entry.version).toBe(version);
    await act(async () => {
      onEvent({
        type: "CUSTOM",
        threadId: "thread-1",
        runId: "previous-run",
        name: "thread-metadata",
        value: { name: "迟到的旧标题", createdAt: 1, updatedAt: 3 }
      });
    });
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.conversation?.name).toBe(
      "概括后的标题"
    );
  } finally {
    await act(async () => unmount());
  }
});

it("重连后恢复丢失的 InnerError，不把失败静默收成空闲", async () => {
  const { onReconnect, store, unmount } = await mountRunningAgent();
  try {
    await act(async () => onReconnect());
    const state = store.get(agentConversationStatesAtom)["thread-1"];
    expect(state?.runningRunID).toBe("");
    expect(
      RendererAgentChat.get(store, "thread-1").chat.lastMessage?.metadata?.terminal
    ).toMatchObject({
      status: "failed",
      error: "provider disconnected"
    });
    expect(mocks.listenEvents).toHaveBeenCalledOnce();
  } finally {
    unmount();
  }
});

it("恢复请求期间的新流事件不会被迟到的旧快照清除", async () => {
  const { onEvent, onReconnect, store, unmount } = await mountRunningAgent();
  let resolveSnapshot!: (value: { ok: true; data: ThreadSnapshot }) => void;
  mocks.getThread.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveSnapshot = resolve;
    })
  );
  try {
    let recovery!: Promise<void>;
    act(() => {
      recovery = onReconnect();
    });
    await waitFor(() => expect(mocks.getThread).toHaveBeenCalledOnce());
    act(() => {
      onEvent({
        type: "TEXT_MESSAGE_CONTENT",
        threadId: "thread-1",
        runId: "run-1",
        messageId: "message-1",
        delta: "重连后的新内容"
      });
    });
    await act(async () => {
      resolveSnapshot({ ok: true, data: snapshot() });
      await recovery;
    });
    const state = store.get(agentConversationStatesAtom)["thread-1"];
    await waitFor(() =>
      expect(RendererAgentChat.get(store, "thread-1").chat.lastMessage?.parts).toEqual([
        expect.objectContaining({ type: "text", text: "重连后的新内容" })
      ])
    );
    expect(state?.runningRunID).toBe("run-1");
    expect(state?.conversation).toBeNull();
    expect(mocks.listenEvents).toHaveBeenCalledOnce();
  } finally {
    unmount();
  }
});

it("事件订阅取消后不应用在途恢复快照", async () => {
  const { onReconnect, store, unmount } = await mountRunningAgent();
  const controller = new AbortController();
  let resolveSnapshot!: (value: { ok: true; data: ThreadSnapshot }) => void;
  mocks.getThread.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveSnapshot = resolve;
    })
  );
  try {
    let recovery!: Promise<void>;
    act(() => {
      recovery = onReconnect(controller.signal);
    });
    await waitFor(() => expect(mocks.getThread).toHaveBeenCalledOnce());
    await act(async () => {
      controller.abort();
      resolveSnapshot({ ok: true, data: snapshot() });
      await recovery;
    });
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.runningRunID).toBe("run-1");
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.conversation).toBeNull();
  } finally {
    unmount();
  }
});

it("卸载事件订阅时停止 SDK 本地流，旧回调失效且不取消 Rust run", async () => {
  const { onEvent, store, unmount } = await mountRunningAgent();
  const entry = RendererAgentChat.get(store, "thread-1");
  act(() => {
    onEvent({
      type: "TEXT_MESSAGE_CONTENT",
      threadId: "thread-1",
      runId: "run-1",
      messageId: "m-1",
      delta: "卸载前输出"
    });
  });
  await waitFor(() => expect(entry.chat.status).toBe("streaming"));
  const unsubscribe = mocks.listenEvents.mock.results[0]?.value;
  await act(async () => unmount());
  await waitFor(() => expect(entry.chat.status).toBe("ready"));
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(mocks.cancelRun).not.toHaveBeenCalled();
  expect(store.get(agentConversationStatesAtom)["thread-1"]?.runningRunID).toBe("run-1");
  const version = entry.version;
  onEvent({
    type: "TEXT_MESSAGE_CONTENT",
    threadId: "thread-1",
    runId: "run-1",
    messageId: "m-1",
    delta: "已卸载回调不应接收"
  });
  expect(entry.version).toBe(version);
  expect(JSON.stringify(entry.chat.messages)).not.toContain("已卸载回调不应接收");
});

it("StrictMode 清理和完整重挂载后复用 SDK 实例继续恢复会话", async () => {
  const store = createStore();
  const entry = RendererAgentChat.get(store, "thread-1");
  const running: ThreadSnapshot = {
    ...snapshot(),
    runtime: { status: "running", runId: "run-1" },
    messages: [
      { role: "user", content: "分析歌曲" },
      { role: "assistant", content: "已持久化前缀" }
    ]
  };
  mocks.listRuns.mockResolvedValue({
    ok: true,
    data: [{ threadId: "thread-1", runId: "run-1" }]
  });
  mocks.getThread.mockResolvedValue({ ok: true, data: running });
  await entry.restore(running);
  await waitFor(() => expect(entry.chat.status).toBe("streaming"));
  const wrapper = ({ children }: PropsWithChildren) => (
    <Provider store={store}>{children}</Provider>
  );
  const first = renderHook(() => useAgent(), { wrapper, reactStrictMode: true });
  try {
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    expect(mocks.listenEvents).toHaveBeenCalledTimes(2);
    const onEvent = mocks.listenEvents.mock.calls.at(-1)?.[0] as (event: AGUIEvent) => void;
    act(() => {
      onEvent({
        type: "TEXT_MESSAGE_CONTENT",
        threadId: "thread-1",
        runId: "run-1",
        messageId: "strict-message",
        delta: "StrictMode 后续输出"
      });
    });
    await waitFor(() =>
      expect(JSON.stringify(entry.chat.messages)).toContain("StrictMode 后续输出")
    );
    expect(RendererAgentChat.get(store, "thread-1")).toBe(entry);
  } finally {
    await act(async () => first.unmount());
  }
  await waitFor(() => expect(entry.chat.status).toBe("ready"));

  const second = renderHook(() => useAgent(), { wrapper, reactStrictMode: true });
  try {
    await waitFor(() => expect(second.result.current.loaded).toBe(true));
    const onEvent = mocks.listenEvents.mock.calls.at(-1)?.[0] as (event: AGUIEvent) => void;
    act(() => {
      onEvent({
        type: "TEXT_MESSAGE_CONTENT",
        threadId: "thread-1",
        runId: "run-1",
        messageId: "remount-message",
        delta: "重挂载后续输出"
      });
    });
    await waitFor(() => expect(JSON.stringify(entry.chat.messages)).toContain("重挂载后续输出"));
    expect(RendererAgentChat.get(store, "thread-1")).toBe(entry);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
  } finally {
    await act(async () => second.unmount());
  }
});
