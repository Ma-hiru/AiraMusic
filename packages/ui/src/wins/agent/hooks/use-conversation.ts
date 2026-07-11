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

export function useConversation(conversationID: string) {
  const conversationStateAtom = useMemo(
    () => createAgentConversationStateAtom(conversationID),
    [conversationID]
  );
  const state = useAtomValue(conversationStateAtom);
  const selectedConfigID = useAtomValue(agentSelectedConfigIDAtom);
  const updateConversationState = useSetAtom(agentUpdateConversationStateAtom);

  const submit = useCallback(
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

      updateConversationState({
        conversationID,
        update: (state) => ({
          ...state,
          sending: true,
          streamText: "",
          recovering: false,
          liveTimeline: EMPTY_LIVE_TIMELINE,
          pendingUserMessage: input
        })
      });

      try {
        const result = await RendererAgent.chat({
          input,
          configID: selectedConfigID,
          conversationID
        });
        if (!result.ok) {
          updateConversationState({
            conversationID,
            update: (state) => ({
              ...state,
              sending: false,
              runningRunID: "",
              pendingUserMessage: ""
            })
          });
          showAgentError(result.reason);
          return false;
        }
        updateConversationState({
          conversationID,
          update: (state) => ({
            ...state,
            runningRunID: result.data.runID
          })
        });
        return true;
      } catch (err) {
        Log.error(err);
        updateConversationState({
          conversationID,
          update: (state) => ({
            ...state,
            sending: false,
            runningRunID: "",
            pendingUserMessage: ""
          })
        });
        AppToast.show({
          type: "error",
          text: "发送消息失败"
        });
        return false;
      } finally {
        updateConversationState({
          conversationID,
          update: (state) => ({
            ...state,
            sending: false
          })
        });
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
  AppToast.show({ type: "error", text: `${error.type}: ${error.message}` });
};
