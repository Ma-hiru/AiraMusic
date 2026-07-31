import { Provider, createStore } from "jotai";
import { act, render, screen, waitFor, fireEvent, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import type { LLMConversationSnapshot, AIProviderConfigSnapshot } from "@mahiru/ai";

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
  createAgentConversationState,
  agentUpdateConversationStateAtom
} from "@mahiru/ui/wins/agent/atoms/agent";
import ChatInput from "@mahiru/ui/wins/agent/page/chat/input";

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

  it("编辑最近中止的消息时传递运行校验，并在本地移除未完成尾部", async () => {
    mocks.chat.mockResolvedValue({ ok: true, data: { runID: "run-retry" } });
    const store = createStore();
    store.set(agentSelectedConfigIDAtom, "config-1");
    store.set(agentConversationStatesAtom, {
      "conversation-1": {
        ...createAgentConversationState(),
        conversation: createAbortedConversation()
      }
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(() => useConversation("conversation-1"), { wrapper });

    expect(result.current.retryCandidate).toEqual({
      runID: "run-aborted",
      text: "原始问题"
    });

    await act(async () => {
      await expect(result.current.retry("编辑后的问题", "run-aborted")).resolves.toBe(true);
    });

    expect(mocks.chat).toHaveBeenCalledWith({
      input: "编辑后的问题",
      configID: "config-1",
      conversationID: "conversation-1",
      retryAbortedRunID: "run-aborted"
    });
    expect(store.get(agentConversationStatesAtom)["conversation-1"]).toMatchObject({
      runningRunID: "run-retry",
      pendingUserMessage: "编辑后的问题",
      conversation: {
        name: "",
        messages: [
          { role: "user", content: "上一轮问题" },
          { role: "assistant", content: "上一轮回答" }
        ],
        assistantTurns: [{ runID: "run-previous", messageIndex: 1 }]
      }
    });
    expect(
      store.get(agentConversationStatesAtom)["conversation-1"]?.conversation?.runtime
    ).toBeUndefined();
  });

  it("停止后自动进入编辑态，提交修改后的内容重新生成", async () => {
    const onRetry = vi.fn().mockResolvedValue(true);
    render(
      <ChatInput
        runningRunID=""
        selectedConversationID="conversation-1"
        retryCandidate={{ runID: "run-aborted", text: "原始问题" }}
        activeConfig={{ id: "config-1" } as AIProviderConfigSnapshot}
        onAbort={vi.fn()}
        onRetry={onRetry}
        onSubmit={vi.fn().mockResolvedValue(true)}
      />
    );

    const input = screen.getByRole("textbox");
    await waitFor(() => expect(input).toHaveValue("原始问题"));
    expect(input).not.toHaveFocus();
    expect(screen.getByText(/正在编辑已停止的消息/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "编辑后的问题" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
    expect(onRetry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));

    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledWith("编辑后的问题", "run-aborted");
    });
    expect(input).toHaveValue("");
  });

  it("手动编辑中止消息时，取消后恢复原有草稿", async () => {
    const commonProps = {
      activeConfig: { id: "config-1" } as AIProviderConfigSnapshot,
      runningRunID: "",
      selectedConversationID: "conversation-1",
      onAbort: vi.fn(),
      onRetry: vi.fn().mockResolvedValue(true),
      onSubmit: vi.fn().mockResolvedValue(true)
    };
    const { rerender } = render(<ChatInput {...commonProps} retryCandidate={null} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "尚未发送的草稿" } });

    rerender(
      <ChatInput
        {...commonProps}
        retryCandidate={{ runID: "run-aborted", text: "已停止的原消息" }}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("编辑已停止的消息并重新生成")).toBeInTheDocument();
    });
    expect(input).toHaveValue("尚未发送的草稿");

    fireEvent.click(screen.getByText("编辑已停止的消息并重新生成"));
    expect(input).toHaveValue("已停止的原消息");
    fireEvent.click(screen.getByRole("button", { name: "取消编辑已停止的消息" }));
    expect(input).toHaveValue("尚未发送的草稿");
  });

  it("请求等待期间输入的新草稿不会被旧请求完成事件清空", async () => {
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
        retryCandidate={null}
        selectedConversationID="conversation-1"
        activeConfig={{ id: "config-1" } as AIProviderConfigSnapshot}
        onAbort={vi.fn()}
        onSubmit={onSubmit}
        onRetry={vi.fn().mockResolvedValue(true)}
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "第一条消息" } });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
    expect(onSubmit).toHaveBeenCalledWith("第一条消息");

    fireEvent.change(input, { target: { value: "等待期间的新草稿" } });
    await act(async () => {
      resolveSubmit(true);
    });

    expect(input).toHaveValue("等待期间的新草稿");
  });
});

const createAbortedConversation = (): LLMConversationSnapshot => ({
  id: "conversation-1",
  name: "首轮自动标题",
  createdAt: 1,
  updatedAt: 2,
  metadata: {},
  messages: [
    { role: "user", content: "上一轮问题" },
    { role: "assistant", content: "上一轮回答" },
    { role: "user", content: "原始问题" },
    { role: "assistant", content: "先搜索资料" },
    { role: "assistant", content: "半截回复" }
  ],
  runtime: {
    runID: "run-aborted",
    status: "aborted",
    startedAt: 10,
    endedAt: 20,
    terminal: true,
    incomplete: true,
    titleGenerated: true,
    inputMessageIndex: 2
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
      messageIndex: 4
    }
  ]
});
