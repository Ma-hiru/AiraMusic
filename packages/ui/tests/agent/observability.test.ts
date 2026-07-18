import { it, expect, describe } from "vitest";
import { reduceAgentConversationEvent } from "@mahiru/ui/wins/agent/hooks/agent-event-state";
import {
  readRunTerminal,
  formatTokenCount,
  readAssistantTurn,
  readAgentEventReplay,
  getUncachedInputTokens,
  readAgentEventEnvelope,
  readPersistedAssistantSteps
} from "@mahiru/ui/wins/agent/page/chat/observability";
import type { LLMMessage, AIAgentEvent } from "@mahiru/ai";
import type { AgentConversationState } from "@mahiru/ui/wins/agent/atoms/agent";

describe("Agent observability", () => {
  it("associates assistant usage by message index and only uses message usage as fallback", () => {
    const message = {
      role: "assistant",
      content: "done",
      usage: {
        inputTokens: 99,
        outputTokens: 8,
        cacheWrite: 3
      }
    } as unknown as LLMMessage;
    const snapshot = {
      assistantTurns: [
        {
          runID: "run-observed",
          step: 4,
          messageIndex: 2,
          status: "complete",
          finishReason: "stop",
          usage: {
            input: 12,
            total: 20,
            cachedInput: 5,
            reasoning: 2
          }
        }
      ]
    };

    expect(readAssistantTurn(snapshot, 1, message)).toMatchObject({
      status: "complete",
      usage: { input: 99, output: 8, total: 107, cacheWrite: 3 }
    });
    expect(readAssistantTurn(snapshot, 2, message)).toEqual({
      step: 4,
      runID: "run-observed",
      status: "complete",
      finishReason: "stop",
      usage: {
        input: 12,
        output: 8,
        total: 20,
        cachedInput: 5,
        cacheWrite: 3,
        reasoning: 2
      }
    });
    expect(formatTokenCount(999)).toBe("999");
    expect(formatTokenCount(1_250)).toBe("1.3K");
    expect(getUncachedInputTokens({ input: 12, cachedInput: 5 })).toBe(7);
    expect(getUncachedInputTokens({ input: 12 })).toBeUndefined();
    expect(getUncachedInputTokens({ input: 4, cachedInput: 8 })).toBe(0);
  });

  it("normalizes persisted terminal states and incomplete legacy finish reasons", () => {
    expect(
      readRunTerminal({
        runtime: {
          status: "failed",
          runID: "run-1",
          startedAt: 100,
          endedAt: 1_100,
          usage: { input: 12, output: 3, total: 15, cachedInput: 4 },
          error: { type: "provider_error", message: "upstream failed" }
        }
      })
    ).toEqual({
      id: "run-1-terminal",
      type: "terminal",
      runID: "run-1",
      status: "failed",
      startedAt: 100,
      endedAt: 1_100,
      usage: { input: 12, output: 3, total: 15, cachedInput: 4 },
      error: "provider_error: upstream failed"
    });
    expect(
      readRunTerminal({
        assistantTurns: [
          {
            runID: "run-legacy",
            messageIndex: 4,
            status: "incomplete",
            finishReason: "max-steps"
          }
        ]
      })
    ).toMatchObject({ id: "run-legacy-terminal", runID: "run-legacy", status: "max_steps" });
  });

  it("sorts, bounds and deduplicates replay events by sequence", () => {
    const eventReplay = Array.from({ length: 140 }, (_, sequence) => ({
      sequence,
      event: createTextEvent(sequence, String(sequence))
    })).reverse();
    eventReplay.push({ sequence: 139, event: createTextEvent(139, "replacement") });

    const replay = readAgentEventReplay({ eventReplay });
    expect(replay).toHaveLength(128);
    expect(replay[0]?.sequence).toBe(12);
    expect(replay.at(-1)).toMatchObject({
      sequence: 139,
      event: { text: "replacement" }
    });

    expect(readAgentEventEnvelope(createTextEvent(1, "live"))?.sequence).toBeUndefined();
    expect(
      readAgentEventEnvelope({ sequence: 7, event: createTextEvent(1, "replayed") })
    ).toMatchObject({ sequence: 7, event: { text: "replayed" } });
    expect([
      ...readPersistedAssistantSteps(
        {
          assistantTurns: [
            { runID: "run-1", step: 1, status: "complete" },
            { runID: "run-1", step: 2, status: "incomplete" },
            { runID: "run-2", step: 3, status: "complete" }
          ]
        },
        "run-1"
      )
    ]).toEqual([1]);
  });

  it("keeps replayed tool steps idempotent and turns errors into timeline cards", () => {
    const state = createState({ streamText: "先搜索" });
    const toolCall = {
      step: 1,
      runID: "run-1",
      type: "tool_call",
      text: "先搜索",
      usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
      finishReason: "tool_calls",
      conversationID: "conversation-1",
      toolCalls: [
        {
          name: "search",
          callID: "call-1",
          arguments: '{"query":"AiraMusic"}'
        }
      ]
    } satisfies AIAgentEvent;

    const called = reduceAgentConversationEvent(state, toolCall);
    const replayed = reduceAgentConversationEvent(called, toolCall);
    expect(replayed.liveTimeline).toHaveLength(2);
    expect(replayed.liveTimeline[0]).toMatchObject({
      type: "assistant",
      runID: "run-1"
    });
    expect(replayed.liveTimeline[1]).toMatchObject({
      type: "tool",
      runID: "run-1",
      status: "running",
      assistantTurn: {
        step: 1,
        runID: "run-1",
        status: "complete",
        finishReason: "tool_calls",
        usage: { input: 10, output: 2, total: 12 }
      },
      toolCalls: [{ callID: "call-1" }]
    });

    const failed = reduceAgentConversationEvent(replayed, {
      type: "error",
      runID: "run-1",
      conversationID: "conversation-1",
      error: { type: "service", message: "request failed" }
    } as AIAgentEvent);
    expect(failed.runningRunID).toBe("");
    expect(failed.liveTimeline).toHaveLength(3);
    expect(failed.liveTimeline[1]).toMatchObject({ type: "tool", status: "error" });
    expect(failed.liveTimeline[2]).toMatchObject({
      type: "terminal",
      status: "failed",
      error: "service: request failed"
    });
  });
});

const createTextEvent = (step: number, text: string) =>
  ({
    step,
    text,
    runID: "run-1",
    type: "text_delta",
    conversationID: "conversation-1"
  }) satisfies AIAgentEvent;

const createState = (override: Partial<AgentConversationState> = {}): AgentConversationState => ({
  sending: false,
  streamText: "",
  recovering: false,
  runningRunID: "run-1",
  conversation: null,
  liveTimeline: [],
  pendingUserMessage: "",
  ...override
});
