import { useAtom, useStore, useSetAtom, useAtomValue } from "jotai";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { RendererWindow } from "@/common/lib/window";
import { RendererAgent } from "@/wins/agent/lib/agent";
import { RendererAgentChat } from "@/wins/agent/lib/chat";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import {
  agentSelectedConfigIDAtom,
  agentCloseAfterRunningAtom,
  agentConversationStatesAtom,
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
  ApiError,
  AGUIEvent,
  ThreadSummary,
  ThreadSnapshot,
  ProviderConfigView,
  ProviderDescriptor
} from "@mahiru/agent/browser";

export function useAgent() {
  const agentStore = useStore();
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [eventsAvailable, setEventsAvailable] = useState(true);
  const loadingRef = useLatestRef(loading);

  const [selectedConfigID, setSelectedConfigID] = useAtom(agentSelectedConfigIDAtom);
  const [selectedConversationID, setSelectedConversationID] = useAtom(
    agentSelectedConversationIDAtom
  );
  const conversation = useAtomValue(agentSelectedConversationAtom);
  const runningRunID = useAtomValue(agentSelectedConversationRunningRunIDAtom);
  const runningConversationIDs = useAtomValue(agentBusyConversationIDsAtom);
  const recoverableConversationIDs = useAtomValue(agentRecoverableConversationIDsAtom);
  const recoverableConversationIDsRef = useLatestRef(recoverableConversationIDs);
  const selectedConversationIDRef = useLatestRef(selectedConversationID);
  const openConversationVersionRef = useRef(0);
  const [closeAfterRunning, setCloseAfterRunning] = useAtom(agentCloseAfterRunningAtom);
  const applyStorageSnapshot = useSetAtom(agentApplyStorageSnapshotAtom);
  const removeConversationState = useSetAtom(agentRemoveConversationStateAtom);
  const runningConversationIDsRef = useLatestRef(runningConversationIDs);
  const closeAfterRunningRef = useLatestRef(closeAfterRunning);
  const hydratedRef = useRef(false);
  const agentEventsReadyRef = useRef(false);
  const bufferedAgentEventsRef = useRef<AGUIEvent[]>([]);
  const conversationEventVersionsRef = useRef(new Map<string, number>());
  const reconnectPendingRef = useRef(false);

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
  const removeConfig = useCallback(
    async (id: string) => {
      const result = await RendererAgent.deleteConfig(id);
      if (!result.ok) {
        showAgentError(result.reason);
        return;
      }
      setConfigs((items) => items.filter((config) => config.id !== id));
      setSelectedConfigID((current) =>
        current === id ? configs.find((config) => config.id !== id)?.id || "" : current
      );
      await loadConfigs();
    },
    [configs, loadConfigs, setSelectedConfigID]
  );

  // 会话摘要
  const [conversations, setConversations] = useState<ThreadSummary[]>([]);
  const loadConversations = useCallback(async () => {
    const result = await RendererAgent.listThreads();
    if (!result.ok) {
      showAgentError(result.reason);
      return [];
    }

    setConversations((items) =>
      result.data.map((item) => {
        const current = items.find((existing) => existing.id === item.id);
        return current && current.updatedAt > item.updatedAt ? current : item;
      })
    );
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

      const requestVersion = ++openConversationVersionRef.current;
      const chat = RendererAgentChat.get(agentStore, id);
      const version = chat.version;
      const result = await RendererAgent.getThread(id);
      if (requestVersion !== openConversationVersionRef.current) return;
      if (!result.ok) {
        showAgentError(result.reason);
        return;
      }
      setSelectedConversationID(id);
      if (chat.version === version) await chat.restore(result.data);
    },
    [agentStore, setSelectedConversationID]
  );

  const openReusableBlankConversation = useCallback(
    async (requestVersion: number) => {
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
        if (requestVersion !== openConversationVersionRef.current) return false;
        if (!result.ok) {
          showAgentError(result.reason);
          return false;
        }

        const snapshot = result.data;
        if (snapshot.messages.length) continue;

        setSelectedConversationID(item.id);
        await RendererAgentChat.get(agentStore, item.id).restore(snapshot);
        return true;
      }

      return false;
    },
    [
      agentStore,
      conversation,
      conversations,
      runningRunID,
      runningConversationIDsRef,
      setSelectedConversationID
    ]
  );

  const createConversation = useCallback(async () => {
    const requestVersion = ++openConversationVersionRef.current;
    if (
      (await openReusableBlankConversation(requestVersion)) ||
      requestVersion !== openConversationVersionRef.current
    )
      return;

    const result = await RendererAgent.createThread(undefined);
    if (!result.ok) {
      showAgentError(result.reason);
      return;
    }
    await loadConversations();
    if (requestVersion !== openConversationVersionRef.current) return;
    await openConversation(result.data.id);
  }, [loadConversations, openConversation, openReusableBlankConversation]);
  const removeConversation = useCallback(
    async (id: string) => {
      if (!id || runningConversationIDsRef.current.includes(id)) return;
      if (id === selectedConversationIDRef.current) openConversationVersionRef.current++;

      const result = await RendererAgent.deleteThread(id);
      if (!result.ok) {
        showAgentError(result.reason);
        return;
      }

      setSelectedConversationID((current) => (current === id ? "" : current));
      RendererAgentChat.remove(agentStore, id);
      removeConversationState(id);
      await loadConversations();
    },
    [
      agentStore,
      loadConversations,
      selectedConversationIDRef,
      removeConversationState,
      setSelectedConversationID,
      runningConversationIDsRef
    ]
  );

  const applyAgentAguiEvent = useCallback(
    async (event: AGUIEvent) => {
      try {
        const updateMetadata = (
          metadata: Omit<ThreadSummary, "id"> & Pick<ThreadSnapshot, "auxiliaryUsage">
        ) => {
          agentStore.set(agentUpdateConversationStateAtom, {
            conversationID: event.threadId,
            update: (state) => {
              const updatedAt = Math.max(
                state.conversation?.updatedAt ?? 0,
                state.metadataUpdatedAt ?? 0
              );
              if (!state.conversation || updatedAt > metadata.updatedAt) {
                return state;
              }
              return {
                ...state,
                metadataUpdatedAt: metadata.updatedAt,
                conversation: { ...state.conversation, ...metadata }
              };
            }
          });
        };
        if (event.type === "CUSTOM") {
          if (event.name === "thread-metadata") {
            updateMetadata(event.value);
            setConversations((items) =>
              items.map((item) =>
                item.id === event.threadId && item.updatedAt <= event.value.updatedAt
                  ? { ...item, ...event.value }
                  : item
              )
            );
          }
          return;
        }
        const chat = RendererAgentChat.get(agentStore, event.threadId);
        const version = chat.version;
        const pending = chat.push(event);
        const state = agentStore.get(agentConversationStatesAtom)[event.threadId];
        const accepted = chat.version !== version && state?.runningRunID === event.runId;
        if (accepted && event.type === "RUN_STARTED") {
          void loadConversations().then((items) => {
            const summary = items.find((item) => item.id === event.threadId);
            if (summary) {
              updateMetadata({
                name: summary.name,
                createdAt: summary.createdAt,
                updatedAt: summary.updatedAt
              });
            }
          });
        }
        const settled = await pending;
        if (accepted && event.type === "RUN_ERROR") {
          showAgentError({ code: "run_failed", message: event.message });
        }
        if (settled) void loadConversations();
      } catch (error) {
        Log.warn("agent chat", "同步运行状态失败", error);
      }
    },
    [agentStore, loadConversations]
  );

  const flushBufferedAgentEvents = useCallback(() => {
    for (const event of bufferedAgentEventsRef.current.splice(0)) {
      void applyAgentAguiEvent(event);
    }
  }, [applyAgentAguiEvent]);

  const restoreRunningConversations = useCallback(
    async (
      recoverableIDs = recoverableConversationIDsRef.current,
      includeActive = true,
      disposed: () => boolean = () => false,
      reconnect = false
    ) => {
      const statesAtStart = agentStore.get(agentConversationStatesAtom);
      const versionsAtStart = new Map(conversationEventVersionsRef.current);
      const result = await RendererAgent.listRuns();
      if (disposed()) return 0;
      if (!result.ok) {
        if (includeActive) showAgentError(result.reason);
        return 0;
      }

      const activeRuns = result.data;
      const activeRunByConversationID = new Map(
        activeRuns.map((run) => [run.threadId, run] as const)
      );
      const restoreConversationIDs = new Set([
        ...recoverableIDs.filter(
          (conversationID) =>
            !!conversationID && (includeActive || !activeRunByConversationID.has(conversationID))
        ),
        ...(includeActive ? activeRuns.map((run) => run.threadId) : [])
      ]);
      let restored = 0;

      await Promise.all(
        [...restoreConversationIDs].map(async (conversationID) => {
          const snapshot = await RendererAgent.getThread(conversationID);
          if (disposed()) return;
          if (!snapshot.ok) {
            if (includeActive) showAgentError(snapshot.reason);
            return;
          }
          const isCurrent = () =>
            !disposed() &&
            agentStore.get(agentConversationStatesAtom)[conversationID] ===
              statesAtStart[conversationID] &&
            conversationEventVersionsRef.current.get(conversationID) ===
              versionsAtStart.get(conversationID);
          // 恢复期间的新提交和流事件优先，迟到快照留待下次同步。
          if (!isCurrent()) return;
          await RendererAgentChat.get(agentStore, conversationID).restore(
            snapshot.data,
            isCurrent,
            reconnect
          );
          if (!disposed()) restored++;
        })
      );

      return restored;
    },
    [agentStore, recoverableConversationIDsRef]
  );

  const handleAgentChatEvent = useCallback(
    (event: AGUIEvent) => {
      const versions = conversationEventVersionsRef.current;
      versions.set(event.threadId, (versions.get(event.threadId) ?? 0) + 1);
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
  const reconcileAfterReconnect = useCallback(
    async (signal?: AbortSignal) => {
      if (!agentEventsReadyRef.current) {
        reconnectPendingRef.current = true;
        return;
      }
      await restoreRunningConversations(
        [
          ...runningConversationIDsRef.current,
          ...recoverableConversationIDsRef.current,
          selectedConversationIDRef.current
        ],
        true,
        () => !!signal?.aborted,
        true
      );
      if (!signal?.aborted) void loadConversations();
    },
    [
      loadConversations,
      recoverableConversationIDsRef,
      restoreRunningConversations,
      runningConversationIDsRef,
      selectedConversationIDRef
    ]
  );
  useEffect(() => {
    let disposed = false;
    const stop = RendererAgent.listenEvents(
      (event) => {
        if (!disposed) handleAgentChatEvent(event);
      },
      {
        onReconnect: (signal) => (disposed ? Promise.resolve() : reconcileAfterReconnect(signal)),
        onUnavailable: () => {
          if (disposed) return;
          setEventsAvailable(false);
          RendererAgentChat.disconnect(agentStore);
        }
      }
    );
    return () => {
      disposed = true;
      stop();
      RendererAgentChat.disconnect(agentStore);
    };
  }, [agentStore, handleAgentChatEvent, reconcileAfterReconnect]);

  useEffect(() => {
    if (!eventsAvailable || !agentEventsReadyRef.current || !runningConversationIDs.length) return;
    let disposed = false;
    let checking = false;

    const reconcile = async () => {
      if (checking || disposed) return;
      checking = true;
      try {
        const restored = await restoreRunningConversations(
          runningConversationIDsRef.current,
          false,
          () => disposed
        );
        if (restored && !disposed) void loadConversations();
      } finally {
        checking = false;
      }
    };

    const timer = window.setInterval(() => void reconcile(), 2_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [
    loadConversations,
    eventsAvailable,
    restoreRunningConversations,
    runningConversationIDs,
    runningConversationIDsRef
  ]);

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
        if (reconnectPendingRef.current) {
          reconnectPendingRef.current = false;
          void reconcileAfterReconnect();
        }
        setLoaded(true);
      }
    })();
  }, [
    applyStorageSnapshot,
    flushBufferedAgentEvents,
    openConversation,
    reconcileAfterReconnect,
    refresh
  ]);

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
    removeConfig,
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

const showAgentError = (error: ApiError) => {
  AppToast.show({ type: "error", text: `${error.code}: ${error.message}` });
};
