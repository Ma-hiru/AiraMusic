import { Bot, PanelLeftOpen, PanelRightClose } from "lucide-react";
import { memo, useRef, type FC, useMemo, useState, useEffect, useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererAgent } from "@/wins/agent/lib/agent";
import Drag from "@/common/components/layout/drag/drag";
import AppModal from "@/common/components/display/modal";
import AppToast from "@/common/components/display/toast";
import Marquee from "@/common/components/display/marquee";
import NoDrag from "@/common/components/layout/drag/no-drag";
import Control from "@/common/components/layout/top/control";
import IconButton from "@/common/components/data-input/icon-button";
import type { AgentConversationSummary } from "@mahiru/ipc/types";
import type { AIAgentEvent, LLMConversationSnapshot, AIProviderConfigSnapshot } from "@mahiru/ai";

import Chat from "./chat";
import Background from "./background";
import ConversationList from "./list";
import type { AgentLiveTimelineItem } from "./types";
import { createAgentConfigModal } from "./config-modal";

const AgentPage: FC<object> = () => {
  const { create } = AppModal.useModal();
  const [openList, setOpenList] = useState(true);
  const [providers, setProviders] = useState<string[]>([]);
  const [configs, setConfigs] = useState<AIProviderConfigSnapshot[]>([]);
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const [selectedConfigID, setSelectedConfigID] = useState("");
  const [selectedConversationID, setSelectedConversationID] = useState("");
  const [conversation, setConversation] = useState<Nullable<LLMConversationSnapshot>>(null);
  const [streamText, setStreamText] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState("");
  const [liveTimeline, setLiveTimeline] = useState<AgentLiveTimelineItem[]>([]);
  const [runningRunID, setRunningRunID] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const streamTextRef = useRef("");

  const activeConfig = useMemo(
    () => configs.find((config) => config.id === selectedConfigID),
    [configs, selectedConfigID]
  );
  const currentTitle =
    conversation?.name ||
    conversations.find((item) => item.id === selectedConversationID)?.name ||
    "新对话";
  const statusText = runningRunID
    ? "运行中"
    : loading
      ? "加载中"
      : activeConfig
        ? "就绪"
        : "待配置";

  const showAgentError = useCallback((message: string) => {
    AppToast.show({ type: "error", text: message });
  }, []);

  const resetLiveRunState = useCallback(() => {
    streamTextRef.current = "";
    setStreamText("");
    setLiveTimeline([]);
  }, []);

  const loadProviders = useCallback(async () => {
    const result = await RendererAgent.listProvider();
    if (!result.ok) {
      showAgentError(result.reason.message);
      return [];
    }

    setProviders(result.data);
    return result.data;
  }, [showAgentError]);

  const loadConfigs = useCallback(async () => {
    const result = await RendererAgent.listConfigs();
    if (!result.ok) {
      showAgentError(result.reason.message);
      return [];
    }

    setConfigs(result.data);
    setSelectedConfigID((current) =>
      result.data.some((config) => config.id === current) ? current : result.data[0]?.id || ""
    );
    return result.data;
  }, [showAgentError]);

  const loadConversations = useCallback(async () => {
    const result = await RendererAgent.listConversations();
    if (!result.ok) {
      showAgentError(result.reason.message);
      return [];
    }

    setConversations(result.data);
    return result.data;
  }, [showAgentError]);

  const openConversation = useCallback(
    async (id: string) => {
      const result = await RendererAgent.getConversation(id);
      if (!result.ok) {
        showAgentError(result.reason.message);
        return;
      }

      setSelectedConversationID(id);
      setConversation(result.data ?? null);
      resetLiveRunState();
      setPendingUserMessage("");
    },
    [resetLiveRunState, showAgentError]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadProviders(), loadConfigs(), loadConversations()]);
    } finally {
      setLoading(false);
    }
  }, [loadConfigs, loadConversations, loadProviders]);

  const refreshConfigs = useCallback(async () => {
    setLoading(true);
    try {
      await loadConfigs();
    } finally {
      setLoading(false);
    }
  }, [loadConfigs]);

  const refreshConversations = useCallback(async () => {
    setLoading(true);
    try {
      await loadConversations();
    } finally {
      setLoading(false);
    }
  }, [loadConversations]);

  const openConfigModal = useCallback(async () => {
    const providerOptions = providers.length ? providers : await loadProviders();
    create(createAgentConfigModal, {
      providers: providerOptions,
      defaultProvider: providerOptions[0],
      onCreated: (config) => {
        setSelectedConfigID(config.id);
        setConfigs((items) => [config, ...items.filter((item) => item.id !== config.id)]);
        void loadConfigs();
      }
    });
  }, [create, loadConfigs, loadProviders, providers]);

  const createConversation = useCallback(async () => {
    const result = await RendererAgent.createConversation(undefined);
    if (!result.ok) {
      showAgentError(result.reason.message);
      return;
    }

    await loadConversations();
    await openConversation(result.data.id);
  }, [loadConversations, openConversation, showAgentError]);

  const removeConversation = useCallback(
    async (id: string) => {
      if (!id || (runningRunID && id === selectedConversationID)) return;
      const result = await RendererAgent.removeConversation(id);
      if (!result.ok) {
        showAgentError(result.reason.message);
        return;
      }

      if (id === selectedConversationID) {
        setSelectedConversationID("");
        setConversation(null);
        resetLiveRunState();
        setPendingUserMessage("");
      }
      await loadConversations();
    },
    [loadConversations, resetLiveRunState, runningRunID, selectedConversationID, showAgentError]
  );

  const submitChat = useCallback(
    async (text: string) => {
      if (!text || !selectedConfigID || !selectedConversationID || runningRunID) return false;

      setSending(true);
      resetLiveRunState();
      setPendingUserMessage(text);

      try {
        const result = await RendererAgent.chat({
          input: text,
          configID: selectedConfigID,
          conversationID: selectedConversationID
        });

        if (!result.ok) {
          setPendingUserMessage("");
          showAgentError(result.reason.message);
          return false;
        }

        setRunningRunID(result.data.runID);
        return true;
      } finally {
        setSending(false);
      }
    },
    [resetLiveRunState, runningRunID, selectedConfigID, selectedConversationID, showAgentError]
  );

  const abortRun = useCallback(async () => {
    if (!runningRunID) return;
    const result = await RendererAgent.abort(runningRunID);
    if (!result.ok) {
      showAgentError(result.reason.message);
    }
  }, [runningRunID, showAgentError]);

  const handleAgentChatEvent = useCallback(
    (event: AIAgentEvent) => {
      switch (event.type) {
        case "started":
          setRunningRunID(event.runID);
          setSelectedConversationID(event.conversationID);
          break;
        case "title":
          setConversation((current) =>
            current?.id === event.conversationID ? { ...current, name: event.title } : current
          );
          setConversations((items) =>
            items.map((item) =>
              item.id === event.conversationID ? { ...item, name: event.title } : item
            )
          );
          break;
        case "text_delta":
          setStreamText((text) => {
            const nextText = text + event.text;
            streamTextRef.current = nextText;
            return nextText;
          });
          break;
        case "tool_call": {
          const eventText = event.text?.trim();
          const currentText = streamTextRef.current;
          const assistantText =
            eventText && (!currentText || eventText.startsWith(currentText))
              ? event.text!
              : currentText;

          streamTextRef.current = "";
          setStreamText("");
          setLiveTimeline((items) => {
            const nextItems: AgentLiveTimelineItem[] = [...items];
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
            return nextItems;
          });
          break;
        }
        case "tool_result":
          setLiveTimeline((items) =>
            items.map((item) =>
              item.type === "tool" && item.id === `${event.runID}-${event.step}-tool`
                ? {
                    ...item,
                    status: "done",
                    toolResults: event.toolResults
                  }
                : item
            )
          );
          break;
        case "done":
          setConversation(event.snapshot);
          setSelectedConversationID(event.conversationID);
          setRunningRunID("");
          resetLiveRunState();
          setPendingUserMessage("");
          void loadConversations();
          break;
        case "aborted":
          setRunningRunID("");
          streamTextRef.current = "";
          setStreamText("");
          setPendingUserMessage("");
          setLiveTimeline((items) =>
            items.map((item) =>
              item.type === "tool" && item.status === "running"
                ? {
                    ...item,
                    status: "error"
                  }
                : item
            )
          );
          break;
        case "error":
          setRunningRunID("");
          streamTextRef.current = "";
          setStreamText("");
          setPendingUserMessage("");
          setLiveTimeline((items) =>
            items.map((item) =>
              item.type === "tool" && item.status === "running"
                ? {
                    ...item,
                    status: "error"
                  }
                : item
            )
          );
          showAgentError(event.error.message);
          break;
      }
    },
    [loadConversations, resetLiveRunState, showAgentError]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    document.title = `${currentTitle} - AiraMusic Agent`;
  }, [currentTitle]);

  useEffect(() => {
    return RendererWindow.process.listenMessage(
      "message_deliver_agent_chat_event",
      handleAgentChatEvent
    );
  }, [handleAgentChatEvent]);

  return (
    <div className="relative h-screen w-screen overflow-hidden text-white">
      <Drag className="absolute top-0 right-0 z-50 grid h-10 w-screen grid-cols-[1fr_2fr_1fr] items-center px-4">
        <NoDrag className="flex shrink-0 items-center justify-start gap-2 text-sm">
          <IconButton
            size="compact"
            variant="ghost"
            label={openList ? "关闭对话列表" : "打开对话列表"}
            icon={openList ? PanelRightClose : PanelLeftOpen}
            onClick={() => setOpenList((opened) => !opened)}
          />
          <img className="size-4.5" src="/images/logo.svg" alt={import.meta.env.APP_NAME} />
          <h1 className="leading-normal font-semibold tracking-tight">
            {import.meta.env.APP_NAME} Agent
          </h1>
        </NoDrag>
        <Marquee
          className="flex flex-1 items-center justify-center text-center font-medium"
          text={currentTitle}
        />
        <div className="flex shrink-0 items-center justify-end gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[11px] font-semibold text-white/60">
            <Bot className="size-3.5" />
            {statusText}
          </span>
          <Control className="justify-end" pin mini />
        </div>
      </Drag>
      <Background />
      <main className="relative top-10 flex h-[calc(100%-40px)] w-screen flex-row gap-3 pr-3 pb-3">
        <ConversationList
          open={openList}
          loading={loading}
          runningRunID={runningRunID}
          conversations={conversations}
          selectedConversationID={selectedConversationID}
          onRefresh={() => void refreshConversations()}
          onCreateConversation={() => void createConversation()}
          onOpenConversation={(id) => void openConversation(id)}
          onRemoveConversation={(id) => void removeConversation(id)}
        />
        <Chat
          className="mt-3 flex-1"
          configs={configs}
          sending={sending}
          streamText={streamText}
          loadingConfigs={loading}
          activeConfig={activeConfig}
          conversation={conversation}
          liveTimeline={liveTimeline}
          runningRunID={runningRunID}
          selectedConfigID={selectedConfigID}
          pendingUserMessage={pendingUserMessage}
          onSubmit={submitChat}
          onAbort={() => void abortRun()}
          onSelectConfig={setSelectedConfigID}
          onCreateConfig={() => void openConfigModal()}
          onRefreshConfigs={() => void refreshConfigs()}
          onCreateConversation={() => void createConversation()}
        />
      </main>
      <AppModal.Provider className="z-60" />
      <AppToast.Provider className="top-12 z-70" />
    </div>
  );
};

export default memo(AgentPage);
