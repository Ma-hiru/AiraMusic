import { cx } from "@emotion/css";
import { memo, type FC, useState, useEffect, useCallback, type FormEvent } from "react";
import {
  Bot,
  Plus,
  Square,
  Trash2,
  RefreshCw,
  Settings2,
  SendHorizontal,
  MessageSquarePlus
} from "lucide-react";
import { RendererWindow } from "@/common/lib/window";
import { RendererAgent } from "@/wins/agent/lib/agent";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import Drag from "@/common/components/layout/drag/drag";
import AppToast from "@/common/components/display/toast";
import Control from "@/common/components/layout/top/control";
import IconButton from "@/common/components/data-input/icon-button";
import AcrylicBackground from "@/common/components/display/acrylic-background";
import type {
  LLMMessage,
  LLMToolCall,
  AIAgentEvent,
  LLMConversationSnapshot,
  LLMProviderOpenAIConfig,
  AIProviderConfigSnapshot,
  LLMProviderOpenAIAPIMode
} from "@mahiru/ai";

type ConversationSummary = {
  id: string;
  name: string;
};

type ConfigForm = {
  id: string;
  name: string;
  model: string;
  apiKey: string;
  baseURL: string;
  provider: string;
  apiMode: LLMProviderOpenAIAPIMode;
};

type RuntimeEvent = {
  at: number;
  id: string;
  label: string;
  detail?: string;
  tone?: "error" | "success" | "warning";
};

const DemoPrompts = [
  "请根据当前播放上下文，推荐三首风格相近的歌曲。",
  "如果当前有歌曲播放，请查看歌词并总结主题。"
] as const;

const defaultConfigForm: ConfigForm = {
  id: "agent-demo-config",
  name: "DeepSeek Demo",
  provider: "",
  apiMode: "chat_completions",
  model: "deepseek-chat",
  baseURL: "https://api.deepseek.com",
  apiKey: ""
};

const inputClassName = `
  h-9 rounded-md border border-white/12 bg-black/20 px-3 text-[13px]
  outline-none transition-colors placeholder:text-white/35
  focus:border-primary/70 focus:bg-black/25
`;

const Agent: FC<object> = () => {
  const themeBus = useThemeInjectFromBus();
  const [providers, setProviders] = useState<string[]>([]);
  const [configs, setConfigs] = useState<AIProviderConfigSnapshot[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [configForm, setConfigForm] = useState<ConfigForm>(defaultConfigForm);
  const [selectedConfigID, setSelectedConfigID] = useState("");
  const [selectedConversationID, setSelectedConversationID] = useState("");
  const [conversation, setConversation] = useState<Nullable<LLMConversationSnapshot>>(null);
  const [input, setInput] = useState("");
  const [streamText, setStreamText] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState("");
  const [runtimeEvents, setRuntimeEvents] = useState<RuntimeEvent[]>([]);
  const [runningRunID, setRunningRunID] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingConfig, setCreatingConfig] = useState(false);
  const [sending, setSending] = useState(false);

  const appendRuntimeEvent = useCallback(
    ({ tone, label, detail }: Omit<RuntimeEvent, "at" | "id">) => {
      setRuntimeEvents((items) =>
        [
          ...items,
          {
            id: crypto.randomUUID(),
            at: Date.now(),
            label,
            detail,
            tone
          }
        ].slice(-50)
      );
    },
    []
  );

  const showAgentError = useCallback((message: string) => {
    AppToast.show({ type: "error", text: message });
  }, []);

  const loadProviders = useCallback(async () => {
    const result = await RendererAgent.listProvider();
    if (!result.ok) {
      showAgentError(result.reason.message);
      return;
    }

    setProviders(result.data);
    setConfigForm((form) => {
      if (form.provider || !result.data[0]) return form;
      return { ...form, provider: result.data[0] };
    });
  }, [showAgentError]);

  const loadConfigs = useCallback(async () => {
    const result = await RendererAgent.listConfigs();
    if (!result.ok) {
      showAgentError(result.reason.message);
      return;
    }

    setConfigs(result.data);
    setSelectedConfigID((current) => current || result.data[0]?.id || "");
  }, [showAgentError]);

  const loadConversations = useCallback(async () => {
    const result = await RendererAgent.listConversations();
    if (!result.ok) {
      showAgentError(result.reason.message);
      return;
    }

    setConversations(result.data);
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
      setStreamText("");
      setPendingUserMessage("");
      setRuntimeEvents([]);
    },
    [showAgentError]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadProviders(), loadConfigs(), loadConversations()]);
    } finally {
      setLoading(false);
    }
  }, [loadConfigs, loadConversations, loadProviders]);

  const createConfig = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setCreatingConfig(true);
      try {
        const baseURL = configForm.baseURL.trim();
        const providerConfig: LLMProviderOpenAIConfig = {
          model: configForm.model.trim(),
          apiKey: configForm.apiKey.trim(),
          apiMode: configForm.apiMode,
          ...(baseURL ? { baseURL } : {})
        };
        const result = await RendererAgent.createConfig({
          id: configForm.id.trim() || undefined,
          name: configForm.name.trim(),
          provider: configForm.provider,
          config: providerConfig
        });
        console.log(result);
        if (!result.ok) {
          showAgentError(result.reason.message);
          return;
        }

        setSelectedConfigID(result.data.id);
        setConfigForm((form) => ({ ...form, apiKey: "" }));
        await loadConfigs();
        AppToast.show({ type: "success", text: "配置已创建" });
      } finally {
        setCreatingConfig(false);
      }
    },
    [configForm, loadConfigs, showAgentError]
  );

  const createConversation = useCallback(async () => {
    const result = await RendererAgent.createConversation(undefined);
    if (!result.ok) {
      showAgentError(result.reason.message);
      return;
    }

    await loadConversations();
    await openConversation(result.data.id);
  }, [loadConversations, openConversation, showAgentError]);

  const removeConversation = useCallback(async () => {
    if (!selectedConversationID) return;
    const result = await RendererAgent.removeConversation(selectedConversationID);
    if (!result.ok) {
      showAgentError(result.reason.message);
      return;
    }

    setSelectedConversationID("");
    setConversation(null);
    setStreamText("");
    setPendingUserMessage("");
    setRuntimeEvents([]);
    await loadConversations();
  }, [loadConversations, selectedConversationID, showAgentError]);

  const submitChat = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const text = input.trim();
      if (!text || !selectedConfigID || !selectedConversationID || runningRunID) return;

      setInput("");
      setSending(true);
      setStreamText("");
      setRuntimeEvents([]);
      setPendingUserMessage(text);

      const result = await RendererAgent.chat({
        input: text,
        configID: selectedConfigID,
        conversationID: selectedConversationID
      });
      setSending(false);

      if (!result.ok) {
        setPendingUserMessage("");
        showAgentError(result.reason.message);
        return;
      }

      setRunningRunID(result.data.runID);
    },
    [input, runningRunID, selectedConfigID, selectedConversationID, showAgentError]
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
          appendRuntimeEvent({
            label: `开始运行 ${event.runID}`,
            tone: "success",
            detail: `config=${event.configID}`
          });
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
          appendRuntimeEvent({ label: `标题：${event.title}`, tone: "success" });
          break;
        case "text_delta":
          setStreamText((text) => text + event.text);
          break;
        case "tool_call":
          appendRuntimeEvent({
            label: `工具调用 step=${event.step}`,
            detail: stringifyToolCalls(event.toolCalls)
          });
          break;
        case "tool_result":
          appendRuntimeEvent({
            label: `工具结果 step=${event.step}`,
            detail: JSON.stringify(event.toolResults, null, 2)
          });
          break;
        case "done":
          setConversation(event.snapshot);
          setSelectedConversationID(event.conversationID);
          setRunningRunID("");
          setStreamText("");
          setPendingUserMessage("");
          appendRuntimeEvent({
            label: `完成：${event.response.finishReason}`,
            tone: "success",
            detail: event.response.usage ? JSON.stringify(event.response.usage, null, 2) : undefined
          });
          void loadConversations();
          break;
        case "aborted":
          setRunningRunID("");
          setStreamText("");
          appendRuntimeEvent({ label: "已停止", tone: "warning" });
          break;
        case "error":
          setRunningRunID("");
          setStreamText("");
          appendRuntimeEvent({
            label: event.error.message,
            tone: "error",
            detail: event.error.type
          });
          showAgentError(event.error.message);
          break;
      }
    },
    [appendRuntimeEvent, loadConversations, showAgentError]
  );

  useEffect(() => {
    document.title = "AiraMusic Agent";
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return RendererWindow.process.listenMessage(
      "message_deliver_agent_chat_event",
      handleAgentChatEvent
    );
  }, [handleAgentChatEvent]);

  const activeConfig = configs.find((config) => config.id === selectedConfigID);
  const messages = conversation?.messages ?? [];
  const disabledSend =
    !input.trim() || !selectedConfigID || !selectedConversationID || !!runningRunID;

  return (
    <div className="relative h-screen w-screen flex flex-col overflow-hidden text-white">
      <div className="fixed inset-0 z-[-1] bg-[#141417]">
        <AcrylicBackground
          blur={60}
          opacity={0.9}
          saturate={2.2}
          brightness={0.35}
          src={themeBus.data?.backgroundCover}
          themeColors={themeBus.data?.theme.themeColors}
          fluid
          fluidPaused
        />
      </div>
      <Drag className="absolute top-0 right-0 left-0 z-10 grid h-10 grid-cols-[1fr_auto_1fr] items-center px-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Bot className="size-4" />
          <span>Agent</span>
        </div>
        <div className="text-[12px] font-medium text-white/55">
          {runningRunID ? "运行中" : loading ? "加载中" : "就绪"}
        </div>
        <Control className="justify-self-end gap-2!" max pin mini />
      </Drag>
      <div className="grid flex-1 grid-cols-[280px_minmax(0,1fr)] gap-3 px-4 pt-12 pb-4">
        <aside className="flex min-h-0 flex-col gap-3">
          <section className="min-h-0 rounded-lg border border-white/10 bg-black/22 p-3 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold">Provider Config</h2>
              <IconButton
                label="刷新配置"
                size="compact"
                icon={RefreshCw}
                disabled={loading}
                onClick={() => void refresh()}
              />
            </div>
            <form className="grid gap-2" onSubmit={createConfig}>
              <label className="grid gap-1 text-[12px] font-medium text-white/65">
                Provider
                <select
                  className={inputClassName}
                  value={configForm.provider}
                  onChange={(event) =>
                    setConfigForm((form) => ({ ...form, provider: event.target.value }))
                  }>
                  {providers.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[12px] font-medium text-white/65">
                API Mode
                <select
                  className={inputClassName}
                  value={configForm.apiMode}
                  onChange={(event) =>
                    setConfigForm((form) => ({
                      ...form,
                      apiMode: event.target.value as LLMProviderOpenAIAPIMode
                    }))
                  }>
                  <option value="chat_completions">Chat Completions</option>
                  <option value="responses">Responses</option>
                </select>
              </label>
              <label className="grid gap-1 text-[12px] font-medium text-white/65">
                Config ID
                <input
                  className={inputClassName}
                  value={configForm.id}
                  onChange={(event) =>
                    setConfigForm((form) => ({ ...form, id: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1 text-[12px] font-medium text-white/65">
                Name
                <input
                  className={inputClassName}
                  value={configForm.name}
                  onChange={(event) =>
                    setConfigForm((form) => ({ ...form, name: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1 text-[12px] font-medium text-white/65">
                Model
                <input
                  className={inputClassName}
                  value={configForm.model}
                  onChange={(event) =>
                    setConfigForm((form) => ({ ...form, model: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1 text-[12px] font-medium text-white/65">
                Base URL
                <input
                  className={inputClassName}
                  value={configForm.baseURL}
                  onChange={(event) =>
                    setConfigForm((form) => ({ ...form, baseURL: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1 text-[12px] font-medium text-white/65">
                API Key
                <input
                  className={inputClassName}
                  type="password"
                  value={configForm.apiKey}
                  onChange={(event) =>
                    setConfigForm((form) => ({ ...form, apiKey: event.target.value }))
                  }
                />
              </label>
              <button
                className="
                  mt-1 inline-flex h-9 items-center justify-center gap-2 rounded-md
                  bg-primary px-3 text-[13px] font-semibold text-primary-text
                  transition-opacity hover:opacity-85 active:scale-98
                  disabled:pointer-events-none disabled:opacity-35
                "
                type="submit"
                disabled={creatingConfig || !configForm.provider || !configForm.apiKey.trim()}>
                <Settings2 className="size-4" />
                创建配置
              </button>
            </form>
          </section>

          <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-white/10 bg-black/22 p-3 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold">Conversations</h2>
              <div className="flex items-center gap-1">
                <IconButton
                  label="新建会话"
                  size="compact"
                  icon={MessageSquarePlus}
                  onClick={() => void createConversation()}
                />
                <IconButton
                  icon={Trash2}
                  label="删除当前会话"
                  size="compact"
                  disabled={!selectedConversationID || !!runningRunID}
                  onClick={() => void removeConversation()}
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {conversations.map((item) => (
                <button
                  key={item.id}
                  className={cx(
                    `
                      w-full rounded-md px-2.5 py-2 text-left text-[13px]
                      transition-colors hover:bg-white/10
                    `,
                    item.id === selectedConversationID && "bg-primary/70 text-primary-text"
                  )}
                  type="button"
                  onClick={() => void openConversation(item.id)}>
                  <span className="block truncate font-medium">{item.name || "未命名会话"}</span>
                  <span className="block truncate text-[11px] opacity-55">{item.id}</span>
                </button>
              ))}
              {conversations.length === 0 && (
                <div className="rounded-md border border-white/10 px-3 py-5 text-center text-[12px] text-white/50">
                  暂无会话
                </div>
              )}
            </div>
          </section>
        </aside>
        <main className="grid min-h-0 grid-cols-[minmax(0,1fr)_240px] gap-3">
          <section className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-black/20 backdrop-blur-xl">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
              <div className="min-w-0">
                <h1 className="truncate text-[14px] font-semibold">
                  {conversation?.name || "Agent Demo"}
                </h1>
                <p className="truncate text-[11px] text-white/45">
                  {activeConfig
                    ? `${activeConfig.name} · ${activeConfig.config.model}`
                    : "未选择配置"}
                </p>
              </div>
              <select
                className={cx(inputClassName, "w-44")}
                value={selectedConfigID}
                onChange={(event) => setSelectedConfigID(event.target.value)}>
                <option value="">选择配置</option>
                {configs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-h-0 flex-1 h-[50%] max-h-120 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((message, index) => (
                <MessageBubble key={`${index}-${message.role}`} message={message} />
              ))}
              {pendingUserMessage && (
                <MessageBubble message={{ role: "user", content: pendingUserMessage }} />
              )}
              {streamText && (
                <MessageBubble message={{ role: "assistant", content: streamText }} streaming />
              )}
              {!messages.length && !pendingUserMessage && !streamText && (
                <div className="flex h-full items-center justify-center">
                  <div className="grid max-w-md gap-3 text-center">
                    <Bot className="mx-auto size-9 text-white/55" />
                    <p className="text-[13px] font-medium text-white/60">
                      创建会话并选择配置后开始测试
                    </p>
                    <button
                      className="
                        mx-auto inline-flex h-9 items-center gap-2 rounded-md
                        border border-white/15 bg-white/10 px-3 text-[13px] font-semibold
                        transition-colors hover:bg-white/15 active:scale-98
                      "
                      type="button"
                      onClick={() => void createConversation()}>
                      <Plus className="size-4" />
                      新建会话
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {DemoPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    className="
                      rounded-md border border-white/10 bg-white/8 px-2 py-1
                      text-[11px] text-white/65 transition-colors hover:bg-white/12
                    "
                    type="button"
                    onClick={() => setInput(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
              <form className="grid grid-cols-[minmax(0,1fr)_auto] gap-2" onSubmit={submitChat}>
                <textarea
                  className="
                    max-h-28 min-h-12 resize-y rounded-md border border-white/12
                    bg-black/20 px-3 py-2 text-[13px] leading-5 outline-none
                    transition-colors placeholder:text-white/35
                    focus:border-primary/70 focus:bg-black/25
                  "
                  value={input}
                  placeholder={selectedConversationID ? "输入消息" : "先创建或选择一个会话"}
                  onChange={(event) => setInput(event.target.value)}
                />
                <div className="flex items-end gap-1">
                  <IconButton
                    label="停止生成"
                    icon={Square}
                    size="normal"
                    show={!!runningRunID}
                    onClick={() => void abortRun()}
                  />
                  <button
                    className="
                      inline-flex h-12 w-12 items-center justify-center rounded-md
                      bg-primary text-primary-text transition-opacity hover:opacity-85
                      active:scale-98 disabled:pointer-events-none disabled:opacity-35
                    "
                    title="发送消息"
                    type="submit"
                    aria-label="发送消息"
                    disabled={disabledSend || sending}>
                    <SendHorizontal className="size-5" />
                  </button>
                </div>
              </form>
            </div>
          </section>
          <aside className="flex min-h-0 flex-col gap-3">
            <section className="rounded-lg  border border-white/10 bg-black/20 p-3 backdrop-blur-xl">
              <h2 className="mb-2 text-[13px] font-semibold">Current</h2>
              <div className="grid gap-2 text-[12px] text-white/60">
                <InfoLine label="Config" value={selectedConfigID || "未选择"} />
                <InfoLine label="Conversation" value={selectedConversationID || "未选择"} />
                <InfoLine label="Run" value={runningRunID || "空闲"} />
              </div>
            </section>

            <section className="flex min-h-0   flex-1 overflow-y-auto flex-col rounded-lg border border-white/10 bg-black/20 p-3 backdrop-blur-xl">
              <h2 className="mb-2 shrink-0 text-[13px] font-semibold">Events</h2>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {runtimeEvents.map((event) => (
                  <div
                    key={event.id}
                    className={cx(
                      "rounded-md border bg-white/7 px-2.5 py-2 text-[12px]",
                      event.tone === "error"
                        ? "border-red-300/25 text-red-100"
                        : event.tone === "success"
                          ? "border-emerald-300/25 text-emerald-100"
                          : event.tone === "warning"
                            ? "border-amber-300/25 text-amber-100"
                            : "border-white/10 text-white/70"
                    )}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{event.label}</span>
                      <span className="shrink-0 text-[10px] opacity-50">
                        {formatTime(event.at)}
                      </span>
                    </div>
                    {event.detail && (
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-black/25 p-2 text-[11px] leading-4 text-white/65">
                        {event.detail}
                      </pre>
                    )}
                  </div>
                ))}
                {runtimeEvents.length === 0 && (
                  <div className="rounded-md border border-white/10 px-3 py-5 text-center text-[12px] text-white/45">
                    暂无事件
                  </div>
                )}
              </div>
            </section>
          </aside>
        </main>
      </div>
      <AppToast.Provider className="top-12 z-50" />
    </div>
  );
};

const InfoLine: FC<{ label: string; value: string }> = memo(({ label, value }) => (
  <div className="grid gap-0.5">
    <span className="text-[11px] text-white/35">{label}</span>
    <span className="truncate font-medium text-white/75">{value}</span>
  </div>
));

const MessageBubble: FC<{ message: LLMMessage; streaming?: boolean }> = memo(
  ({ message, streaming }) => {
    const isUser = message.role === "user";
    const toolCalls = getToolCalls(message);

    return (
      <div className={cx("flex", isUser ? "justify-end" : "justify-start")}>
        <div
          className={cx(
            "max-w-[78%] rounded-lg border px-3 py-2 text-[13px] leading-5 shadow-sm",
            isUser
              ? "border-primary/40 bg-primary/75 text-primary-text"
              : message.role === "tool"
                ? "border-amber-300/20 bg-amber-300/10 text-amber-50"
                : "border-white/10 bg-white/9 text-white/82"
          )}>
          <div className="mb-1 text-[11px] font-semibold opacity-55">
            {message.role === "tool"
              ? `tool · ${message.name}`
              : isUser
                ? "user"
                : streaming
                  ? "assistant · streaming"
                  : "assistant"}
          </div>
          {"content" in message && message.content && (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          )}
          {message.role === "tool" && (
            <div className="mt-1 truncate text-[11px] opacity-55">{message.callID}</div>
          )}
          {toolCalls.length > 0 && (
            <div className="mt-2 grid gap-1">
              {toolCalls.map((call) => (
                <div
                  key={call.callID}
                  className="rounded-md border border-white/10 bg-black/22 px-2 py-1.5">
                  <div className="truncate text-[12px] font-semibold">{call.name}</div>
                  <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words text-[11px] opacity-65">
                    {call.arguments}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

const getToolCalls = (message: LLMMessage): LLMToolCall[] => {
  if (message.role === "assistant" && "toolCalls" in message) return message.toolCalls;
  return [];
};

const stringifyToolCalls = (toolCalls: LLMToolCall[]) => {
  return JSON.stringify(
    toolCalls.map((call) => ({
      name: call.name,
      callID: call.callID,
      arguments: call.arguments
    })),
    null,
    2
  );
};

const formatTime = (time: number) => {
  return new Date(time).toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
};

export default memo(Agent);
