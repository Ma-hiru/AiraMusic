import type { LLMToolCall, AIAgentEvent } from "@mahiru/ai";
import type { AgentConversationState } from "@/wins/agent/atoms/agent";
import type { AgentRunTerminal, AgentLiveTimelineItem } from "@/wins/agent/page/types";

import { readTokenUsage, toTerminalError } from "../page/chat/observability";

export const reduceAgentConversationEvent = (
  state: AgentConversationState,
  event: AIAgentEvent
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
    case "title":
      return {
        ...state,
        conversation: state.conversation
          ? {
              ...state.conversation,
              name: event.title
            }
          : state.conversation
      };
    case "text_delta":
      return {
        ...state,
        recovering: false,
        streamText: state.streamText + event.text
      };
    case "tool_call":
      return reduceToolCall(state, event);
    case "tool_result":
      return reduceToolResult(state, event);
    case "done":
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
    case "aborted":
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
    case "error":
      return reduceTerminal(
        state,
        {
          type: "terminal",
          status: event.error.type === "max_steps" ? "max_steps" : "failed",
          runID: event.runID,
          id: `${event.runID}-terminal`,
          error: toTerminalError(event.error)
        },
        event.snapshot
      );
  }
};

const shouldApplyAgentConversationEvent = (state: AgentConversationState, event: AIAgentEvent) => {
  const latestRunID =
    state.runningRunID || state.latestRunID || state.conversation?.runtime?.runID || "";

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
  event: Extract<AIAgentEvent, { type: "tool_call" }>
): AgentConversationState => {
  const eventText = event.text?.trim();
  const currentText = state.streamText;
  const assistantText =
    eventText && (!currentText || eventText.startsWith(currentText)) ? event.text! : currentText;
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
  const usage = readTokenUsage(event.usage);
  liveTimeline = upsertTimelineItem(liveTimeline, {
    type: "tool",
    step: event.step,
    runID: event.runID,
    id: toolItemID,
    status: currentTool?.type === "tool" ? currentTool.status : "running",
    assistantTurn: {
      step: event.step,
      runID: event.runID,
      status: "complete",
      finishReason: event.finishReason,
      ...(usage ? { usage } : {})
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
  event: Extract<AIAgentEvent, { type: "tool_result" }>
): AgentConversationState => {
  const id = `${event.runID}-${event.step}-tool`;
  const current = state.liveTimeline.find((item) => item.type === "tool" && item.id === id);
  const liveTimeline = upsertTimelineItem(state.liveTimeline, {
    id,
    type: "tool",
    step: event.step,
    runID: event.runID,
    status: "done",
    toolResults: event.toolResults,
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
      liveTimeline: [],
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

const mergeToolCalls = (current: LLMToolCall[], incoming: LLMToolCall[]) => {
  const calls = new Map(current.map((call) => [call.callID, call]));
  for (const call of incoming) calls.set(call.callID, call);
  return [...calls.values()];
};

const upsertTimelineItem = (timeline: AgentLiveTimelineItem[], item: AgentLiveTimelineItem) => {
  const index = timeline.findIndex((candidate) => candidate.id === item.id);
  if (index < 0) return [...timeline, item];
  const next = [...timeline];
  next[index] = item;
  return next;
};
