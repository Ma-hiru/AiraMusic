import { Provider, createStore } from "jotai";
import { act, render, screen, fireEvent, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import type { ProviderConfigView } from "@mahiru/agent/browser";

const mocks = vi.hoisted(() => ({
  createRun: vi.fn(),
  cancelRun: vi.fn(),
  toast: vi.fn()
}));

vi.mock("@mahiru/ui/wins/agent/lib/agent", () => ({
  RendererAgent: {
    createRun: mocks.createRun,
    cancelRun: mocks.cancelRun
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
import ChatInput from "@mahiru/ui/wins/agent/page/chat/input";

describe("Rust Agent 会话运行态", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("同步拦截同一会话的快速双次提交，并转发直接 Rust run DTO", async () => {
    let resolveRun!: (value: { ok: true; data: { runId: string; threadId: string } }) => void;
    mocks.createRun.mockReturnValue(
      new Promise<{ ok: true; data: { runId: string; threadId: string } }>((resolve) => {
        resolveRun = resolve;
      })
    );
    const store = createStore();
    store.set(agentSelectedConfigIDAtom, "config-1");
    const wrapper = ({ children }: PropsWithChildren) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(() => useConversation("thread-1"), { wrapper });

    let firstSubmit!: Promise<boolean>;
    let secondSubmit!: Promise<boolean>;
    act(() => {
      firstSubmit = result.current.submit("第一条消息");
      secondSubmit = result.current.submit("第二条消息");
    });

    await act(async () => {
      resolveRun({ ok: true, data: { runId: "run-1", threadId: "thread-1" } });
      await Promise.all([firstSubmit, secondSubmit]);
    });

    await expect(secondSubmit).resolves.toBe(false);
    expect(mocks.createRun).toHaveBeenCalledTimes(1);
    expect(mocks.createRun).toHaveBeenCalledWith({
      content: "第一条消息",
      configId: "config-1",
      threadId: "thread-1"
    });
    expect(store.get(agentConversationStatesAtom)["thread-1"]?.runningRunID).toBe("run-1");
  });

  it("旧渲染闭包不能绕过已经开始的 Rust run", async () => {
    mocks.createRun.mockResolvedValue({
      ok: true,
      data: { runId: "unexpected", threadId: "thread-1" }
    });
    const store = createStore();
    store.set(agentSelectedConfigIDAtom, "config-1");
    const wrapper = ({ children }: PropsWithChildren) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(() => useConversation("thread-1"), { wrapper });
    const staleSubmit = result.current.submit;

    act(() => {
      store.set(agentUpdateConversationStateAtom, {
        conversationID: "thread-1",
        update: (state) => ({ ...state, runningRunID: "run-active" })
      });
    });

    await expect(staleSubmit("不应发送")).resolves.toBe(false);
    expect(mocks.createRun).not.toHaveBeenCalled();
  });

  it("请求等待期间输入的新草稿不会被旧请求完成清空", async () => {
    let resolveSubmit!: (accepted: boolean) => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSubmit = resolve;
        })
    );
    render(
      <ChatInput
        runningRunID=""
        selectedConversationID="thread-1"
        activeConfig={{ id: "config-1", name: "Test" } as ProviderConfigView}
        onAbort={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "第一条消息" } });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
    fireEvent.change(input, { target: { value: "等待期间的新草稿" } });
    await act(async () => resolveSubmit(true));

    expect(input).toHaveValue("等待期间的新草稿");
  });
});
