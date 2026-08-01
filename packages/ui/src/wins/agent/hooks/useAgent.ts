import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { RendererWindow } from "@/common/lib/window";
import { RendererAgent } from "@/wins/agent/lib/agent";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { reduceAgentConversationEvent } from "@/wins/agent/hooks/agent-event-state";
import {
  readAgentEventReplay,
  readAgentEventEnvelope,
  getAgentEventFingerprint,
  readPersistedAssistantSteps
} from "@/wins/agent/page/chat/observability";
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
import type { AgentEventEnvelope } from "@/wins/agent/page/chat/observability";
import type { AgentInvokeError, AgentConversationSummary } from "@mahiru/ipc/types";
import type {
  AIAgentEvent,
  LLMProviderDescriptor,
  AIAgentEventReplayItem,
  AIProviderConfigSnapshot
} from "@mahiru/ai";

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
  const eventSequenceByRunRef = useRef(new Map<string, number>());
  const bufferedAgentEventsRef = useRef<AgentEventEnvelope[]>([]);
  const replayFingerprintCountsRef = useRef(new Map<string, Map<string, number>>());

  // 模型服务提供方
  const [providers, setProviders] = useState<LLMProviderDescriptor[]>([]);
  const loadProviders = useCallback(async () => {
    const result = await RendererAgent.listProviderDescriptors();
    if (!result.ok) {
      showAgentError(result.reason);
      return [];
    }
    setProviders(result.data);
    return result.data;
  }, []);

  // 模型配置
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
  const saveConfig = useCallback(
    (config: AIProviderConfigSnapshot, select = true) => {
      if (select) setSelectedConfigID(config.id);
      setConfigs((items) => [config, ...items.filter((item) => item.id !== config.id)]);
      void loadConfigs();
    },
    [loadConfigs, setSelectedConfigID]
  );

  // 会话摘要
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
            latestRunID: state.runningRunID || result.data?.runtime?.runID || state.latestRunID,
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
      const result = await RendererAgent.getConversation(item.id);
      if (!result.ok) {
        showAgentError(result.reason);
        return false;
      }

      const snapshot = result.data;
      if (!snapshot || snapshot.messages.length) continue;

      setSelectedConversationID(item.id);
      updateConversationState({
        conversationID: item.id,
        update: (state) => ({
          ...state,
          conversation: snapshot,
          sending: false,
          streamText: "",
          recovering: false,
          latestRunID: snapshot.runtime?.runID ?? "",
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

    const result = await RendererAgent.createConversation(undefined);
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

  const applyAgentChatEvent = useCallback(
    (event: AIAgentEvent, sequence?: number, notify = true) => {
      if (sequence !== undefined) {
        const previousSequence = eventSequenceByRunRef.current.get(event.runID);
        if (previousSequence !== undefined && sequence <= previousSequence) return false;
        eventSequenceByRunRef.current.set(event.runID, sequence);
        if (eventSequenceByRunRef.current.size > 64) {
          const oldestRunID = eventSequenceByRunRef.current.keys().next().value;
          if (oldestRunID && oldestRunID !== event.runID) {
            eventSequenceByRunRef.current.delete(oldestRunID);
          }
        }
      }

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

      if (event.type === "title") {
        setConversations((items) =>
          items.map((item) =>
            item.id === event.conversationID ? { ...item, name: event.title } : item
          )
        );
      } else if (event.type === "done") {
        void loadConversations();
      } else if (event.type === "error" && notify) {
        showAgentError(event.error);
      }

      return true;
    },
    [loadConversations, updateConversationState]
  );

  const flushBufferedAgentEvents = useCallback(() => {
    const buffered = bufferedAgentEventsRef.current.splice(0).sort((left, right) => {
      if (left.sequence === undefined) return 1;
      if (right.sequence === undefined) return -1;
      return left.sequence - right.sequence;
    });
    for (const envelope of buffered) {
      if (envelope.sequence === undefined) {
        const fingerprint = getAgentEventFingerprint(envelope.event);
        const counts = replayFingerprintCountsRef.current.get(envelope.event.runID);
        const replayedCount = counts?.get(fingerprint) ?? 0;
        if (replayedCount > 0) {
          counts?.set(fingerprint, replayedCount - 1);
          continue;
        }
      }
      applyAgentChatEvent(envelope.event, envelope.sequence);
    }
    replayFingerprintCountsRef.current.clear();
  }, [applyAgentChatEvent]);

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
            const snapshot = await RendererAgent.getConversation(conversationID);
            if (!snapshot.ok) showAgentError(snapshot.reason);
            const conversationSnapshot = snapshot.ok ? (snapshot.data ?? null) : null;
            updateConversationState({
              conversationID,
              update: (state) => ({
                ...state,
                sending: false,
                recovering: true,
                streamText: "",
                latestRunID: activeRun.runID,
                runningRunID: activeRun.runID,
                liveTimeline: EMPTY_LIVE_TIMELINE,
                conversation: conversationSnapshot ?? state.conversation
              })
            });
            const replay = readAgentEventReplay(conversationSnapshot, activeRun);
            const persistedSteps = readPersistedAssistantSteps(
              conversationSnapshot,
              activeRun.runID
            );
            const replayFingerprints = new Map<string, number>();
            for (const entry of replay) {
              const fingerprint = getAgentEventFingerprint(entry.event);
              replayFingerprints.set(fingerprint, (replayFingerprints.get(fingerprint) ?? 0) + 1);
              if ("step" in entry.event && persistedSteps.has(entry.event.step)) continue;
              applyAgentChatEvent(entry.event, entry.sequence, false);
            }
            replayFingerprintCountsRef.current.set(activeRun.runID, replayFingerprints);
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
              latestRunID: snapshot.data?.runtime?.runID ?? state.latestRunID,
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
    [applyAgentChatEvent, recoverableConversationIDs, updateConversationState]
  );

  const handleAgentChatEvent = useCallback(
    (payload: AIAgentEvent | AIAgentEventReplayItem) => {
      const envelope = readAgentEventEnvelope(payload);
      if (!envelope) return;
      if (!agentEventsReadyRef.current) {
        bufferedAgentEventsRef.current.push(envelope);
        if (bufferedAgentEventsRef.current.length > 256) {
          bufferedAgentEventsRef.current.splice(0, bufferedAgentEventsRef.current.length - 256);
        }
        return;
      }
      applyAgentChatEvent(envelope.event, envelope.sequence);
    },
    [applyAgentChatEvent]
  );
  useEffect(() => {
    return RendererWindow.process.listenMessage(
      "message_deliver_agent_chat_event",
      handleAgentChatEvent
    );
  }, [handleAgentChatEvent]);

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
  AppToast.show({ type: "error", text: `${error.type}: ${error.message}` });
};
