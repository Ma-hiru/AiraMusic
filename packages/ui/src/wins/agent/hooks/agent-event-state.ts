import type { AgentConversationState } from "@/wins/agent/atoms/agent";
import type {
  AgentToolCall,
  AgentRunTerminal,
  AgentLiveToolResult,
  AgentLiveTimelineItem
} from "@/wins/agent/page/types";
import type { AgentConversationEvent } from "./agui-adapter";

import { toTerminalError } from "../page/chat/observability";

export const reduceAgentConversationEvent = (
  state: AgentConversationState,
  event: AgentConversationEvent
): AgentConversationState => {
  if (!shouldApplyAgentConversationEvent(state, event)) return state;

  switch (event.type) {
    case "started":
      return {
        ...state,
        sending: false,
        recovering: false,
        latestRunID: event.runID,
        runningRunID: event.runID
      };
    case "text_delta":
      return {
        ...state,
        recovering: false,
        streamText: state.streamText + event.text
      };
    case "reasoning_started":
      return reduceReasoningStarted(state, event);
    case "reasoning_delta":
      return reduceReasoningDelta(state, event);
    case "reasoning_finished":
      return reduceReasoningFinished(state, event);
    case "tool_call":
      return reduceToolCall(state, event);
    case "tool_result":
      return reduceToolResult(state, event);
    case "finished":
      return {
        ...state,
        sending: false,
        streamText: "",
        recovering: false,
        latestRunID: event.runID,
        runningRunID: "",
        liveTimeline: [],
        conversation: event.snapshot,
        pendingUserMessage: ""
      };
    case "cancelled":
      return reduceTerminal(
        state,
        {
          type: "terminal",
          status: "aborted",
          runID: event.runID,
          id: `${event.runID}-terminal`
        },
        event.snapshot
      );
    case "failed":
      return reduceTerminal(
        state,
        {
          type: "terminal",
          status: "failed",
          runID: event.runID,
          id: `${event.runID}-terminal`,
          ...(event.usage ? { usage: event.usage } : {}),
          error: toTerminalError(event.message)
        },
        event.snapshot
      );
  }
};

const reasoningItemID = (runID: string, messageID: string) => `${runID}-${messageID}-reasoning`;

const reduceReasoningStarted = (
  state: AgentConversationState,
  event: Extract<AgentConversationEvent, { type: "reasoning_started" }>
): AgentConversationState => ({
  ...state,
  recovering: false,
  liveTimeline: upsertTimelineItem(state.liveTimeline, {
    id: reasoningItemID(event.runID, event.messageID),
    type: "reasoning",
    status: "streaming",
    text: "",
    step: event.step,
    runID: event.runID,
    messageID: event.messageID
  })
});

const reduceReasoningDelta = (
  state: AgentConversationState,
  event: Extract<AgentConversationEvent, { type: "reasoning_delta" }>
): AgentConversationState => {
  const id = reasoningItemID(event.runID, event.messageID);
  const current = state.liveTimeline.find((item) => item.type === "reasoning" && item.id === id);
  if (!current || current.type !== "reasoning") return state;

  return {
    ...state,
    recovering: false,
    liveTimeline: upsertTimelineItem(state.liveTimeline, {
      ...current,
      text: current.text + event.text
    })
  };
};

const reduceReasoningFinished = (
  state: AgentConversationState,
  event: Extract<AgentConversationEvent, { type: "reasoning_finished" }>
): AgentConversationState => {
  const id = reasoningItemID(event.runID, event.messageID);
  const current = state.liveTimeline.find((item) => item.type === "reasoning" && item.id === id);
  if (!current || current.type !== "reasoning") return state;

  return {
    ...state,
    recovering: false,
    liveTimeline: current.text.trim()
      ? upsertTimelineItem(state.liveTimeline, { ...current, status: "done" })
      : state.liveTimeline.filter((item) => item.id !== id)
  };
};

const shouldApplyAgentConversationEvent = (
  state: AgentConversationState,
  event: AgentConversationEvent
) => {
  const latestRunID =
    state.runningRunID || state.latestRunID || state.conversation?.runtime.runId || "";

  if (event.type === "started") {
    if (state.runningRunID && state.runningRunID !== event.runID) return false;
    if (state.sending || state.recovering) return true;
    return !latestRunID || latestRunID === event.runID;
  }

  // 新消息已经提交但尚未拿到 runID 时，只可能收到上一轮迟到事件。
  if (state.sending && !state.runningRunID) return false;
  return !latestRunID || latestRunID === event.runID;
};

const reduceToolCall = (
  state: AgentConversationState,
  event: Extract<AgentConversationEvent, { type: "tool_call" }>
): AgentConversationState => {
  const assistantText = state.streamText;
  let liveTimeline = state.liveTimeline;

  if (assistantText.trim()) {
    liveTimeline = upsertTimelineItem(liveTimeline, {
      type: "assistant",
      text: assistantText,
      runID: event.runID,
      id: `${event.runID}-${event.step}-assistant`
    });
  }

  const toolItemID = `${event.runID}-${event.step}-tool`;
  const currentTool = liveTimeline.find((item) => item.type === "tool" && item.id === toolItemID);
  liveTimeline = upsertTimelineItem(liveTimeline, {
    type: "tool",
    step: event.step,
    runID: event.runID,
    id: toolItemID,
    status: currentTool?.type === "tool" ? currentTool.status : "running",
    assistantTurn: {
      step: event.step,
      runID: event.runID,
      status: "complete"
    },
    toolCalls: mergeToolCalls(
      currentTool?.type === "tool" ? currentTool.toolCalls : [],
      event.toolCalls
    ),
    ...(currentTool?.type === "tool" && currentTool.toolResults
      ? { toolResults: currentTool.toolResults }
      : {})
  });

  return {
    ...state,
    streamText: "",
    recovering: false,
    liveTimeline
  };
};

const reduceToolResult = (
  state: AgentConversationState,
  event: Extract<AgentConversationEvent, { type: "tool_result" }>
): AgentConversationState => {
  const id = `${event.runID}-${event.step}-tool`;
  const current = state.liveTimeline.find((item) => item.type === "tool" && item.id === id);
  const liveTimeline = upsertTimelineItem(state.liveTimeline, {
    id,
    type: "tool",
    step: event.step,
    runID: event.runID,
    status: "done",
    toolResults: mergeToolResults(
      current?.type === "tool" ? current.toolResults : [],
      event.toolResults
    ),
    toolCalls: current?.type === "tool" ? current.toolCalls : [],
    ...(current?.type === "tool" && current.assistantTurn
      ? { assistantTurn: current.assistantTurn }
      : {})
  });

  return {
    ...state,
    recovering: false,
    liveTimeline
  };
};

const reduceTerminal = (
  state: AgentConversationState,
  terminal: AgentRunTerminal,
  snapshot?: AgentConversationState["conversation"]
): AgentConversationState => {
  if (snapshot) {
    return {
      ...state,
      sending: false,
      streamText: "",
      recovering: false,
      latestRunID: terminal.runID ?? state.latestRunID,
      runningRunID: "",
      liveTimeline: upsertTimelineItem([], terminal),
      conversation: snapshot,
      pendingUserMessage: ""
    };
  }

  let liveTimeline = state.liveTimeline.map((item) =>
    item.type === "tool" && item.status === "running"
      ? {
          ...item,
          status: "error" as const
        }
      : item
  );

  if (state.streamText.trim()) {
    liveTimeline = upsertTimelineItem(liveTimeline, {
      type: "assistant",
      text: state.streamText,
      ...(terminal.runID ? { runID: terminal.runID } : {}),
      id: `${terminal.runID ?? "run"}-terminal-assistant`
    });
  }
  liveTimeline = upsertTimelineItem(liveTimeline, terminal);

  return {
    ...state,
    sending: false,
    streamText: "",
    recovering: false,
    latestRunID: terminal.runID ?? state.latestRunID,
    runningRunID: "",
    pendingUserMessage: "",
    liveTimeline
  };
};

const mergeToolCalls = (current: AgentToolCall[], incoming: AgentToolCall[]) => {
  const calls = new Map(current.map((call) => [call.callID, call]));
  for (const call of incoming) calls.set(call.callID, call);
  return [...calls.values()];
};

const mergeToolResults = (
  current: AgentLiveToolResult[] | undefined,
  incoming: AgentLiveToolResult[]
) => {
  const merged = new Map(current?.map((result) => [result.callID, result]) ?? []);
  for (const result of incoming) merged.set(result.callID, result);
  return [...merged.values()];
};

const upsertTimelineItem = (timeline: AgentLiveTimelineItem[], item: AgentLiveTimelineItem) => {
  const index = timeline.findIndex((candidate) => candidate.id === item.id);
  if (index < 0) return [...timeline, item];
  const next = [...timeline];
  next[index] = item;
  return next;
};
