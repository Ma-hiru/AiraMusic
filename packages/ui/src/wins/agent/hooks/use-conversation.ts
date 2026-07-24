import { useMemo, useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { Log } from "@/common/lib/log";
import { RendererAgent } from "@/wins/agent/lib/agent";
import {
  EMPTY_LIVE_TIMELINE,
  agentSelectedConfigIDAtom,
  agentUpdateConversationStateAtom,
  createAgentConversationStateAtom
} from "@/wins/agent/atoms/agent";
import AppToast from "@/common/components/display/toast";
import type { LLMConversationSnapshot } from "@mahiru/ai";
import type { AgentInvokeError } from "@mahiru/ipc/src/types/agent";

export type AgentRetryCandidate = {
  text: string;
  runID: string;
};

const submitTokens = new Map<string, symbol>();

const acquireSubmitToken = (conversationID: string) => {
  if (submitTokens.has(conversationID)) return null;
  const token = Symbol(conversationID);
  submitTokens.set(conversationID, token);
  return token;
};

const ownsSubmitToken = (conversationID: string, token: symbol) =>
  submitTokens.get(conversationID) === token;

const releaseSubmitToken = (conversationID: string, token: symbol) => {
  if (ownsSubmitToken(conversationID, token)) submitTokens.delete(conversationID);
};

export function useConversation(conversationID: string) {
  const conversationStateAtom = useMemo(
    () => createAgentConversationStateAtom(conversationID),
    [conversationID]
  );
  const state = useAtomValue(conversationStateAtom);
  const selectedConfigID = useAtomValue(agentSelectedConfigIDAtom);
  const updateConversationState = useSetAtom(agentUpdateConversationStateAtom);

  const send = useCallback(
    async (text: string, retryAbortedRunID?: string) => {
      const input = text.trim();
      if (
        !input ||
        !selectedConfigID ||
        !conversationID ||
        state.sending ||
        state.runningRunID ||
        state.recovering
      ) {
        return false;
      }

      // React 状态提交到下一次渲染前仍是旧值，因此用同步锁挡住双击和快速双 Enter。
      const submitToken = acquireSubmitToken(conversationID);
      if (!submitToken) return false;

      let submissionAccepted = false;
      updateConversationState({
        conversationID,
        update: (state) => {
          if (state.sending || state.runningRunID || state.recovering) return state;
          submissionAccepted = true;
          return {
            ...state,
            sending: true,
            streamText: "",
            recovering: false,
            liveTimeline: EMPTY_LIVE_TIMELINE,
            pendingUserMessage: input
          };
        }
      });
      if (!submissionAccepted) {
        releaseSubmitToken(conversationID, submitToken);
        return false;
      }

      try {
        const result = await RendererAgent.chat({
          input,
          configID: selectedConfigID,
          conversationID,
          ...(retryAbortedRunID ? { retryAbortedRunID } : {})
        });
        if (!result.ok) {
          let shouldNotify = false;
          updateConversationState({
            conversationID,
            update: (state) => {
              if (
                !ownsSubmitToken(conversationID, submitToken) ||
                state.runningRunID ||
                !state.sending ||
                state.pendingUserMessage !== input
              ) {
                return state;
              }
              shouldNotify = true;
              return {
                ...state,
                sending: false,
                pendingUserMessage: ""
              };
            }
          });
          if (shouldNotify) showAgentError(result.reason);
          return false;
        }
        updateConversationState({
          conversationID,
          update: (state) => {
            if (
              !ownsSubmitToken(conversationID, submitToken) ||
              (state.runningRunID && state.runningRunID !== result.data.runID) ||
              state.pendingUserMessage !== input
            ) {
              return state;
            }
            return {
              ...state,
              runningRunID: result.data.runID,
              ...(retryAbortedRunID
                ? {
                    conversation: rewindRetryConversationSnapshot(
                      state.conversation,
                      retryAbortedRunID
                    )
                  }
                : {})
            };
          }
        });
        return true;
      } catch (err) {
        Log.error(err);
        let shouldNotify = false;
        updateConversationState({
          conversationID,
          update: (state) => {
            if (
              !ownsSubmitToken(conversationID, submitToken) ||
              state.runningRunID ||
              !state.sending ||
              state.pendingUserMessage !== input
            ) {
              return state;
            }
            shouldNotify = true;
            return {
              ...state,
              sending: false,
              pendingUserMessage: ""
            };
          }
        });
        if (shouldNotify) {
          AppToast.show({
            type: "error",
            text: "发送消息失败"
          });
        }
        return false;
      } finally {
        updateConversationState({
          conversationID,
          update: (state) => {
            if (!ownsSubmitToken(conversationID, submitToken) || !state.sending) return state;
            return {
              ...state,
              sending: false
            };
          }
        });
        releaseSubmitToken(conversationID, submitToken);
      }
    },
    [
      conversationID,
      selectedConfigID,
      state.recovering,
      state.runningRunID,
      state.sending,
      updateConversationState
    ]
  );
  const submit = useCallback((text: string) => send(text), [send]);
  const retry = useCallback(
    (text: string, abortedRunID: string) => send(text, abortedRunID),
    [send]
  );
  const retryCandidate = useMemo(
    () => getAgentRetryCandidate(state.conversation),
    [state.conversation]
  );

  const abort = useCallback(() => {
    if (!state.runningRunID) return;
    void (async () => {
      const result = await RendererAgent.abort(state.runningRunID);
      if (!result.ok) {
        showAgentError(result.reason);
      }
    })();
  }, [state.runningRunID]);

  return useMemo(
    () => ({
      abort,
      retry,
      submit,
      retryCandidate,
      sending: state.sending,
      streamText: state.streamText,
      recovering: state.recovering,
      conversation: state.conversation,
      runningRunID: state.runningRunID,
      liveTimeline: state.liveTimeline,
      pendingUserMessage: state.pendingUserMessage
    }),
    [
      abort,
      retry,
      submit,
      retryCandidate,
      state.sending,
      state.streamText,
      state.recovering,
      state.conversation,
      state.runningRunID,
      state.liveTimeline,
      state.pendingUserMessage
    ]
  );
}

export const getAgentRetryCandidate = (
  conversation: Nullable<LLMConversationSnapshot>
): null | AgentRetryCandidate => {
  const runtime = conversation?.runtime;
  const inputMessageIndex = runtime?.inputMessageIndex;
  if (
    !conversation ||
    runtime?.status !== "aborted" ||
    !runtime.terminal ||
    !runtime.incomplete ||
    typeof inputMessageIndex !== "number" ||
    !Number.isInteger(inputMessageIndex)
  ) {
    return null;
  }

  const message = conversation.messages[inputMessageIndex];
  if (message?.role !== "user" || !message.content.trim()) return null;
  return { runID: runtime.runID, text: message.content };
};

const rewindRetryConversationSnapshot = (
  conversation: Nullable<LLMConversationSnapshot>,
  expectedRunID: string
): Nullable<LLMConversationSnapshot> => {
  const candidate = getAgentRetryCandidate(conversation);
  const runtime = conversation?.runtime;
  const inputMessageIndex = runtime?.inputMessageIndex;
  if (
    !conversation ||
    !runtime ||
    !candidate ||
    candidate.runID !== expectedRunID ||
    typeof inputMessageIndex !== "number"
  ) {
    return conversation;
  }

  const { compaction, assistantTurns, runtime: removedRuntime, ...snapshot } = conversation;
  void removedRuntime;
  const nextAssistantTurns = assistantTurns?.filter(
    (turn) => turn.messageIndex < inputMessageIndex
  );
  const retryCoveredMessageCount = compaction?.fallback?.retryState?.coveredMessageCount;
  const keepCompaction =
    !!compaction &&
    compaction.coveredMessageCount <= inputMessageIndex &&
    (retryCoveredMessageCount === undefined || retryCoveredMessageCount <= inputMessageIndex);

  return {
    ...snapshot,
    name: runtime.titleGenerated ? "" : snapshot.name,
    messages: snapshot.messages.slice(0, inputMessageIndex),
    ...(nextAssistantTurns?.length ? { assistantTurns: nextAssistantTurns } : {}),
    ...(keepCompaction ? { compaction } : {})
  };
};

const showAgentError = (error: AgentInvokeError) => {
  AppToast.show({ type: "error", text: `${error.type}: ${error.message}` });
};
