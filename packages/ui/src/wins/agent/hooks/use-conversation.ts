import { useChat } from "@ai-sdk/react";
import { useStore, useAtomValue } from "jotai";
import { useMemo, useEffect, useCallback } from "react";
import { RendererAgentChat } from "@/wins/agent/lib/chat";
import {
  agentSelectedConfigIDAtom,
  createAgentConversationStateAtom
} from "@/wins/agent/atoms/agent";
import AppToast from "@/common/components/display/toast";

export function useConversation(conversationID: string) {
  const store = useStore();
  const entry = RendererAgentChat.get(store, conversationID);
  useEffect(() => {
    entry.retain();
    return () => entry.release();
  }, [entry]);
  const { error, status, messages } = useChat({ chat: entry.chat, throttle: 30 });
  const stateAtom = useMemo(
    () => createAgentConversationStateAtom(conversationID),
    [conversationID]
  );
  const state = useAtomValue(stateAtom);
  const selectedConfigID = useAtomValue(agentSelectedConfigIDAtom);

  const submit = useCallback(
    async (text: string) => {
      const previousError = entry.chat.error;
      const accepted = await entry.submit(text.trim(), selectedConfigID);
      if (!accepted && entry.chat.error && entry.chat.error !== previousError) {
        AppToast.show({ type: "error", text: entry.chat.error.message });
      }
      return accepted;
    },
    [entry, selectedConfigID]
  );

  const abort = useCallback(() => {
    void entry.cancel().catch((error: unknown) => {
      AppToast.show({
        type: "error",
        text: error instanceof Error ? error.message : "停止生成失败"
      });
    });
  }, [entry]);

  return {
    abort,
    submit,
    messages,
    context: state.conversation?.context,
    auxiliaryUsage: state.conversation?.auxiliaryUsage,
    status,
    error,
    sending: state.sending || status === "submitted",
    recovering: state.recovering,
    runningRunID: state.runningRunID
  };
}
