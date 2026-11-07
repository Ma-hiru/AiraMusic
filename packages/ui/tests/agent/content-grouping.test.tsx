import { render, screen, fireEvent } from "@testing-library/react";
import { toAgentUIMessages } from "@mahiru/ui/wins/agent/lib/chat/message";
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

  it("丢失 RUN_ERROR 后仍从持久化错误恢复失败卡片和 usage", () => {
    renderChatContent({
      ...thread(),
      runtime: { status: "failed", runId: "run-1" },
      messages: [
        { role: "user", content: "分析歌曲" },
        { role: "inner", innerType: "error", content: "provider disconnected" },
        {
          role: "inner",
          innerType: "usage",
          content: JSON.stringify({
            records: [{ step: 1, usage: { prompt_tokens: 100, completion_tokens: 20 } }]
          })
        }
      ]
    });

    expect(screen.getByRole("alert")).toHaveTextContent("provider disconnected");
    expect(screen.getByRole("alert")).not.toHaveTextContent("上下文大小");
    expect(screen.getByRole("alert")).toHaveTextContent("历史统计覆盖未知");
    expect(screen.getByRole("alert")).toHaveTextContent("本轮已知累计输出20");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it.each([
    ["部分回复", "《雪之舞》的旋律", "模型回复未完整结束"],
    ["空正文", "", "模型未返回正文或有效工具调用"]
  ])("冷恢复%s失败时展示已有正文、原因和一份用量", (_, text, error) => {
    renderChatContent({
      ...thread(),
      runtime: { status: "failed" },
      messages: [
        { role: "user", content: "继续" },
        ...(text ? [{ role: "assistant" as const, content: text }] : []),
        { role: "inner", innerType: "error", content: error },
        {
          role: "inner",
          innerType: "usage",
          content: JSON.stringify({
            records: [{ step: 2, usage: { prompt_tokens: 100, completion_tokens: 116 } }]
          })
        }
      ]
    });

    if (text) expect(screen.getByText(text)).toBeInTheDocument();
    const terminal = screen.getByRole("alert");
    expect(terminal).toHaveTextContent("本轮运行失败");
    expect(terminal).toHaveTextContent(error);
    expect(terminal).not.toHaveTextContent("上下文大小");
    expect(terminal).toHaveTextContent("历史统计覆盖未知");
    expect(terminal).toHaveTextContent("本轮已知累计输出116");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getAllByLabelText("本轮模型用量")).toHaveLength(1);
    expect(screen.getAllByRole("group", { name: "Aira 的连续回复" })).toHaveLength(1);
  });

  it("旧记录在工具错误后只有思考和用量时说明缺少最终回复，并保留思考", () => {
    const snapshot = reasoningOnlyThread();
    const assistant = toAgentUIMessages(snapshot).at(-1);
    expect(assistant?.parts).toContainEqual({
      type: "reasoning",
      text: "需要根据《雪之舞》的曲名继续确认。",
      state: "done"
    });
    expect(assistant?.parts).toContainEqual(
      expect.objectContaining({
        type: "dynamic-tool",
        state: "output-available",
        output: '{"error":"未知工具: search_snow_dance"}'
      })
    );
    renderChatContent(snapshot);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "历史记录仅包含思考内容，未保存最终回复或有效工具调用"
    );
    expect(screen.getByRole("alert")).toHaveTextContent("本轮已知累计输出136");
    expect(screen.getByRole("alert")).toHaveTextContent("已报告请求2");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getAllByLabelText("本轮模型用量")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /思考过程/ }));
    expect(screen.getByText("需要根据《雪之舞》的曲名继续确认。")).toBeInTheDocument();
  });

  it("运行中的最新轮只有思考和用量时不推断历史缺少回复", () => {
    renderChatContent(
      { ...reasoningOnlyThread(), runtime: { status: "running", runId: "run-1" } },
      { running: true, runningRunID: "run-1" }
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /思考过程/ })).toBeInTheDocument();
    expect(screen.getByLabelText("本轮模型用量")).toHaveTextContent("本轮已知累计输出136");
  });

  it("最终已有正文或尚无本轮用量时不推断历史缺少回复", () => {
    const answered = reasoningOnlyThread();
    answered.messages[3]!.content = "《雪之舞》的歌曲信息已确认。";
    const withoutUsage = reasoningOnlyThread();
    withoutUsage.messages.pop();

    for (const snapshot of [answered, withoutUsage]) {
      expect(toAgentUIMessages(snapshot).at(-1)?.metadata?.terminal).toBeUndefined();
    }
  });

  it.each([true, false])("旧思考记录已有明确错误时优先于停止标记，错误在前=%s", (errorFirst) => {
    const snapshot = reasoningOnlyThread();
    const reason = "模型未返回正文或有效工具调用";
    snapshot.runtime = { status: "failed" };
    const error: ThreadSnapshot["messages"][number] = {
      role: "inner",
      innerType: "error",
      content: reason
    };
    const stopped: ThreadSnapshot["messages"][number] = {
      role: "system",
      content: "[cancel]: 已取消"
    };
    snapshot.messages.splice(-1, 0, ...(errorFirst ? [error, stopped] : [stopped, error]));
    renderChatContent(snapshot);

    expect(screen.getByRole("alert")).toHaveTextContent(reason);
    expect(screen.getByRole("alert")).not.toHaveTextContent("历史记录");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getAllByLabelText("本轮模型用量")).toHaveLength(1);
  });

  it.each([
    ["[cancel]: 已取消", "本轮已停止"],
    ["[max-step]: max-step", "已达到最大步骤"]
  ])("思考后已有终止标记 %s 时恢复停止状态，隐藏原始 system 文本", (content, title) => {
    const snapshot = reasoningOnlyThread();
    snapshot.messages.splice(-1, 0, { role: "system", content });
    renderChatContent(snapshot);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(title);
    expect(screen.queryByText(content)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /思考过程/ })).toBeInTheDocument();
    expect(screen.getByLabelText("本轮模型用量")).toHaveTextContent("本轮已知累计输出136");
  });

  it("普通 system 提示不抑制历史记录缺少回复的说明", () => {
    const snapshot = reasoningOnlyThread();
    snapshot.messages.splice(-1, 0, {
      role: "system",
      content: "系统提示：[cancel] 和 [max-step] 表示运行状态。"
    });
    renderChatContent(snapshot);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "历史记录仅包含思考内容，未保存最终回复或有效工具调用"
    );
  });

  it.each(["idle", "running"] as const)("%s 快照最后已有工具调用时不误报缺少回复", (status) => {
    const snapshot = reasoningOnlyThread();
    snapshot.runtime = { status };
    snapshot.messages.splice(-2, 1, {
      role: "assistant",
      content: "",
      toolCalls: [{ id: "call-pending", name: "agent-tool-track-detail", args: { ids: [1] } }]
    });

    const assistant = toAgentUIMessages(snapshot).at(-1);
    expect(assistant?.metadata?.terminal).toBeUndefined();
    expect(assistant?.parts).toContainEqual(
      expect.objectContaining({
        type: "dynamic-tool",
        toolCallId: "call-pending",
        state: "input-available"
      })
    );
  });

  it("新一轮运行时仍能解释先前已结束的空回复，缺少思考时不编造思考事实", () => {
    const snapshot = reasoningOnlyThread();
    snapshot.messages.splice(-2, 1, { role: "assistant", content: "" });
    snapshot.messages.push(
      { role: "user", content: "再试一次" },
      { role: "assistant", content: "新的回复" }
    );
    snapshot.runtime = { status: "running", runId: "run-current" };
    const messages = toAgentUIMessages(snapshot);

    expect(messages[1]?.metadata?.terminal).toMatchObject({
      status: "failed",
      error: "历史记录未包含最终回复或有效工具调用"
    });
    expect(messages.at(-1)?.metadata?.terminal).toBeUndefined();
    expect(messages.filter((message) => message.metadata?.terminal)).toHaveLength(1);
  });

  it("持久化错误与已收到的实时错误只展示一张失败卡片", () => {
    const snapshot: ThreadSnapshot = {
      ...thread(),
      runtime: { status: "failed", runId: "run-1" },
      messages: [
        { role: "user", content: "分析歌曲" },
        { role: "inner", innerType: "error", content: "provider disconnected" }
      ]
    };
    const view = renderChatContent(thread(), {
      messages: [
        {
          id: "live-run-1",
          role: "assistant",
          parts: [],
          metadata: {
            runID: "run-1",
            terminal: {
              type: "terminal",
              status: "failed",
              runID: "run-1",
              id: "run-1-terminal",
              error: "provider disconnected"
            }
          }
        }
      ]
    });
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    view.rerender(<ChatContent {...chatContentProps(snapshot)} />);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("provider disconnected");
  });

  it("运行中的用户消息已进入 Rust 快照时不重复渲染 pending message", () => {
    const snapshot: ThreadSnapshot = {
      ...thread(),
      runtime: { status: "running", runId: "run-1" },
      messages: [{ role: "user", content: "介绍当前歌曲" }]
    };
    const view = renderChatContent(thread(), {
      running: true,
      runningRunID: "run-1",
      messages: [
        {
          id: "optimistic-user",
          role: "user",
          parts: [{ type: "text", text: "介绍当前歌曲" }]
        }
      ]
    });

    expect(screen.getAllByText("介绍当前歌曲")).toHaveLength(1);
    view.rerender(
      <ChatContent {...chatContentProps(snapshot, { running: true, runningRunID: "run-1" })} />
    );
    expect(screen.getAllByText("介绍当前歌曲")).toHaveLength(1);
  });

  it("展示流式思考内容，且不与正式回答混在一起", () => {
    renderChatContent(thread(), {
      running: true,
      runningRunID: "run-1",
      messages: [
        {
          id: "run-1-assistant",
          role: "assistant",
          parts: [
            { type: "step-start" },
            { type: "reasoning", text: "正在分析当前歌曲背景……", state: "streaming" }
          ],
          metadata: { runID: "run-1" }
        }
      ]
    });

    expect(screen.getByRole("button", { name: /正在思考/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByText("正在分析当前歌曲背景……")).toBeInTheDocument();
  });

  it("恢复后的消息保留已有文本前缀，新流片段仍在同一回复组展示", () => {
    const view = renderChatContent(thread(), {
      running: true,
      runningRunID: "run-1",
      messages: [
        {
          id: "restored-assistant",
          role: "assistant",
          metadata: { runID: "run-1" },
          parts: [
            { type: "step-start" },
            { type: "text", text: "已恢复的文本前缀。", state: "done" },
            { type: "text", text: "继续生成的内容。", state: "streaming" }
          ]
        }
      ]
    });
    expect(screen.getByText("已恢复的文本前缀。")).toBeInTheDocument();
    expect(screen.getByText("继续生成的内容。")).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: "Aira 的连续回复" })).toHaveLength(1);

    view.rerender(
      <ChatContent
        {...chatContentProps({
          ...thread(),
          messages: [{ role: "assistant", content: "已恢复的文本前缀。继续生成的内容。" }]
        })}
      />
    );
    expect(screen.getByText("已恢复的文本前缀。继续生成的内容。")).toBeInTheDocument();
    expect(screen.getAllByText(/已恢复的文本前缀/)).toHaveLength(1);
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
            requests: 2,
            last_step: 2,
            records: [
              { step: 1, usage: { prompt_tokens: 100, completion_tokens: 20 } },
              { step: 2, usage: { prompt_tokens: 120, completion_tokens: 10 } }
            ]
          })
        }
      ]
    });

    const usage = screen.getByLabelText("本轮模型用量");
    expect(usage).toHaveTextContent("上下文大小120");
    expect(usage).toHaveTextContent("本轮累计输入220");
    expect(usage).toHaveTextContent("本轮累计输出30");
    expect(usage).toHaveTextContent("模型请求2");
    expect(usage).not.toHaveTextContent("累计输入会重复计算每次发送的历史");
    fireEvent.focus(screen.getByLabelText("本轮用量说明"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("累计输入会重复计算每次发送的历史");
    expect(screen.getByRole("tooltip")).toHaveTextContent("最后一次请求的输入快照");
    expect(screen.getAllByLabelText("本轮模型用量")).toHaveLength(1);
  });

  it("末次请求缺用量时展示真实请求数、已知合计，并隐藏过期上下文", () => {
    renderChatContent({
      ...thread(),
      messages: [
        { role: "user", content: "继续分析" },
        { role: "assistant", content: "已生成的部分回复" },
        {
          role: "inner",
          innerType: "usage",
          content: JSON.stringify({
            requests: 2,
            last_step: 2,
            records: [{ step: 1, usage: { prompt_tokens: 100, completion_tokens: 20 } }]
          })
        }
      ]
    });
    const usage = screen.getByLabelText("本轮模型用量");
    expect(usage).toHaveTextContent("统计不完整");
    expect(usage).toHaveTextContent("末次请求未报告用量");
    expect(usage).toHaveTextContent("本轮已知累计输入100");
    expect(usage).toHaveTextContent("模型请求2（已报告 1）");
    expect(usage).not.toHaveTextContent("上下文大小");
  });

  it.each([0, 1])("没有用量报告时仍区分未发请求和缺少报告，实际请求=%s", (requests) => {
    renderChatContent({
      ...thread(),
      messages: [
        { role: "user", content: "分析歌曲" },
        { role: "assistant", content: "已有回复" },
        {
          role: "inner",
          innerType: "usage",
          content: JSON.stringify({ records: [], requests, ...(requests ? { last_step: 1 } : {}) })
        }
      ]
    });
    const usage = screen.getByLabelText("本轮模型用量");
    expect(usage).toHaveTextContent(`模型请求${requests}（已报告 0）`);
    expect(usage).toHaveTextContent(requests ? "末次请求未报告用量" : "本轮未发起聊天请求");
    expect(usage).not.toHaveTextContent("累计输入");
    expect(usage).not.toHaveTextContent("上下文大小");
  });

  it("把每轮多个 assistant step 归一成一个消息，并保留确定性的历史身份", () => {
    const snapshot: ThreadSnapshot = {
      ...thread(),
      runtime: { status: "running", runId: "run-latest" },
      messages: [
        { role: "user", content: "第一问" },
        { role: "assistant", content: "第一步" },
        { role: "assistant", content: "第一答" },
        { role: "user", content: "第二问" },
        { role: "assistant", content: "第二答" }
      ]
    };
    const messages = toAgentUIMessages(snapshot);
    expect(messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant"
    ]);
    expect(messages[1]?.parts.filter((part) => part.type === "step-start")).toHaveLength(2);
    expect(messages[1]?.metadata?.runID).toBeUndefined();
    expect(messages[3]?.metadata?.runID).toBe("run-latest");
    expect(toAgentUIMessages(snapshot).map((message) => message.id)).toEqual(
      messages.map((message) => message.id)
    );
  });

  it("按 call ID 匹配乱序工具结果，并完整保留字符串输出", () => {
    const firstOutput = '{"name":"群青"}';
    const secondOutput = '{"name":"夜に駆ける"}';
    const messages = toAgentUIMessages({
      ...thread(),
      messages: [
        { role: "user", content: "比较两首歌曲" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            { id: "call-first", name: "agent-tool-track-detail", args: { id: 1 } },
            { id: "call-second", name: "agent-tool-track-detail", args: { id: 2 } }
          ]
        },
        { role: "tool", content: secondOutput, toolCallId: "call-second" },
        { role: "tool", content: firstOutput, toolCallId: "call-first" }
      ]
    });
    expect(messages[1]?.parts.filter((part) => part.type === "dynamic-tool")).toEqual([
      expect.objectContaining({
        toolCallId: "call-first",
        state: "output-available",
        output: firstOutput
      }),
      expect.objectContaining({
        toolCallId: "call-second",
        state: "output-available",
        output: secondOutput
      })
    ]);
  });

  it("保留缺少对应调用的工具结果，不把它丢成空白消息", () => {
    const messages = toAgentUIMessages({
      ...thread(),
      messages: [{ role: "tool", content: "孤立工具结果", toolCallId: "orphan-call" }]
    });
    expect(messages[0]?.parts).toEqual([
      { type: "step-start" },
      {
        type: "dynamic-tool",
        toolName: "tool",
        toolCallId: "orphan-call",
        state: "output-available",
        input: undefined,
        output: "孤立工具结果"
      }
    ]);
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

const reasoningOnlyThread = (): ThreadSnapshot => ({
  ...thread(),
  messages: [
    { role: "user", content: "继续" },
    {
      role: "assistant",
      content: "",
      toolCalls: [{ id: "call-unknown", name: "search_snow_dance", args: {} }]
    },
    {
      role: "tool",
      toolCallId: "call-unknown",
      content: '{"error":"未知工具: search_snow_dance"}'
    },
    { role: "assistant", content: "", reasoningContent: "需要根据《雪之舞》的曲名继续确认。" },
    {
      role: "inner",
      innerType: "usage",
      content: JSON.stringify({
        records: [
          { step: 1, usage: { prompt_tokens: 100, completion_tokens: 20 } },
          { step: 2, usage: { prompt_tokens: 120, completion_tokens: 116 } }
        ]
      })
    }
  ]
});

const renderChatContent = (
  conversation: ThreadSnapshot,
  overrides: Partial<React.ComponentProps<typeof ChatContent>> = {}
) => render(<ChatContent {...chatContentProps(conversation, overrides)} />);

const chatContentProps = (
  conversation: ThreadSnapshot,
  overrides: Partial<React.ComponentProps<typeof ChatContent>> = {}
): React.ComponentProps<typeof ChatContent> => ({
  running: false,
  runningRunID: "",
  recovering: false,
  messages: toAgentUIMessages(conversation),
  onCreateConfig: () => undefined,
  onSubmitPrompt: async () => true,
  onCreateConversation: () => undefined,
  configured: true,
  hasConversation: true,
  ...overrides
});
