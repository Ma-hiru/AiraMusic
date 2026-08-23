import { describe, expect, it } from "vitest";
import type { AGUIEvent } from "@mahiru/agent/browser";

import { AgentAguiAdapter } from "@mahiru/ui/wins/agent/hooks/agui-adapter";

const agui = (value: Record<string, unknown>) => value as AGUIEvent;

describe("AG-UI renderer adapter", () => {
  it("保留 Rust thread/run 身份并把增量文本交给现有会话状态机", () => {
    const adapter = new AgentAguiAdapter();

    expect(
      adapter.push(agui({ type: "RUN_STARTED", threadId: "thread-1", runId: "run-1" }))
    ).toEqual([
      {
        type: "started",
        runID: "run-1",
        conversationID: "thread-1"
      }
    ]);
    adapter.push(
      agui({
        type: "STEP_STARTED",
        threadId: "thread-1",
        runId: "run-1",
        stepName: "turn1-step2"
      })
    );
    expect(
      adapter.push(
        agui({
          type: "TEXT_MESSAGE_CONTENT",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          delta: "hello"
        })
      )
    ).toEqual([
      {
        type: "text_delta",
        step: 2,
        text: "hello",
        runID: "run-1",
        conversationID: "thread-1"
      }
    ]);
  });

  it("把 AG-UI tool call 与 result 合并到同一个步骤身份", () => {
    const adapter = new AgentAguiAdapter();
    adapter.push(
      agui({
        type: "STEP_STARTED",
        threadId: "thread-1",
        runId: "run-1",
        stepName: "turn1-step3"
      })
    );
    adapter.push(
      agui({
        type: "TOOL_CALL_START",
        threadId: "thread-1",
        runId: "run-1",
        toolCallId: "call-1",
        toolCallName: "agent-search"
      })
    );
    adapter.push(
      agui({
        type: "TOOL_CALL_ARGS",
        threadId: "thread-1",
        runId: "run-1",
        toolCallId: "call-1",
        delta: '{"query":"Ai'
      })
    );
    adapter.push(
      agui({
        type: "TOOL_CALL_ARGS",
        threadId: "thread-1",
        runId: "run-1",
        toolCallId: "call-1",
        delta: 'ra"}'
      })
    );

    expect(
      adapter.push(
        agui({
          type: "TOOL_CALL_END",
          threadId: "thread-1",
          runId: "run-1",
          toolCallId: "call-1"
        })
      )
    ).toEqual([
      {
        type: "tool_call",
        step: 3,
        runID: "run-1",
        conversationID: "thread-1",
        toolCalls: [
          {
            name: "agent-search",
            callID: "call-1",
            arguments: '{"query":"Aira"}'
          }
        ]
      }
    ]);
    expect(
      adapter.push(
        agui({
          type: "TOOL_CALL_RESULT",
          threadId: "thread-1",
          runId: "run-1",
          toolCallId: "call-1",
          content: "result"
        })
      )
    ).toEqual([
      {
        type: "tool_result",
        step: 3,
        runID: "run-1",
        conversationID: "thread-1",
        toolResults: [{ name: "agent-search", callID: "call-1", output: "result" }]
      }
    ]);
  });

  it("保留独立的 AG-UI 思考流并关联消息身份", () => {
    const adapter = new AgentAguiAdapter();
    adapter.push(
      agui({
        type: "STEP_STARTED",
        threadId: "thread-1",
        runId: "run-1",
        stepName: "turn1-step2"
      })
    );

    expect(
      adapter.push(
        agui({
          type: "REASONING_MESSAGE_START",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "reasoning-1",
          role: "reasoning"
        })
      )
    ).toEqual([
      {
        type: "reasoning_started",
        step: 2,
        runID: "run-1",
        messageID: "reasoning-1",
        conversationID: "thread-1"
      }
    ]);
    expect(
      adapter.push(
        agui({
          type: "REASONING_MESSAGE_CONTENT",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "reasoning-1",
          delta: "先分析当前歌曲"
        })
      )
    ).toEqual([
      {
        type: "reasoning_delta",
        step: 2,
        text: "先分析当前歌曲",
        runID: "run-1",
        messageID: "reasoning-1",
        conversationID: "thread-1"
      }
    ]);
    expect(
      adapter.push(
        agui({
          type: "REASONING_MESSAGE_END",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "reasoning-1"
        })
      )
    ).toEqual([
      {
        type: "reasoning_finished",
        step: 2,
        runID: "run-1",
        messageID: "reasoning-1",
        conversationID: "thread-1"
      }
    ]);
  });
});
