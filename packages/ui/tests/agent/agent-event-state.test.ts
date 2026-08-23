import { it, expect, describe } from "vitest";
import { createAgentConversationState } from "@mahiru/ui/wins/agent/atoms/agent";
import { reduceAgentConversationEvent } from "@mahiru/ui/wins/agent/hooks/agent-event-state";
import type { AgentConversationEvent } from "@mahiru/ui/wins/agent/hooks/agui-adapter";

const event = (value: Record<string, unknown>) => value as unknown as AgentConversationEvent;

describe("Agent 对话事件状态", () => {
  it("把独立思考增量累计在同一个时间线项中", () => {
    let state = reduceAgentConversationEvent(
      createAgentConversationState(),
      event({
        type: "started",
        runID: "run-1",
        conversationID: "thread-1"
      })
    );

    state = reduceAgentConversationEvent(
      state,
      event({
        type: "reasoning_started",
        step: 1,
        runID: "run-1",
        messageID: "reasoning-1",
        conversationID: "thread-1"
      })
    );
    state = reduceAgentConversationEvent(
      state,
      event({
        type: "reasoning_delta",
        step: 1,
        text: "先分析",
        runID: "run-1",
        messageID: "reasoning-1",
        conversationID: "thread-1"
      })
    );
    state = reduceAgentConversationEvent(
      state,
      event({
        type: "reasoning_delta",
        step: 1,
        text: "当前歌曲",
        runID: "run-1",
        messageID: "reasoning-1",
        conversationID: "thread-1"
      })
    );

    expect(state.liveTimeline).toEqual([
      {
        id: "run-1-reasoning-1-reasoning",
        type: "reasoning",
        step: 1,
        runID: "run-1",
        messageID: "reasoning-1",
        text: "先分析当前歌曲",
        status: "streaming"
      }
    ]);

    state = reduceAgentConversationEvent(
      state,
      event({
        type: "reasoning_finished",
        step: 1,
        runID: "run-1",
        messageID: "reasoning-1",
        conversationID: "thread-1"
      })
    );

    expect(state.liveTimeline[0]).toMatchObject({
      text: "先分析当前歌曲",
      status: "done"
    });
  });

  it("同步失败快照时仍保留 RUN_ERROR 的 usage", () => {
    const state = reduceAgentConversationEvent(
      {
        ...createAgentConversationState(),
        latestRunID: "run-1",
        runningRunID: "run-1"
      },
      event({
        type: "failed",
        runID: "run-1",
        conversationID: "thread-1",
        message: "provider disconnected",
        usage: { input: 100, output: 20, total: 120, requests: 1, lastInput: 100 },
        snapshot: {
          id: "thread-1",
          name: "测试会话",
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          runtime: { status: "failed", runId: "run-1" }
        }
      })
    );

    expect(state.conversation?.runtime.status).toBe("failed");
    expect(state.liveTimeline).toEqual([
      expect.objectContaining({
        type: "terminal",
        status: "failed",
        runID: "run-1",
        usage: { input: 100, output: 20, total: 120, requests: 1, lastInput: 100 }
      })
    ]);
  });

  it("保留同一步中已经返回的多个工具结果", () => {
    let state = reduceAgentConversationEvent(
      createAgentConversationState(),
      event({
        type: "tool_call",
        step: 2,
        runID: "run-1",
        conversationID: "thread-1",
        toolCalls: [
          { name: "agent-search", callID: "call-1", arguments: '{"query":"Aira"}' },
          { name: "agent-track", callID: "call-2", arguments: '{"id":42}' }
        ]
      })
    );

    state = reduceAgentConversationEvent(
      state,
      event({
        type: "tool_result",
        step: 2,
        runID: "run-1",
        conversationID: "thread-1",
        toolResults: [{ name: "agent-search", callID: "call-1", output: "search result" }]
      })
    );
    state = reduceAgentConversationEvent(
      state,
      event({
        type: "tool_result",
        step: 2,
        runID: "run-1",
        conversationID: "thread-1",
        toolResults: [{ name: "agent-track", callID: "call-2", output: "track result" }]
      })
    );

    expect(state.liveTimeline[0]).toMatchObject({
      type: "tool",
      status: "done",
      toolResults: [
        { name: "agent-search", callID: "call-1", output: "search result" },
        { name: "agent-track", callID: "call-2", output: "track result" }
      ]
    });
  });
});
