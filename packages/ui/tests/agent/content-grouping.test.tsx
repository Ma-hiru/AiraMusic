import { fireEvent, render, screen } from "@testing-library/react";
import ChatContent from "@mahiru/ui/wins/agent/page/chat/content";
import type { ThreadSnapshot } from "@mahiru/agent/browser";

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

Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn()
});

describe("Rust Agent 消息分组", () => {
  it("把 assistant tool call 与后续 tool result 合并为一个工具步骤", () => {
    renderChatContent({
      ...thread(),
      messages: [
        { role: "user", content: "介绍当前歌曲" },
        {
          role: "assistant",
          content: "我先读取歌曲详情。",
          toolCalls: [
            {
              id: "call-1",
              name: "agent-tool-track-detail",
              args: { ids: [1], mode: "simple" }
            }
          ]
        },
        {
          role: "tool",
          content: JSON.stringify({ name: "群青" }),
          toolCallId: "call-1"
        },
        { role: "assistant", content: "《群青》是一首充满向前力量的作品。" }
      ]
    });

    expect(screen.getByText("我先读取歌曲详情。")).toBeInTheDocument();
    expect(screen.getByText("读取歌曲详情")).toBeInTheDocument();
    expect(screen.getByText(/《群青》是一首充满向前力量的作品/)).toBeInTheDocument();
    expect(screen.getAllByText("读取歌曲详情")).toHaveLength(1);
  });

  it("不把 system 与 inner 消息渲染成聊天内容", () => {
    renderChatContent({
      ...thread(),
      messages: [
        { role: "system", content: "system secret" },
        { role: "inner", content: "internal state", innerType: "think" },
        { role: "assistant", content: "对用户可见" }
      ]
    });

    expect(screen.queryByText("system secret")).not.toBeInTheDocument();
    expect(screen.queryByText("internal state")).not.toBeInTheDocument();
    expect(screen.getByText("对用户可见")).toBeInTheDocument();
  });

  it("运行中的用户消息已进入 Rust 快照时不重复渲染 pending message", () => {
    renderChatContent(
      {
        ...thread(),
        runtime: { status: "running", runId: "run-1" },
        messages: [{ role: "user", content: "介绍当前歌曲" }]
      },
      {
        running: true,
        runningRunID: "run-1",
        pendingUserMessage: "介绍当前歌曲"
      }
    );

    expect(screen.getAllByText("介绍当前歌曲")).toHaveLength(1);
  });

  it("展示流式思考内容，且不与正式回答混在一起", () => {
    renderChatContent(thread(), {
      running: true,
      runningRunID: "run-1",
      liveTimeline: [
        {
          id: "run-1-reasoning-1-reasoning",
          type: "reasoning",
          step: 1,
          runID: "run-1",
          messageID: "reasoning-1",
          text: "正在分析当前歌曲背景……",
          status: "streaming"
        }
      ]
    });

    expect(screen.getByRole("button", { name: /正在思考/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByText("正在分析当前歌曲背景……")).toBeInTheDocument();
  });

  it("从 Rust 快照恢复已完成的思考内容", () => {
    renderChatContent({
      ...thread(),
      messages: [
        {
          role: "assistant",
          content: "《群青》是 YOASOBI 的代表作。",
          reasoningContent: "先确认歌曲信息，再结合歌词回答。"
        }
      ]
    });

    const toggle = screen.getByRole("button", { name: /思考过程/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("《群青》是 YOASOBI 的代表作。")).toBeInTheDocument();
    expect(screen.queryByText(/先确认歌曲信息/)).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByText(/先确认歌曲信息/)).toBeInTheDocument();
  });

  it("把 Rust 多 step usage 汇总到本轮 Agent 回复底部", () => {
    renderChatContent({
      ...thread(),
      messages: [
        { role: "user", content: "分析当前歌曲" },
        {
          role: "assistant",
          content: "我先读取歌曲信息。",
          toolCalls: [{ id: "call-1", name: "agent-tool-track-detail", args: {} }]
        },
        { role: "tool", content: "{}", toolCallId: "call-1" },
        { role: "assistant", content: "这是最终分析。" },
        {
          role: "inner",
          innerType: "usage",
          content: JSON.stringify({
            records: [
              { step: 1, usage: { prompt_tokens: 100, completion_tokens: 20 } },
              { step: 2, usage: { prompt_tokens: 120, completion_tokens: 10 } }
            ]
          })
        }
      ]
    });

    const usage = screen.getByLabelText("本轮 Token 用量");
    expect(usage).toHaveTextContent("本轮累计输入220");
    expect(usage).toHaveTextContent("输出30");
    expect(usage).toHaveTextContent("总计250");
    expect(usage).toHaveTextContent("请求次数2");
    expect(screen.getAllByLabelText("本轮 Token 用量")).toHaveLength(1);
  });
});

const thread = (): ThreadSnapshot => ({
  id: "thread-1",
  name: "测试会话",
  createdAt: 1,
  updatedAt: 2,
  messages: [],
  runtime: { status: "idle" }
});

const renderChatContent = (
  conversation: ThreadSnapshot,
  overrides: Partial<React.ComponentProps<typeof ChatContent>> = {}
) =>
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
      {...overrides}
    />
  );
