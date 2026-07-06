import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { RendererWindow } from "@/common/lib/window";
import { RendererAgent } from "@/wins/agent/lib/agent";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import {
  EMPTY_LIVE_TIMELINE,
  agentSelectedConfigIDAtom,
  agentCloseAfterRunningAtom,
  agentBusyConversationIDsAtom,
  loadAgentAtomStorageSnapshot,
  agentApplyStorageSnapshotAtom,
  agentSelectedConversationAtom,
  agentSelectedConversationIDAtom,
  agentRemoveConversationStateAtom,
  agentUpdateConversationStateAtom,
  getAgentRecoverableConversationIDs,
  agentRecoverableConversationIDsAtom,
  agentSelectedConversationRunningRunIDAtom
} from "@/wins/agent/atoms/agent";
import AppToast from "@/common/components/display/toast";
import type { AgentInvokeError } from "@mahiru/ipc/src/types/agent";
import type { AIAgentEvent, AIProviderConfigSnapshot } from "@mahiru/ai";
import type { AgentConversationSummary } from "@mahiru/ipc/dist-types/src/types/agent";

export function useAgent() {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const loadingRef = useLatestRef(loading);

  const [selectedConfigID, setSelectedConfigID] = useAtom(agentSelectedConfigIDAtom);
  const [selectedConversationID, setSelectedConversationID] = useAtom(
    agentSelectedConversationIDAtom
  );
  const conversation = useAtomValue(agentSelectedConversationAtom);
  const runningRunID = useAtomValue(agentSelectedConversationRunningRunIDAtom);
  const runningConversationIDs = useAtomValue(agentBusyConversationIDsAtom);
  const recoverableConversationIDs = useAtomValue(agentRecoverableConversationIDsAtom);
  const [closeAfterRunning, setCloseAfterRunning] = useAtom(agentCloseAfterRunningAtom);
  const applyStorageSnapshot = useSetAtom(agentApplyStorageSnapshotAtom);
  const updateConversationState = useSetAtom(agentUpdateConversationStateAtom);
  const removeConversationState = useSetAtom(agentRemoveConversationStateAtom);
  const runningConversationIDsRef = useLatestRef(runningConversationIDs);
  const closeAfterRunningRef = useLatestRef(closeAfterRunning);
  const hydratedRef = useRef(false);

  // provider
  const [providers, setProviders] = useState<string[]>([]);
  const loadProviders = useCallback(async () => {
    const result = await RendererAgent.listProvider();
    if (!result.ok) {
      showAgentError(result.reason);
      return [];
    }
    setProviders(result.data);
    return result.data;
  }, []);

  // config
  const [configs, setConfigs] = useState<AIProviderConfigSnapshot[]>([]);
  const activeConfig = useMemo(
    () => configs.find((config) => config.id === selectedConfigID),
    [configs, selectedConfigID]
  );
  const loadConfigs = useCallback(async () => {
    const result = await RendererAgent.listConfigs();
    if (!result.ok) {
      showAgentError(result.reason);
      return [];
    }
    setConfigs(result.data);
    setSelectedConfigID((current) =>
      result.data.some((config) => config.id === current) ? current : result.data[0]?.id || ""
    );
    return result.data;
  }, [setSelectedConfigID]);
  const refreshConfigs = useCallback(() => {
    if (loadingRef.current) return;
    setLoading(true);
    loadConfigs()
      .catch((err) => {
        Log.error(err);
        AppToast.show({
          type: "error",
          text: "刷新配置失败"
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [loadConfigs, loadingRef]);
  const createConfig = useCallback(
    (config: AIProviderConfigSnapshot) => {
      setSelectedConfigID(config.id);
      setConfigs((items) => [config, ...items.filter((item) => item.id !== config.id)]);
      void loadConfigs();
    },
    [loadConfigs, setSelectedConfigID]
  );

  // conversation-summary
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const loadConversations = useCallback(async () => {
    const result = await RendererAgent.listConversations();
    if (!result.ok) {
      showAgentError(result.reason);
      return [];
    }

    setConversations(result.data);
    return result.data;
  }, []);
  const refreshConversations = useCallback(() => {
    if (loadingRef.current) return;
    setLoading(true);
    loadConversations()
      .catch((err) => {
        Log.error(err);
        AppToast.show({
          type: "error",
          text: "刷新对话失败"
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [loadConversations, loadingRef]);

  const openConversation = useCallback(
    async (id: string) => {
      if (!id) return;

      const result = await RendererAgent.getConversation(id);
      if (!result.ok) {
        showAgentError(result.reason);
        return;
      }

      setSelectedConversationID(id);
      updateConversationState({
        conversationID: id,
        update: (state) => {
          const keepLiveState = !!state.runningRunID || state.sending || state.recovering;

          return {
            ...state,
            conversation: result.data ?? null,
            ...(keepLiveState
              ? {}
              : {
                  streamText: "",
                  recovering: false,
                  liveTimeline: EMPTY_LIVE_TIMELINE,
                  pendingUserMessage: ""
                })
          };
        }
      });
    },
    [setSelectedConversationID, updateConversationState]
  );
  const createConversation = useCallback(async () => {
    const result = await RendererAgent.createConversation(undefined);
    if (!result.ok) {
      showAgentError(result.reason);
      return;
    }
    await loadConversations();
    await openConversation(result.data.id);
  }, [loadConversations, openConversation]);
  const removeConversation = useCallback(
    async (id: string) => {
      if (!id || runningConversationIDsRef.current.includes(id)) return;

      const result = await RendererAgent.removeConversation(id);
      if (!result.ok) {
        showAgentError(result.reason);
        return;
      }

      if (id === selectedConversationID) {
        setSelectedConversationID("");
      }
      removeConversationState(id);
      await loadConversations();
    },
    [
      loadConversations,
      selectedConversationID,
      removeConversationState,
      setSelectedConversationID,
      runningConversationIDsRef
    ]
  );

  const restoreRunningConversations = useCallback(
    async (recoverableIDs = recoverableConversationIDs) => {
      const result = await RendererAgent.listRuns();
      if (!result.ok) {
        showAgentError(result.reason);
        return [];
      }

      const activeRuns = result.data;
      const activeRunByConversationID = new Map(
        activeRuns.map((run) => [run.conversationID, run] as const)
      );
      const restoreConversationIDs = new Set([
        ...recoverableIDs,
        ...activeRuns.map((run) => run.conversationID)
      ]);

      await Promise.all(
        [...restoreConversationIDs].map(async (conversationID) => {
          const activeRun = activeRunByConversationID.get(conversationID);
          if (activeRun) {
            updateConversationState({
              conversationID,
              update: (state) => ({
                ...state,
                sending: false,
                recovering: true,
                streamText: "",
                runningRunID: activeRun.runID,
                liveTimeline: EMPTY_LIVE_TIMELINE
              })
            });
            return;
          }

          const snapshot = await RendererAgent.getConversation(conversationID);
          if (!snapshot.ok) {
            showAgentError(snapshot.reason);
            return;
          }
          updateConversationState({
            conversationID,
            update: (state) => ({
              ...state,
              sending: false,
              recovering: false,
              streamText: "",
              runningRunID: "",
              liveTimeline: EMPTY_LIVE_TIMELINE,
              conversation: snapshot.data ?? state.conversation,
              pendingUserMessage: ""
            })
          });
        })
      );

      return activeRuns;
    },
    [recoverableConversationIDs, updateConversationState]
  );

  const handleAgentChatEvent = useCallback(
    (event: AIAgentEvent) => {
      switch (event.type) {
        case "started":
          updateConversationState({
            conversationID: event.conversationID,
            update: (state) => ({
              ...state,
              sending: false,
              recovering: false,
              runningRunID: event.runID
            })
          });
          break;
        case "title":
          updateConversationState({
            conversationID: event.conversationID,
            update: (state) => ({
              ...state,
              conversation: state.conversation
                ? {
                    ...state.conversation,
                    name: event.title
                  }
                : state.conversation
            })
          });
          setConversations((items) =>
            items.map((item) =>
              item.id === event.conversationID ? { ...item, name: event.title } : item
            )
          );
          break;
        case "text_delta":
          updateConversationState({
            conversationID: event.conversationID,
            update: (state) => ({
              ...state,
              recovering: false,
              streamText: state.streamText + event.text
            })
          });
          break;
        case "tool_call":
          updateConversationState({
            conversationID: event.conversationID,
            update: (state) => {
              const eventText = event.text?.trim();
              const currentText = state.streamText;
              const assistantText =
                eventText && (!currentText || eventText.startsWith(currentText))
                  ? event.text!
                  : currentText;
              const nextItems = [...state.liveTimeline];
              if (assistantText.trim()) {
                nextItems.push({
                  type: "assistant",
                  text: assistantText,
                  id: `${event.runID}-${event.step}-assistant`
                });
              }
              nextItems.push({
                type: "tool",
                status: "running",
                step: event.step,
                toolCalls: event.toolCalls,
                id: `${event.runID}-${event.step}-tool`
              });
              return {
                ...state,
                streamText: "",
                recovering: false,
                liveTimeline: nextItems
              };
            }
          });
          break;
        case "tool_result":
          updateConversationState({
            conversationID: event.conversationID,
            update: (state) => ({
              ...state,
              recovering: false,
              liveTimeline: state.liveTimeline.map((item) =>
                item.type === "tool" && item.id === `${event.runID}-${event.step}-tool`
                  ? {
                      ...item,
                      status: "done",
                      toolResults: event.toolResults
                    }
                  : item
              )
            })
          });
          break;
        case "done":
          updateConversationState({
            conversationID: event.conversationID,
            update: (state) => ({
              ...state,
              sending: false,
              streamText: "",
              recovering: false,
              runningRunID: "",
              liveTimeline: EMPTY_LIVE_TIMELINE,
              conversation: event.snapshot,
              pendingUserMessage: ""
            })
          });
          void loadConversations();
          break;
        case "aborted":
          updateConversationState({
            conversationID: event.conversationID,
            update: (state) => ({
              ...state,
              sending: false,
              streamText: "",
              recovering: false,
              runningRunID: "",
              pendingUserMessage: "",
              liveTimeline: state.liveTimeline.map((item) =>
                item.type === "tool" && item.status === "running"
                  ? {
                      ...item,
                      status: "error"
                    }
                  : item
              )
            })
          });
          break;
        case "error":
          updateConversationState({
            conversationID: event.conversationID,
            update: (state) => ({
              ...state,
              sending: false,
              streamText: "",
              recovering: false,
              runningRunID: "",
              pendingUserMessage: "",
              liveTimeline: state.liveTimeline.map((item) =>
                item.type === "tool" && item.status === "running"
                  ? {
                      ...item,
                      status: "error"
                    }
                  : item
              )
            })
          });
          showAgentError(event.error);
          break;
      }
    },
    [loadConversations, updateConversationState]
  );
  useEffect(() => {
    return RendererWindow.process.listenMessage(
      "message_deliver_agent_chat_event",
      handleAgentChatEvent
    );
  }, [handleAgentChatEvent]);

  const refresh = useCallback(
    (recoverableIDs?: string[]) => {
      if (loadingRef.current) return;
      setLoading(true);
      Promise.all([
        loadProviders(),
        loadConfigs(),
        loadConversations(),
        restoreRunningConversations(recoverableIDs)
      ])
        .catch((err) => {
          Log.error(err);
          AppToast.show({
            type: "error",
            text: "刷新失败"
          });
        })
        .finally(() => {
          setLoading(false);
          setLoaded(true);
        });
    },
    [loadConfigs, loadConversations, loadProviders, loadingRef, restoreRunningConversations]
  );
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void (async () => {
      const snapshot = await loadAgentAtomStorageSnapshot();
      applyStorageSnapshot(snapshot);
      refresh(getAgentRecoverableConversationIDs(snapshot.conversationResumeStates));
    })().catch((err) => {
      Log.error(err);
      refresh();
    });
  }, [applyStorageSnapshot, refresh]);

  const requestClose = useCallback(() => {
    if (runningConversationIDsRef.current.length) {
      setCloseAfterRunning(true);
      RendererWindow.current.hide();
      AppToast.show({
        type: "info",
        text: "Agent 正在生成，已隐藏窗口，完成后会关闭"
      });
      return;
    }
    RendererWindow.current.close();
  }, [runningConversationIDsRef, setCloseAfterRunning]);
  useEffect(() => {
    return RendererWindow.current.addEventListener("show", () => {
      if (!closeAfterRunningRef.current) return;
      setCloseAfterRunning(false);
      AppToast.show({
        type: "info",
        text: "已取消等待关闭"
      });
    });
  }, [closeAfterRunningRef, setCloseAfterRunning]);
  useEffect(() => {
    if (!closeAfterRunning || runningConversationIDs.length) return;
    RendererWindow.current.close();
  }, [closeAfterRunning, runningConversationIDs]);

  return {
    loaded,
    configs,
    loading,
    providers,
    conversation,
    activeConfig,
    requestClose,
    createConfig,
    conversations,
    runningRunID,
    openConversation,
    refreshConfigs,
    selectedConfigID,
    removeConversation,
    setSelectedConfigID,
    createConversation,
    refreshConversations,
    selectedConversationID,
    runningConversationIDs
  };
}

const showAgentError = (error: AgentInvokeError) => {
  AppToast.show({ type: "error", text: `${error.type}: ${error.message}` });
};
