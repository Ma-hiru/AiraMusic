import { Provider, createStore } from "jotai";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";

const mocks = vi.hoisted(() => ({
  chat: vi.fn(),
  abort: vi.fn(),
  toast: vi.fn()
}));

vi.mock("@mahiru/ui/wins/agent/lib/agent", () => ({
  RendererAgent: {
    chat: mocks.chat,
    abort: mocks.abort
  }
}));

vi.mock("@mahiru/ui/common/components/display/toast", () => ({
  default: { show: mocks.toast }
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

import { useConversation } from "@mahiru/ui/wins/agent/hooks/use-conversation";
import {
  agentSelectedConfigIDAtom,
  agentConversationStatesAtom,
  agentUpdateConversationStateAtom
} from "@mahiru/ui/wins/agent/atoms/agent";

describe("Agent 会话提交运行态", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("同步拦截同一会话的快速双次提交", async () => {
    let resolveChat!: (value: { ok: true; data: { runID: string } }) => void;
    mocks.chat.mockReturnValue(
      new Promise<{ ok: true; data: { runID: string } }>((resolve) => {
        resolveChat = resolve;
      })
    );
    const store = createStore();
    store.set(agentSelectedConfigIDAtom, "config-1");
    const wrapper = ({ children }: PropsWithChildren) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(() => useConversation("conversation-1"), { wrapper });

    let firstSubmit!: Promise<boolean>;
    let secondSubmit!: Promise<boolean>;
    act(() => {
      firstSubmit = result.current.submit("第一条消息");
      secondSubmit = result.current.submit("第二条消息");
    });

    await act(async () => {
      resolveChat({ ok: true, data: { runID: "run-1" } });
      await Promise.all([firstSubmit, secondSubmit]);
    });
    await expect(secondSubmit).resolves.toBe(false);
    expect(mocks.chat).toHaveBeenCalledTimes(1);
    expect(mocks.chat).toHaveBeenCalledWith({
      input: "第一条消息",
      configID: "config-1",
      conversationID: "conversation-1"
    });
    expect(store.get(agentConversationStatesAtom)["conversation-1"]?.runningRunID).toBe("run-1");
  });

  it("旧请求失败时不会清掉已经开始的另一条 run", async () => {
    let resolveChat!: (value: {
      ok: false;
      reason: { message: string; type: "agent_runtime" };
    }) => void;
    mocks.chat.mockReturnValue(
      new Promise<{
        ok: false;
        reason: { message: string; type: "agent_runtime" };
      }>((resolve) => {
        resolveChat = resolve;
      })
    );
    const store = createStore();
    store.set(agentSelectedConfigIDAtom, "config-1");
    const wrapper = ({ children }: PropsWithChildren) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(() => useConversation("conversation-1"), { wrapper });

    let submit!: Promise<boolean>;
    act(() => {
      submit = result.current.submit("介绍当前歌曲");
    });
    act(() => {
      store.set(agentUpdateConversationStateAtom, {
        conversationID: "conversation-1",
        update: (state) => ({ ...state, runningRunID: "run-already-started" })
      });
    });

    await act(async () => {
      resolveChat({
        ok: false,
        reason: { type: "agent_runtime", message: "旧请求晚到的失败" }
      });
      await submit;
    });

    expect(store.get(agentConversationStatesAtom)["conversation-1"]).toMatchObject({
      sending: false,
      runningRunID: "run-already-started",
      pendingUserMessage: "介绍当前歌曲"
    });
  });

  it("旧渲染闭包也不能绕过已经开始的 run", async () => {
    mocks.chat.mockResolvedValue({ ok: true, data: { runID: "unexpected" } });
    const store = createStore();
    store.set(agentSelectedConfigIDAtom, "config-1");
    const wrapper = ({ children }: PropsWithChildren) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(() => useConversation("conversation-1"), { wrapper });
    const staleSubmit = result.current.submit;

    act(() => {
      store.set(agentUpdateConversationStateAtom, {
        conversationID: "conversation-1",
        update: (state) => ({ ...state, runningRunID: "run-already-started" })
      });
    });

    await expect(staleSubmit("不应发送")).resolves.toBe(false);
    expect(mocks.chat).not.toHaveBeenCalled();
    expect(store.get(agentConversationStatesAtom)["conversation-1"]?.runningRunID).toBe(
      "run-already-started"
    );
  });
});
