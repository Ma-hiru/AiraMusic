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
import type { AgentInvokeError } from "@mahiru/ipc/src/types/agent";

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
    async (text: string) => {
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
        const result = await RendererAgent.createRun({
          content: input,
          configId: selectedConfigID,
          threadId: conversationID
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
              (state.runningRunID && state.runningRunID !== result.data.runId) ||
              state.pendingUserMessage !== input
            ) {
              return state;
            }
            return {
              ...state,
              latestRunID: result.data.runId,
              runningRunID: result.data.runId
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

  const abort = useCallback(() => {
    if (!state.runningRunID) return;
    void (async () => {
      const result = await RendererAgent.cancelRun(state.runningRunID);
      if (!result.ok) {
        showAgentError(result.reason);
      }
    })();
  }, [state.runningRunID]);

  return useMemo(
    () => ({
      abort,
      submit,
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
      submit,
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

const showAgentError = (error: AgentInvokeError) => {
  AppToast.show({ type: "error", text: `${error.code}: ${error.message}` });
};
