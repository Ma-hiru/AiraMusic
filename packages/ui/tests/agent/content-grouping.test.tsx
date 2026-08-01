import { vi } from "vitest";
import { act, render, screen, within, fireEvent } from "@testing-library/react";
import ChatContent from "@mahiru/ui/wins/agent/page/chat/content";
import type { LLMConversationSnapshot } from "@mahiru/ai";

vi.mock("@/common/lib/bus", () => ({
  RendererIPCMessageBus: {
    trackMeta: {},
    updater: { deliver: vi.fn() }
  }
}));
vi.mock("@/common/hooks/use-listenable", () => ({
  useListenable: () => ({ data: null })
}));
vi.mock("@/common/hooks/use-scroll-auto-hide", () => ({
  useScrollAutoHide: () => undefined
}));

const scrollIntoViewMock = vi.fn();

Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  value: scrollIntoViewMock
});

describe("对话自动滚动", () => {
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let resizeCallbacks: ResizeObserverCallback[] = [];

  beforeEach(() => {
    resizeCallbacks = [];
    scrollIntoViewMock.mockClear();
    globalThis.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }

      disconnect() {}
      observe() {}
      unobserve() {}
    } as typeof ResizeObserver;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it("内容增长不会被误判为用户离开底部，流式输出会继续贴底", () => {
    const props = {
      recovering: false,
      conversation: null,
      runningRunID: "run-scroll",
      pendingUserMessage: "介绍当前歌曲",
      onCreateConfig: () => undefined,
      onSubmitPrompt: async () => true,
      onCreateConversation: () => undefined,
      liveTimeline: [],
      running: true,
      configured: true,
      hasConversation: true
    };
    const { rerender, container } = render(<ChatContent {...props} streamText="第一段" />);
    const scroller = container.querySelector<HTMLDivElement>(".agent-scroll");

    expect(scroller).not.toBeNull();
    expect(resizeCallbacks).toHaveLength(1);
    setScrollMetrics(scroller!, { scrollHeight: 600, scrollTop: 300, clientHeight: 300 });
    fireEvent.scroll(scroller!);
    scrollIntoViewMock.mockClear();

    setScrollMetrics(scroller!, { scrollHeight: 800, scrollTop: 300, clientHeight: 300 });
    act(() => resizeCallbacks[0]!([], {} as ResizeObserver));
    scrollIntoViewMock.mockClear();
    rerender(<ChatContent {...props} streamText="第一段，第二段" />);

    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it("用户主动滚离后停止抢滚，回到底部后恢复跟随", () => {
    const props = {
      recovering: false,
      conversation: null,
      runningRunID: "run-scroll",
      pendingUserMessage: "介绍当前歌曲",
      onCreateConfig: () => undefined,
      onSubmitPrompt: async () => true,
      onCreateConversation: () => undefined,
      liveTimeline: [],
      running: true,
      configured: true,
      hasConversation: true
    };
    const { rerender, container } = render(<ChatContent {...props} streamText="第一段" />);
    const scroller = container.querySelector<HTMLDivElement>(".agent-scroll")!;

    setScrollMetrics(scroller, { scrollHeight: 900, scrollTop: 300, clientHeight: 300 });
    fireEvent.scroll(scroller);
    scrollIntoViewMock.mockClear();
    rerender(<ChatContent {...props} streamText="第一段，第二段" />);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    setScrollMetrics(scroller, { scrollHeight: 900, scrollTop: 600, clientHeight: 300 });
    fireEvent.scroll(scroller);
    rerender(<ChatContent {...props} streamText="第一段，第二段，第三段" />);
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it("即使仍在贴底阈值内，用户向上滚动后也不会被流式输出拉回", () => {
    const props = {
      recovering: false,
      conversation: null,
      runningRunID: "run-shallow-scroll",
      pendingUserMessage: "介绍当前歌曲",
      onCreateConfig: () => undefined,
      onSubmitPrompt: async () => true,
      onCreateConversation: () => undefined,
      liveTimeline: [],
      running: true,
      configured: true,
      hasConversation: true
    };
    const { rerender, container } = render(<ChatContent {...props} streamText="第一段" />);
    const scroller = container.querySelector<HTMLDivElement>(".agent-scroll")!;

    setScrollMetrics(scroller, { scrollHeight: 900, scrollTop: 600, clientHeight: 300 });
    fireEvent.scroll(scroller);
    setScrollMetrics(scroller, { scrollHeight: 900, scrollTop: 560, clientHeight: 300 });
    fireEvent.scroll(scroller);
    scrollIntoViewMock.mockClear();

    rerender(<ChatContent {...props} streamText="第一段，第二段" />);

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "跳到最新" })).toBeInTheDocument();
  });
});

describe("Assistant 连续回复分组", () => {
  it("把同一历史 run 的说明、工具步骤和最终回复放进一个 Assistant 容器", () => {
    renderChatContent({
      id: "conversation-1",
      name: "测试对话",
      createdAt: 1,
      updatedAt: 2,
      metadata: {},
      messages: [
        { role: "user", content: "介绍当前歌曲" },
        {
          role: "assistant",
          content: "我先读取歌曲详情。",
          toolCalls: [
            {
              name: "agent-tool-track-detail",
              callID: "call-1",
              arguments: "{}"
            }
          ]
        },
        {
          role: "tool",
          name: "agent-tool-track-detail",
          callID: "call-1",
          content: JSON.stringify({ name: "群青", artists: [{ name: "YOASOBI" }] })
        },
        {
          role: "assistant",
          content: "我再看看听众的评论。",
          toolCalls: [
            {
              name: "agent-tool-track-comment",
              callID: "call-2",
              arguments: JSON.stringify({ id: 42 })
            }
          ]
        },
        {
          role: "tool",
          name: "agent-tool-track-comment",
          callID: "call-2",
          content: JSON.stringify({ comments: [{ content: "每次听都很有力量" }] })
        },
        { role: "assistant", content: "《群青》是一首充满生命力的歌曲。" }
      ],
      assistantTurns: [
        {
          runID: "run-1",
          step: 0,
          messageIndex: 1,
          status: "complete",
          finishReason: "tool_calls",
          usage: { input: 100, output: 10, total: 110 }
        },
        {
          runID: "run-1",
          step: 1,
          messageIndex: 3,
          status: "complete",
          finishReason: "tool_calls",
          usage: { input: 140, output: 20, total: 160 }
        },
        {
          runID: "run-1",
          step: 2,
          messageIndex: 5,
          status: "complete",
          finishReason: "stop",
          usage: { input: 180, output: 30, total: 210 }
        }
      ]
    });

    const assistantGroup = screen.getByRole("group", { name: "Aira 的连续回复" });
    expect(within(assistantGroup).getAllByText("Aira")).toHaveLength(1);
    expect(within(assistantGroup).getByText("我先读取歌曲详情。")).toBeInTheDocument();
    const completedToolDisclosure = within(assistantGroup).getByRole("button", {
      name: /^读取歌曲详情·/
    });
    expect(completedToolDisclosure).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(completedToolDisclosure);
    expect(completedToolDisclosure).toHaveAttribute("aria-expanded", "true");
    expect(within(assistantGroup).getByText("我再看看听众的评论。")).toBeInTheDocument();
    expect(within(assistantGroup).getByRole("button", { name: /^读取评论·/ })).toBeInTheDocument();
    expect(
      within(assistantGroup).getByText("《群青》是一首充满生命力的歌曲。")
    ).toBeInTheDocument();
    const copyButton = within(assistantGroup).getByRole("button", { name: "复制回复" });
    expect(copyButton.parentElement).toHaveTextContent("《群青》是一首充满生命力的歌曲。");
    expect(within(assistantGroup).getAllByLabelText("本轮 Token 用量")).toHaveLength(1);
    expect(within(assistantGroup).getByText("210")).toBeInTheDocument();
  });

  it("把 liveTimeline 工具步骤与同一 runningRunID 的当前流式文本放进一个容器", () => {
    render(
      <ChatContent
        recovering={false}
        conversation={null}
        runningRunID="run-live"
        pendingUserMessage="介绍当前歌曲"
        streamText="根据刚才的资料，这首歌表达了持续前行的力量。"
        onCreateConfig={() => undefined}
        onSubmitPrompt={async () => true}
        onCreateConversation={() => undefined}
        liveTimeline={[
          {
            id: "run-live-0-assistant",
            runID: "run-live",
            type: "assistant",
            text: "我先读取歌曲详情。"
          },
          {
            id: "run-live-0-tool",
            runID: "run-live",
            step: 0,
            type: "tool",
            status: "done",
            toolCalls: [
              {
                name: "agent-tool-track-detail",
                callID: "call-live",
                arguments: "{}"
              }
            ],
            toolResults: [
              {
                name: "agent-tool-track-detail",
                callID: "call-live",
                output: JSON.stringify({ name: "群青" })
              }
            ],
            assistantTurn: {
              runID: "run-live",
              step: 0,
              status: "complete",
              finishReason: "tool_calls",
              usage: { input: 100, output: 10, total: 110 }
            }
          }
        ]}
        running
        configured
        hasConversation
      />
    );

    const assistantGroups = screen.getAllByRole("group", { name: "Aira 的连续回复" });
    expect(assistantGroups).toHaveLength(1);
    const assistantGroup = assistantGroups[0]!;
    expect(within(assistantGroup).getAllByText("Aira")).toHaveLength(1);
    expect(within(assistantGroup).getByText("我先读取歌曲详情。")).toBeInTheDocument();
    const toolDisclosure = within(assistantGroup).getByRole("button", {
      name: /^读取歌曲详情·/
    });
    expect(toolDisclosure).toBeInTheDocument();
    fireEvent.click(toolDisclosure);
    expect(toolDisclosure).toHaveAttribute("aria-expanded", "true");
    expect(
      within(assistantGroup).getByText("根据刚才的资料，这首歌表达了持续前行的力量。")
    ).toBeInTheDocument();
    expect(within(assistantGroup).getByText("正在回复")).toBeInTheDocument();
    expect(within(assistantGroup).getAllByRole("button", { name: "复制回复" })).toHaveLength(1);
    expect(within(assistantGroup).getAllByLabelText("本轮 Token 用量")).toHaveLength(1);
  });

  it("工具仍在执行时保持结果区域展开", () => {
    render(
      <ChatContent
        streamText=""
        recovering={false}
        conversation={null}
        runningRunID="run-tool"
        pendingUserMessage="介绍当前歌曲"
        onCreateConfig={() => undefined}
        onSubmitPrompt={async () => true}
        onCreateConversation={() => undefined}
        liveTimeline={[
          {
            id: "run-tool-0-tool",
            runID: "run-tool",
            step: 0,
            type: "tool",
            status: "running",
            toolCalls: [
              {
                name: "agent-tool-track-detail",
                callID: "call-running",
                arguments: "{}"
              }
            ],
            toolResults: []
          }
        ]}
        running
        configured
        hasConversation
      />
    );

    const disclosure = screen.getByRole("button", { name: /^读取歌曲详情·/ });
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
  });

  it("把同一 run 的终止状态收进 Assistant 容器底部且不重复用量", () => {
    render(
      <ChatContent
        streamText=""
        running={false}
        runningRunID=""
        recovering={false}
        conversation={null}
        pendingUserMessage="介绍当前歌曲"
        onCreateConfig={() => undefined}
        onSubmitPrompt={async () => true}
        onCreateConversation={() => undefined}
        liveTimeline={[
          {
            id: "run-failed-0-assistant",
            runID: "run-failed",
            type: "assistant",
            text: "我先尝试读取歌曲信息。"
          },
          {
            id: "run-failed-terminal",
            runID: "run-failed",
            type: "terminal",
            status: "failed",
            error: "service: request failed",
            usage: { input: 80, output: 8, total: 88 }
          }
        ]}
        configured
        hasConversation
      />
    );

    const assistantGroup = screen.getByRole("group", { name: "Aira 的连续回复" });
    expect(assistantGroup).toHaveAttribute("data-assistant-run-id", "run-failed");
    expect(within(assistantGroup).getByRole("alert")).toHaveTextContent("request failed");
    expect(within(assistantGroup).getAllByText("Aira")).toHaveLength(1);
    expect(within(assistantGroup).getAllByRole("button", { name: "复制回复" })).toHaveLength(1);
    expect(within(assistantGroup).getAllByLabelText("本轮 Token 用量")).toHaveLength(1);
  });

  it("恢复运行时不重复显示已经持久化的用户消息", () => {
    render(
      <ChatContent
        streamText=""
        liveTimeline={[]}
        pendingUserMessage="介绍当前歌曲"
        runningRunID="run-recovering"
        onCreateConfig={() => undefined}
        onSubmitPrompt={async () => true}
        onCreateConversation={() => undefined}
        conversation={{
          id: "conversation-recovering",
          name: "恢复中的对话",
          createdAt: 1,
          updatedAt: 2,
          metadata: {},
          runtime: {
            runID: "run-recovering",
            status: "running",
            terminal: false,
            incomplete: true,
            startedAt: 100
          },
          messages: [{ role: "user", content: "介绍当前歌曲" }]
        }}
        running
        configured
        recovering
        hasConversation
      />
    );

    expect(screen.getAllByText("介绍当前歌曲")).toHaveLength(1);
  });

  it("切回运行中的会话时用 live 步骤覆盖快照中的同一步骤", () => {
    render(
      <ChatContent
        recovering={false}
        streamText="正在整理最终回答。"
        runningRunID="run-switch"
        pendingUserMessage="介绍当前歌曲"
        onCreateConfig={() => undefined}
        onSubmitPrompt={async () => true}
        onCreateConversation={() => undefined}
        liveTimeline={[
          {
            id: "run-switch-0-assistant",
            runID: "run-switch",
            type: "assistant",
            text: "我先读取歌曲详情。"
          },
          {
            id: "run-switch-0-tool",
            runID: "run-switch",
            step: 0,
            type: "tool",
            status: "done",
            toolCalls: [
              {
                name: "agent-tool-track-detail",
                callID: "call-switch",
                arguments: "{}"
              }
            ],
            toolResults: [
              {
                name: "agent-tool-track-detail",
                callID: "call-switch",
                output: JSON.stringify({ name: "群青" })
              }
            ]
          }
        ]}
        conversation={{
          id: "conversation-switch",
          name: "运行中的对话",
          createdAt: 1,
          updatedAt: 2,
          metadata: {},
          runtime: {
            runID: "run-switch",
            status: "running",
            terminal: false,
            incomplete: true,
            startedAt: 100
          },
          messages: [
            { role: "user", content: "介绍当前歌曲" },
            {
              role: "assistant",
              content: "我先读取歌曲详情。",
              toolCalls: [
                {
                  name: "agent-tool-track-detail",
                  callID: "call-switch",
                  arguments: "{}"
                }
              ]
            },
            {
              role: "tool",
              name: "agent-tool-track-detail",
              callID: "call-switch",
              content: JSON.stringify({ name: "群青" })
            }
          ],
          assistantTurns: [
            {
              runID: "run-switch",
              step: 0,
              messageIndex: 1,
              status: "complete",
              finishReason: "tool_calls"
            }
          ]
        }}
        running
        configured
        hasConversation
      />
    );

    const assistantGroup = screen.getByRole("group", { name: "Aira 的连续回复" });
    expect(within(assistantGroup).getAllByText("我先读取歌曲详情。")).toHaveLength(1);
    expect(assistantGroup.querySelectorAll("section[data-status] > button")).toHaveLength(1);
    expect(screen.getAllByText("介绍当前歌曲")).toHaveLength(1);
  });

  it("纯工具回复保持与普通助手回复相同的完整宽度", () => {
    renderChatContent({
      id: "conversation-tool-only",
      name: "纯工具回复",
      createdAt: 1,
      updatedAt: 2,
      metadata: {},
      messages: [
        { role: "user", content: "读取歌曲详情" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              name: "agent-tool-track-detail",
              callID: "tool-only-call",
              arguments: JSON.stringify({ id: 42 })
            }
          ]
        },
        {
          role: "tool",
          name: "agent-tool-track-detail",
          callID: "tool-only-call",
          content: JSON.stringify({ name: "群青" })
        }
      ],
      assistantTurns: [
        {
          runID: "run-tool-only",
          step: 0,
          messageIndex: 1,
          status: "complete",
          finishReason: "tool_calls"
        }
      ]
    });

    const assistantGroup = screen.getByRole("group", { name: "Aira 的连续回复" });
    expect(assistantGroup).toHaveClass("w-full");
    expect(assistantGroup.querySelector("section[data-status]")).toHaveClass("w-full");
  });

  it("重复的同一 callID 结果不能把缺失的并行调用误判为完成", () => {
    renderChatContent({
      id: "conversation-duplicate-tool-result",
      name: "并行工具结果",
      createdAt: 1,
      updatedAt: 2,
      metadata: {},
      messages: [
        { role: "user", content: "读取两首歌曲" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              name: "agent-tool-track-detail",
              callID: "call-a",
              arguments: JSON.stringify({ id: 1 })
            },
            {
              name: "agent-tool-track-detail",
              callID: "call-b",
              arguments: JSON.stringify({ id: 2 })
            }
          ]
        },
        {
          role: "tool",
          name: "agent-tool-track-detail",
          callID: "call-a",
          content: JSON.stringify({ name: "第一首歌" })
        },
        {
          role: "tool",
          name: "agent-tool-track-detail",
          callID: "call-a",
          content: JSON.stringify({ name: "第一首歌（重复）" })
        }
      ]
    });

    const toolStep = screen
      .getByRole("group", { name: "Aira 的连续回复" })
      .querySelector("section[data-status]");
    expect(toolStep).toHaveAttribute("data-status", "running");
    expect(screen.getByText("正在等待结果")).toBeInTheDocument();
  });

  it("历史 run 已终止且工具结果缺失时不再把工具显示为运行中", () => {
    renderChatContent({
      id: "conversation-failed",
      name: "失败对话",
      createdAt: 1,
      updatedAt: 2,
      metadata: {},
      messages: [
        { role: "user", content: "介绍当前歌曲" },
        {
          role: "assistant",
          content: "我先尝试读取歌曲详情。",
          toolCalls: [
            {
              name: "agent-tool-track-detail",
              callID: "missing-call",
              arguments: "{}"
            }
          ]
        }
      ],
      assistantTurns: [
        {
          runID: "run-incomplete",
          step: 0,
          messageIndex: 1,
          status: "incomplete",
          finishReason: "tool_calls",
          usage: { input: 70, output: 7, total: 77 }
        }
      ],
      runtime: {
        runID: "run-incomplete",
        status: "failed",
        terminal: true,
        incomplete: true,
        startedAt: 100,
        endedAt: 200,
        usage: { input: 70, output: 7, total: 77 },
        error: { type: "service", message: "tool result missing" }
      }
    });

    const assistantGroup = screen.getByRole("group", { name: "Aira 的连续回复" });
    expect(assistantGroup.querySelector('[data-status="error"]')).toBeInTheDocument();
    expect(assistantGroup.querySelector('[data-status="running"]')).not.toBeInTheDocument();
    expect(within(assistantGroup).getByText(/tool result missing/)).toBeInTheDocument();
    expect(within(assistantGroup).getAllByLabelText("本轮 Token 用量")).toHaveLength(1);
  });
});

const renderChatContent = (conversation: LLMConversationSnapshot) =>
  render(
    <ChatContent
      streamText=""
      running={false}
      runningRunID=""
      liveTimeline={[]}
      recovering={false}
      pendingUserMessage=""
      conversation={conversation}
      onCreateConfig={() => undefined}
      onSubmitPrompt={async () => true}
      onCreateConversation={() => undefined}
      configured
      hasConversation
    />
  );

const setScrollMetrics = (
  element: HTMLElement,
  metrics: { scrollTop: number; clientHeight: number; scrollHeight: number }
) => {
  Object.defineProperties(element, {
    scrollHeight: { configurable: true, value: metrics.scrollHeight },
    scrollTop: { configurable: true, writable: true, value: metrics.scrollTop },
    clientHeight: { configurable: true, value: metrics.clientHeight }
  });
};
