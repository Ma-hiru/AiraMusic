import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { RendererWindow } from "@/common/lib/window";
import { RendererAgent } from "@/wins/agent/lib/agent";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { reduceAgentConversationEvent } from "@/wins/agent/hooks/agent-event-state";
import { parseAgentTurnUsage } from "@/wins/agent/page/chat/observability";
import {
  AgentAguiAdapter,
  readAgentAguiIdentity,
  type AgentConversationEvent
} from "./agui-adapter";
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
import type {
  AGUIEvent,
  ThreadSummary,
  ProviderDescriptor,
  ProviderConfigView
} from "@mahiru/agent/browser";
import type { AgentInvokeError } from "@mahiru/ipc/types";
import type { AgentTokenUsage } from "@/wins/agent/page/types";

interface PendingRunError {
  message: string;
  usage?: AgentTokenUsage;
}

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
  const agentEventsReadyRef = useRef(false);
  const aguiAdapterRef = useRef(new AgentAguiAdapter());
  const bufferedAgentEventsRef = useRef<AGUIEvent[]>([]);
  const pendingRunErrorsRef = useRef(new Map<string, PendingRunError>());

  // 模型服务提供方
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const loadProviders = useCallback(async () => {
    const result = await RendererAgent.listProviders();
    if (!result.ok) {
      showAgentError(result.reason);
      return [];
    }
    setProviders(result.data);
    return result.data;
  }, []);

  // 模型配置
  const [configs, setConfigs] = useState<ProviderConfigView[]>([]);
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
  const saveConfig = useCallback(
    (config: ProviderConfigView, select = true) => {
      if (select) setSelectedConfigID(config.id);
      setConfigs((items) => [config, ...items.filter((item) => item.id !== config.id)]);
      void loadConfigs();
    },
    [loadConfigs, setSelectedConfigID]
  );

  // 会话摘要
  const [conversations, setConversations] = useState<ThreadSummary[]>([]);
  const loadConversations = useCallback(async () => {
    const result = await RendererAgent.listThreads();
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

      const result = await RendererAgent.getThread(id);
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
            conversation: result.data,
            latestRunID: state.runningRunID || result.data.runtime.runId || state.latestRunID,
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

  const openReusableBlankConversation = useCallback(async () => {
    if (
      conversation &&
      !conversation.name.trim() &&
      !conversation.messages.length &&
      !runningRunID
    ) {
      return true;
    }

    const blankConversations = conversations.filter((item) => {
      if (item.name.trim()) return false;
      return !runningConversationIDsRef.current.includes(item.id);
    });

    for (const item of blankConversations) {
      const result = await RendererAgent.getThread(item.id);
      if (!result.ok) {
        showAgentError(result.reason);
        return false;
      }

      const snapshot = result.data;
      if (snapshot.messages.length) continue;

      setSelectedConversationID(item.id);
      updateConversationState({
        conversationID: item.id,
        update: (state) => ({
          ...state,
          conversation: snapshot,
          sending: false,
          streamText: "",
          recovering: false,
          latestRunID: snapshot.runtime.runId ?? "",
          runningRunID: "",
          liveTimeline: EMPTY_LIVE_TIMELINE,
          pendingUserMessage: ""
        })
      });
      return true;
    }

    return false;
  }, [
    conversation,
    conversations,
    runningRunID,
    runningConversationIDsRef,
    setSelectedConversationID,
    updateConversationState
  ]);

  const createConversation = useCallback(async () => {
    if (await openReusableBlankConversation()) return;

    const result = await RendererAgent.createThread(undefined);
    if (!result.ok) {
      showAgentError(result.reason);
      return;
    }
    await loadConversations();
    await openConversation(result.data.id);
  }, [loadConversations, openConversation, openReusableBlankConversation]);
  const removeConversation = useCallback(
    async (id: string) => {
      if (!id || runningConversationIDsRef.current.includes(id)) return;

      const result = await RendererAgent.deleteThread(id);
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

  const applyAgentChatEvent = useCallback(
    (event: AgentConversationEvent, notify = true) => {
      let applied = false;
      updateConversationState({
        conversationID: event.conversationID,
        update: (state) => {
          const next = reduceAgentConversationEvent(state, event);
          applied = next !== state;
          return next;
        }
      });
      if (!applied) return false;

      if (event.type === "finished") {
        void loadConversations();
      } else if (event.type === "failed" && notify) {
        showAgentError({ code: "run_failed", message: event.message ?? "Agent 运行失败" });
      }

      return true;
    },
    [loadConversations, updateConversationState]
  );

  const applyAgentAguiEvent = useCallback(
    async (event: AGUIEvent) => {
      const identity = readAgentAguiIdentity(event);
      if (!identity) return;
      const { runID, conversationID } = identity;
      const record = event as unknown as Record<string, unknown>;

      if (event.type === "RUN_ERROR") {
        const turnUsage = parseAgentTurnUsage(record["usages"]);
        const message =
          typeof record["message"] === "string" ? record["message"] : "Agent 运行失败";

        // Loop 的预期错误会在持久化完成后继续发送 RUN_FINISHED；先展示错误，
        // 再由 RUN_FINISHED 用权威快照收口。InnerError 自带 usages，且不会再发结束事件。
        if (record["usages"] === null || record["usages"] === undefined) {
          pendingRunErrorsRef.current.set(runID, {
            message,
            ...(turnUsage?.usage ? { usage: turnUsage.usage } : {})
          });
          applyAgentChatEvent({
            type: "failed",
            runID,
            conversationID,
            message,
            ...(turnUsage?.usage ? { usage: turnUsage.usage } : {})
          });
          aguiAdapterRef.current.clear(runID);
          return;
        }

        const snapshot = await RendererAgent.getThread(conversationID);
        applyAgentChatEvent({
          type: "failed",
          runID,
          conversationID,
          message,
          ...(turnUsage?.usage ? { usage: turnUsage.usage } : {}),
          ...(snapshot.ok ? { snapshot: snapshot.data } : {})
        });
        aguiAdapterRef.current.clear(runID);
        return;
      }

      if (event.type === "RUN_FINISHED") {
        const pendingError = pendingRunErrorsRef.current.get(runID);
        pendingRunErrorsRef.current.delete(runID);
        const snapshot = await RendererAgent.getThread(conversationID);
        if (!snapshot.ok) {
          showAgentError(snapshot.reason);
          return;
        }
        const result = typeof record["result"] === "string" ? record["result"] : "success";
        if (pendingError) {
          const turnUsage = parseAgentTurnUsage(record["usages"]);
          applyAgentChatEvent(
            {
              type: "failed",
              runID,
              conversationID,
              snapshot: snapshot.data,
              message: pendingError.message,
              ...(turnUsage?.usage || pendingError.usage
                ? { usage: turnUsage?.usage ?? pendingError.usage }
                : {})
            },
            false
          );
        } else if (result === "cancel") {
          applyAgentChatEvent({
            type: "cancelled",
            runID,
            conversationID,
            snapshot: snapshot.data
          });
        } else if (result !== "success") {
          applyAgentChatEvent({
            type: "failed",
            runID,
            conversationID,
            snapshot: snapshot.data,
            message: result === "max-step" ? "Agent 已达到最大执行步数" : result
          });
        } else {
          applyAgentChatEvent({
            type: "finished",
            runID,
            conversationID,
            snapshot: snapshot.data
          });
        }
        aguiAdapterRef.current.clear(runID);
        return;
      }

      for (const translated of aguiAdapterRef.current.push(event)) {
        applyAgentChatEvent(translated);
      }
    },
    [applyAgentChatEvent]
  );

  const flushBufferedAgentEvents = useCallback(() => {
    for (const event of bufferedAgentEventsRef.current.splice(0)) {
      void applyAgentAguiEvent(event);
    }
  }, [applyAgentAguiEvent]);

  const restoreRunningConversations = useCallback(
    async (recoverableIDs = recoverableConversationIDs) => {
      const result = await RendererAgent.listRuns();
      if (!result.ok) {
        showAgentError(result.reason);
        return [];
      }

      const activeRuns = result.data;
      const activeRunByConversationID = new Map(
        activeRuns.map((run) => [run.threadId, run] as const)
      );
      const restoreConversationIDs = new Set([
        ...recoverableIDs,
        ...activeRuns.map((run) => run.threadId)
      ]);

      await Promise.all(
        [...restoreConversationIDs].map(async (conversationID) => {
          const activeRun = activeRunByConversationID.get(conversationID);
          if (activeRun) {
            const snapshot = await RendererAgent.getThread(conversationID);
            if (!snapshot.ok) showAgentError(snapshot.reason);
            const conversationSnapshot = snapshot.ok ? (snapshot.data ?? null) : null;
            updateConversationState({
              conversationID,
              update: (state) => ({
                ...state,
                sending: false,
                recovering: true,
                streamText: "",
                latestRunID: activeRun.runId,
                runningRunID: activeRun.runId,
                liveTimeline: EMPTY_LIVE_TIMELINE,
                conversation: conversationSnapshot ?? state.conversation
              })
            });
            return;
          }

          const snapshot = await RendererAgent.getThread(conversationID);
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
              latestRunID: snapshot.data.runtime.runId ?? state.latestRunID,
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
    (event: AGUIEvent) => {
      if (!agentEventsReadyRef.current) {
        bufferedAgentEventsRef.current.push(event);
        if (bufferedAgentEventsRef.current.length > 256) {
          bufferedAgentEventsRef.current.splice(0, bufferedAgentEventsRef.current.length - 256);
        }
        return;
      }
      void applyAgentAguiEvent(event);
    },
    [applyAgentAguiEvent]
  );
  useEffect(() => {
    return RendererWindow.process.listenMessage(
      "message_deliver_agent_chat_event",
      handleAgentChatEvent
    );
  }, [handleAgentChatEvent]);

  useEffect(() => {
    if (!agentEventsReadyRef.current || !runningConversationIDs.length) return;
    let disposed = false;
    let checking = false;

    const reconcile = async () => {
      if (checking || disposed) return;
      checking = true;
      try {
        const runs = await RendererAgent.listRuns();
        if (!runs.ok || disposed) return;
        const activeConversationIDs = new Set(runs.data.map((run) => run.threadId));
        const completedConversationIDs = runningConversationIDs.filter(
          (conversationID) => !activeConversationIDs.has(conversationID)
        );
        if (!completedConversationIDs.length) return;

        await Promise.all(
          completedConversationIDs.map(async (conversationID) => {
            const snapshot = await RendererAgent.getThread(conversationID);
            if (!snapshot.ok || disposed) return;
            updateConversationState({
              conversationID,
              update: (state) => {
                if (!state.runningRunID && !state.recovering) return state;
                return {
                  ...state,
                  sending: false,
                  recovering: false,
                  streamText: "",
                  runningRunID: "",
                  liveTimeline: EMPTY_LIVE_TIMELINE,
                  conversation: snapshot.data,
                  pendingUserMessage: ""
                };
              }
            });
          })
        );
        void loadConversations();
      } finally {
        checking = false;
      }
    };

    const timer = window.setInterval(() => void reconcile(), 2_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [loadConversations, runningConversationIDs, updateConversationState]);

  const refresh = useCallback(
    async (recoverableIDs?: string[]) => {
      if (loadingRef.current) return;
      setLoading(true);
      try {
        await Promise.all([
          loadProviders(),
          loadConfigs(),
          loadConversations(),
          restoreRunningConversations(recoverableIDs)
        ]);
      } catch (err) {
        Log.error(err);
        AppToast.show({
          type: "error",
          text: "刷新失败"
        });
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    },
    [loadConfigs, loadConversations, loadProviders, loadingRef, restoreRunningConversations]
  );
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void (async () => {
      try {
        const snapshot = await loadAgentAtomStorageSnapshot();
        applyStorageSnapshot(snapshot);
        await Promise.all([
          refresh(getAgentRecoverableConversationIDs(snapshot.conversationResumeStates)),
          snapshot.selectedConversationID
            ? openConversation(snapshot.selectedConversationID)
            : Promise.resolve()
        ]);
      } catch (err) {
        Log.error(err);
        await refresh();
      } finally {
        agentEventsReadyRef.current = true;
        flushBufferedAgentEvents();
      }
    })();
  }, [applyStorageSnapshot, flushBufferedAgentEvents, openConversation, refresh]);

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
    saveConfig,
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
  AppToast.show({ type: "error", text: `${error.code}: ${error.message}` });
};
