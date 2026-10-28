import { readStoredRunFailure } from "@/wins/agent/page/chat/observability";
import type { ThreadSnapshot } from "@mahiru/agent/browser";
import type { AgentConversationState } from "@/wins/agent/atoms/agent";

export const recoverAgentConversationState = (
  state: AgentConversationState,
  snapshot: ThreadSnapshot
): AgentConversationState => {
  // 提交请求可能尚未创建服务端 run，不能把这个窗口内的发送态当作已结束。
  if (state.sending && !state.runningRunID) return state;
  const runningRunID = snapshot.runtime.status === "running" ? (snapshot.runtime.runId ?? "") : "";
  const failure = readStoredRunFailure(snapshot);
  return {
    ...state,
    sending: false,
    recovering: !!runningRunID,
    streamText: "",
    latestRunID: snapshot.runtime.runId ?? state.latestRunID,
    runningRunID,
    liveTimeline: failure ? [failure] : [],
    conversation: snapshot,
    pendingUserMessage: runningRunID ? state.pendingUserMessage : ""
  };
};
