import { Chat } from "@ai-sdk/react";
import { it, expect, describe } from "vitest";
import { ReadableStream } from "node:stream/web";
import { readUIMessageStream, type UIMessageChunk } from "ai";
import { AgentChatAdapter } from "@mahiru/ui/wins/agent/lib/chat/adapter";
import type { AGUIEvent } from "@mahiru/agent/browser";
import type {
  AgentUIMessage,
  AgentRunTerminal,
  AgentAssistantTurnObservability
} from "@mahiru/ui/wins/agent/lib/chat/interface";

const event = (type: AGUIEvent["type"], fields: Record<string, unknown> = {}) =>
  ({ type, threadId: "thread-1", runId: "run-1", ...fields }) as AGUIEvent;

const readMessages = async (chunks: UIMessageChunk[]) => {
  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    }
  });
  const messages: AgentUIMessage[] = [];
  for await (const message of readUIMessageStream<AgentUIMessage>({
    stream: stream as globalThis.ReadableStream<UIMessageChunk>,
    terminateOnError: true
  }))
    messages.push(message);
  return messages;
};

const resumeMessage = async (message: AgentUIMessage, chunks: UIMessageChunk[]) => {
  const chat = new Chat<AgentUIMessage>({
    id: "thread-1",
    messages: [message],
    transport: {
      resumeStreamIsReplay: true,
      sendMessages: async () => {
        throw new Error("恢复不应重新提交消息");
      },
      reconnectToStream: async () =>
        new ReadableStream<UIMessageChunk>({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk);
            controller.close();
          }
        }) as globalThis.ReadableStream<UIMessageChunk>
    }
  });
  await chat.resumeStream();
  expect(chat.error).toBeUndefined();
  expect(chat.messages).toHaveLength(1);
  return chat.messages[0];
};

describe("AG-UI to AI SDK adapter", () => {
  it("交给真实 SDK 聚合多步骤思考、文本和动态工具，并保留参数与原始结果", async () => {
    const adapter = new AgentChatAdapter("run-1", "assistant-1");
    const events = [
      event("RUN_STARTED"),
      event("STEP_STARTED", { stepName: "turn1-step1" }),
      event("REASONING_MESSAGE_START", { messageId: "reasoning-1", role: "reasoning" }),
      event("REASONING_MESSAGE_CONTENT", { messageId: "reasoning-1", delta: "先查找" }),
      event("REASONING_MESSAGE_CONTENT", { messageId: "reasoning-1", delta: "歌曲" }),
      event("REASONING_MESSAGE_END", { messageId: "reasoning-1" }),
      event("TEXT_MESSAGE_START", { messageId: "text-1", role: "assistant" }),
      event("TEXT_MESSAGE_CONTENT", { messageId: "text-1", delta: "正在" }),
      event("TEXT_MESSAGE_CONTENT", { messageId: "text-1", delta: "搜索。" }),
      event("TEXT_MESSAGE_END", { messageId: "text-1" }),
      event("TOOL_CALL_START", { toolCallId: "call-1", toolCallName: "search" }),
      event("TOOL_CALL_ARGS", { toolCallId: "call-1", delta: '{"query":"周杰' }),
      event("TOOL_CALL_ARGS", { toolCallId: "call-1", delta: '伦"}' }),
      event("TOOL_CALL_END", { toolCallId: "call-1" }),
      event("TOOL_CALL_RESULT", { toolCallId: "call-1", content: '{"title":"晴天"}' }),
      event("STEP_FINISHED", { stepName: "turn1-step1" }),
      event("STEP_STARTED", { stepName: "turn1-step2" }),
      event("TEXT_MESSAGE_START", { messageId: "text-2", role: "assistant" }),
      event("TEXT_MESSAGE_CONTENT", { messageId: "text-2", delta: "找到了晴天。" }),
      event("TEXT_MESSAGE_END", { messageId: "text-2" }),
      event("STEP_FINISHED", { stepName: "turn1-step2" })
    ];
    const turns: AgentAssistantTurnObservability[] = [
      { step: 1, status: "complete", usage: { input: 10, output: 5 } },
      { step: 2, status: "complete", finishReason: "stop" }
    ];
    const messages = await readMessages([
      ...events.flatMap((value) => adapter.push(value)),
      ...adapter.finish(undefined, turns)
    ]);

    expect(messages.at(-1)).toMatchObject({
      id: "assistant-1",
      role: "assistant",
      metadata: { runID: "run-1", turns },
      parts: [
        { type: "step-start" },
        { type: "reasoning", text: "先查找歌曲", state: "done" },
        { type: "text", text: "正在搜索。", state: "done" },
        {
          type: "dynamic-tool",
          toolCallId: "call-1",
          toolName: "search",
          state: "output-available",
          input: { query: "周杰伦" },
          output: '{"title":"晴天"}'
        },
        { type: "step-start" },
        { type: "text", text: "找到了晴天。", state: "done" }
      ]
    });
    expect(messages.flatMap((message) => message.parts)).toContainEqual(
      expect.objectContaining({
        type: "dynamic-tool",
        state: "input-streaming",
        input: { query: "周杰" }
      })
    );
  });

  it("恢复时为缺少 start 的内容补齐 SDK 协议，并在结束时关闭残留内容", async () => {
    const adapter = new AgentChatAdapter("run-1");
    const messages = await readMessages([
      ...adapter.push(event("REASONING_MESSAGE_CONTENT", { messageId: "r-1", delta: "分析" })),
      ...adapter.push(event("TEXT_MESSAGE_CONTENT", { messageId: "t-1", delta: "你好" })),
      ...adapter.finish()
    ]);
    expect(messages.at(-1)).toMatchObject({
      id: "run-1",
      parts: [
        { type: "reasoning", text: "分析", state: "done" },
        { type: "text", text: "你好", state: "done" }
      ]
    });
    expect(adapter.finish()).toEqual([]);
    expect(
      adapter.push(event("TEXT_MESSAGE_CONTENT", { messageId: "t-1", delta: "迟到" }))
    ).toEqual([]);
  });

  it("损坏的参数成为工具错误，不终止读取后续正文或丢失终态元信息", async () => {
    const adapter = new AgentChatAdapter("run-1");
    const terminal: AgentRunTerminal = {
      type: "terminal",
      id: "terminal-1",
      runID: "run-1",
      status: "failed",
      error: "参数无效",
      usage: { input: 10, output: 6 }
    };
    const chunks = [
      ...adapter.push(event("TOOL_CALL_START", { toolCallId: "call-1", toolCallName: "play" })),
      ...adapter.push(event("TOOL_CALL_ARGS", { toolCallId: "call-1", delta: '{"id":' })),
      ...adapter.push(event("TOOL_CALL_END", { toolCallId: "call-1" })),
      ...adapter.push(event("RUN_ERROR", { message: "参数无效", usages: null })),
      ...adapter.push(event("TEXT_MESSAGE_CONTENT", { messageId: "t-1", delta: "请再试一次" })),
      ...adapter.push(event("RUN_FINISHED", { result: "失败", usages: [] })),
      ...adapter.finish(terminal)
    ];
    const messages = await readMessages(chunks);
    expect(chunks.some((chunk) => chunk.type === "error")).toBe(false);
    expect(messages.at(-1)).toMatchObject({
      metadata: { runID: "run-1", terminal },
      parts: [
        {
          type: "dynamic-tool",
          state: "output-error",
          input: '{"id":',
          errorText: "工具参数不是有效的 JSON"
        },
        { type: "text", text: "请再试一次", state: "done" }
      ]
    });
  });

  it("取消时结束未完成工具，拒绝其他 run 并只发一次消息开始", async () => {
    const adapter = new AgentChatAdapter("run-1");
    expect(adapter.push(event("RUN_STARTED", { runId: "previous-run" }))).toEqual([]);
    const chunks = adapter.push(event("RUN_STARTED"));
    expect(adapter.push(event("RUN_STARTED"))).toEqual([]);
    chunks.push(
      ...adapter.push(event("STEP_STARTED", { stepName: "turn1-step1" })),
      ...adapter.push(event("TOOL_CALL_START", { toolCallId: "call-1", toolCallName: "play" })),
      ...adapter.push(event("TOOL_CALL_ARGS", { toolCallId: "call-1", delta: '{"id":42}' })),
      ...adapter.push(event("TOOL_CALL_END", { toolCallId: "call-1" })),
      ...adapter.finish({
        type: "terminal",
        id: "terminal-1",
        status: "aborted"
      })
    );
    const messages = await readMessages(chunks);
    expect(messages.at(-1)?.parts).toContainEqual(
      expect.objectContaining({
        type: "dynamic-tool",
        state: "output-error",
        input: { id: 42 },
        errorText: "工具调用已取消"
      })
    );
    expect(chunks.at(-1)).toMatchObject({ type: "finish", finishReason: "interrupted" });
  });

  it("冷恢复重放已完成前缀，再接收新步骤，真实 SDK 不丢内容或重复消息", async () => {
    const adapter = new AgentChatAdapter("run-1", "assistant-1");
    const prefix: AgentUIMessage = {
      id: "assistant-1",
      role: "assistant",
      metadata: {
        runID: "run-1",
        turns: [{ step: 1, status: "complete", usage: { input: 10, output: 5 } }]
      },
      parts: [
        { type: "step-start" },
        { type: "reasoning", text: "先检索歌曲", state: "done" },
        { type: "text", text: "正在搜索。", state: "done" },
        {
          type: "dynamic-tool",
          toolCallId: "search-1",
          toolName: "search",
          state: "output-available",
          input: { query: "晴天" },
          output: "已有搜索结果"
        }
      ]
    };
    const chunks = adapter.replay(prefix);
    expect(adapter.replay(prefix)).toEqual([]);
    chunks.push(
      ...adapter.push(event("STEP_STARTED", { stepName: "turn1-step2" })),
      ...adapter.push(event("TEXT_MESSAGE_CONTENT", { messageId: "live-2", delta: "找到了。" })),
      ...adapter.finish()
    );
    const message = await resumeMessage(prefix, chunks);

    expect(chunks.filter((chunk) => chunk.type === "start")).toHaveLength(1);
    expect(message).toMatchObject({
      id: prefix.id,
      metadata: prefix.metadata,
      parts: [
        { type: "step-start" },
        { type: "reasoning", text: "先检索歌曲", state: "done" },
        { type: "text", text: "正在搜索。", state: "done" },
        { type: "dynamic-tool", state: "output-available", output: "已有搜索结果" },
        { type: "step-start" },
        { type: "text", text: "找到了。", state: "done" }
      ]
    });
  });

  it.each(["input-streaming", "input-available"] as const)(
    "重放 %s 工具后沿用原 callID 和参数，完成后不再标记未完成",
    async (state) => {
      const adapter = new AgentChatAdapter("run-1", "assistant-1");
      const prefix: AgentUIMessage = {
        id: "assistant-1",
        role: "assistant",
        parts: [
          { type: "step-start" },
          { type: "text", text: "先查歌曲。", state: "done" },
          state === "input-streaming"
            ? {
                type: "dynamic-tool",
                toolCallId: "search-1",
                toolName: "search",
                state,
                input: { query: "周杰" },
                rawInput: '{"query":"周杰'
              }
            : {
                type: "dynamic-tool",
                toolCallId: "search-1",
                toolName: "search",
                state,
                input: { query: "周杰伦" }
              }
        ]
      };
      const chunks = adapter.replay(prefix);
      if (state === "input-streaming") {
        chunks.push(
          ...adapter.push(event("TOOL_CALL_ARGS", { toolCallId: "search-1", delta: '伦"}' })),
          ...adapter.push(event("TOOL_CALL_END", { toolCallId: "search-1" }))
        );
      }
      chunks.push(
        ...adapter.push(event("TOOL_CALL_RESULT", { toolCallId: "search-1", content: "搜索成功" })),
        ...adapter.finish()
      );
      const message = await resumeMessage(prefix, chunks);

      expect(message?.parts).toMatchObject([
        { type: "step-start" },
        { type: "text", text: "先查歌曲。", state: "done" },
        {
          type: "dynamic-tool",
          toolCallId: "search-1",
          toolName: "search",
          input: { query: "周杰伦" },
          state: "output-available",
          output: "搜索成功"
        }
      ]);
      expect(chunks.some((chunk) => chunk.type === "tool-output-error")).toBe(false);
    }
  );
});
