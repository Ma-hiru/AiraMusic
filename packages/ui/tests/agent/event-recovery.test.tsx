import { Provider, createStore } from "jotai";
import { act, waitFor, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import type { AGUIEvent, ThreadSnapshot } from "@mahiru/agent/browser";

const mocks = vi.hoisted(() => ({
  listRuns: vi.fn(),
  getThread: vi.fn(),
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
      return Promise.resolve(initialValue);
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
  mocks.listProviders.mockResolvedValue({ ok: true, data: [] });
  mocks.listConfigs.mockResolvedValue({ ok: true, data: [] });
  mocks.listThreads.mockResolvedValue({ ok: true, data: [] });
  mocks.listRuns.mockResolvedValue({ ok: true, data: [] });
  mocks.getThread.mockResolvedValue({ ok: true, data: snapshot() });
  mocks.listenEvents.mockReturnValue(vi.fn());
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

it("重连后恢复丢失的 InnerError，不把失败静默收成空闲", async () => {
  const { onReconnect, store, unmount } = await mountRunningAgent();
  try {
    await act(async () => onReconnect());
    const state = store.get(agentConversationStatesAtom)["thread-1"];
    expect(state?.runningRunID).toBe("");
    expect(state?.liveTimeline).toEqual([
      expect.objectContaining({ status: "failed", error: "provider disconnected" })
    ]);
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
    expect(state?.streamText).toBe("重连后的新内容");
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
