import {
  memo,
  useRef,
  type FC,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode
} from "react";
import {
  Plus,
  Music2,
  KeyRound,
  Sparkles,
  ArrowDown,
  LoaderCircle,
  MessageSquarePlus
} from "lucide-react";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { NeteaseNetworkImage } from "@/common/netease/models";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import RendererImageConstants from "@/common/constants/image";
import NeteaseImage from "@/common/components/display/image/netease-image";
import type { LucideIcon } from "lucide-react";
import type { MessageData } from "@mahiru/ipc/types";
import type { MessageSnapshot, ThreadSnapshot } from "@mahiru/agent/browser";

import ToolStep from "./tool-step";
import ThinkContent from "./think-content";
import { RunTerminalCard } from "./turn-observability";
import { parseAgentTurnUsage } from "./observability";
import ContentItem, { AssistantTurnGroup } from "./content-item";
import type {
  AgentRunTerminal,
  AgentLiveReasoning,
  AgentLiveTimelineItem,
  AgentToolTimelineItem,
  AgentAssistantTurnObservability
} from "../types";

type ChatMessageTimelineItem = {
  id: string;
  runID?: string;
  type: "message";
  streaming?: boolean;
  message: Pick<MessageSnapshot, "role" | "content">;
  assistantTurn?: AgentAssistantTurnObservability;
};

type ChatTimelineItem =
  | AgentRunTerminal
  | AgentLiveReasoning
  | AgentToolTimelineItem
  | ChatMessageTimelineItem;

type AssistantContentTimelineItem =
  | AgentLiveReasoning
  | AgentToolTimelineItem
  | ChatMessageTimelineItem;

type AssistantTimelineItem = AgentRunTerminal | AssistantContentTimelineItem;

type AssistantTimelineGroup = {
  id: string;
  runID?: string;
  type: "assistant-group";
  items: AssistantTimelineItem[];
};

type ChatRenderableTimelineItem = ChatTimelineItem | AssistantTimelineGroup;

interface ChatContentProps {
  running: boolean;
  streamText: string;
  configured: boolean;
  recovering: boolean;
  runningRunID: string;
  hasConversation: boolean;
  pendingUserMessage: string;
  liveTimeline: AgentLiveTimelineItem[];
  conversation: Nullable<ThreadSnapshot>;
  onCreateConfig: NormalFunc;
  onCreateConversation: NormalFunc;
  onSubmitPrompt: NormalFunc<[text: string], Promise<boolean>>;
}

const ChatContent: FC<ChatContentProps> = ({
  onCreateConfig,
  onSubmitPrompt,
  onCreateConversation,
  running,
  configured,
  recovering,
  streamText,
  conversation,
  liveTimeline,
  runningRunID,
  hasConversation,
  pendingUserMessage
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stayAtBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  useScrollAutoHide(scrollRef, 700);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const currentTrack = trackMetaBus.data?.track;
  const lastLiveItem = liveTimeline.at(-1);
  const waitingForModel =
    running &&
    !recovering &&
    !(lastLiveItem?.type === "tool" && lastLiveItem.status === "running") &&
    !(lastLiveItem?.type === "reasoning" && lastLiveItem.status === "streaming");
  const timeline = useMemo(() => {
    const liveItems = buildLiveTimeline(liveTimeline, streamText, waitingForModel, runningRunID);
    const liveItemIDs = new Set(liveItems.map((item) => item.id));
    const items = buildTimeline(conversation).filter((item) => !liveItemIDs.has(item.id));
    const pendingMessageAlreadyPersisted =
      !!runningRunID && conversation?.runtime.runId === runningRunID;
    if (pendingUserMessage && !pendingMessageAlreadyPersisted) {
      items.push({
        id: `pending-user-${runningRunID || "message"}`,
        type: "message",
        message: { role: "user", content: pendingUserMessage }
      });
    }
    items.push(...liveItems);
    return groupAssistantTimeline(items);
  }, [conversation, liveTimeline, pendingUserMessage, runningRunID, streamText, waitingForModel]);
  const empty = !timeline.length && !recovering && !running;

  useEffect(() => {
    RendererIPCMessageBus.updater.deliver("track-meta", "main");
  }, []);

  const updateScrollState = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const scrollingUp = container.scrollTop < lastScrollTopRef.current - 1;
    const nearBottom = distanceToBottom <= 2 || (!scrollingUp && distanceToBottom < 112);
    lastScrollTopRef.current = container.scrollTop;
    stayAtBottomRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom);
  }, []);

  const scrollToLatest = useCallback((behavior?: ScrollBehavior) => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior });
  }, []);

  const jumpToLatest = useCallback(() => {
    stayAtBottomRef.current = true;
    setShowJumpToLatest(false);
    scrollToLatest("smooth");
  }, [scrollToLatest]);

  useEffect(() => {
    if (!stayAtBottomRef.current) return;
    scrollToLatest();
  }, [
    timeline.length,
    pendingUserMessage,
    liveTimeline.length,
    streamText,
    running,
    scrollToLatest
  ]);

  useEffect(() => {
    const container = scrollRef.current;
    const content = container?.firstElementChild;
    if (empty || !(content instanceof HTMLElement) || typeof ResizeObserver === "undefined") {
      return;
    }

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (stayAtBottomRef.current) scrollToLatest();
      });
    });
    observer.observe(content);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [empty, scrollToLatest]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        className="agent-scroll h-full overflow-y-auto overscroll-contain px-3 py-3.5 pb-6 scroll-pb-24 sm:px-4 sm:py-4"
        onScroll={updateScrollState}>
        {empty ? (
          <EmptyWorkspace
            configured={configured}
            currentTrack={currentTrack}
            hasConversation={hasConversation}
            onCreateConfig={onCreateConfig}
            onSubmitPrompt={onSubmitPrompt}
            onCreateConversation={onCreateConversation}
          />
        ) : (
          <div className="mx-auto flex w-full max-w-[min(100%,44rem)] flex-col gap-3.5">
            {timeline.map(renderTimelineItem)}
            {recovering && !streamText && (
              <div
                className="flex items-center gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--theme-color-main)_16%,transparent)] bg-[color-mix(in_srgb,var(--theme-color-main)_5%,transparent)] px-3 py-2.5 text-[11px] text-white/48"
                role="status">
                <LoaderCircle className="size-3.5 shrink-0 animate-spin text-[color-mix(in_srgb,var(--theme-color-main)_70%,white)]" />
                <div className="min-w-0">
                  <div className="font-semibold text-white/62">正在重新连接运行中的对话</div>
                  <div className="mt-0.5 text-[10px] text-white/32">
                    完成后会自动同步完整消息，不会重复提交你的问题。
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      {showJumpToLatest && !empty && (
        <button
          className="
            absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 cursor-pointer
            items-center gap-1.5 rounded-full border border-white/13 bg-black/55 px-3 py-1.5
            text-[11px] font-semibold text-white/72 shadow-lg shadow-black/20 backdrop-blur-xl
            outline-none transition-colors hover:bg-black/72 focus-visible:ring-2
            focus-visible:ring-white/45
          "
          type="button"
          onClick={jumpToLatest}>
          <ArrowDown className="size-3.5" />
          跳到最新
        </button>
      )}
    </div>
  );
};

const renderTimelineItem = (item: ChatRenderableTimelineItem) => {
  if (item.type === "assistant-group") {
    const terminalHasUsage = item.items.some(
      (candidate) => candidate.type === "terminal" && !!candidate.usage
    );
    const assistantTurn = terminalHasUsage ? undefined : findLastAssistantTurn(item.items);
    const copyItemIndex = findLastCopyableMessageIndex(item.items);
    const streaming = item.items.some(
      (candidate) =>
        (candidate.type === "message" && candidate.streaming) ||
        (candidate.type === "reasoning" && candidate.status === "streaming")
    );
    return (
      <AssistantTurnGroup
        key={item.id}
        runID={item.runID}
        streaming={streaming}
        assistantTurn={assistantTurn}>
        {item.items.map((child, index) => {
          if (child.type === "message") {
            return (
              <ContentItem
                key={child.id}
                message={child.message}
                streaming={child.streaming}
                showCopy={index === copyItemIndex}
                grouped
              />
            );
          }
          if (child.type === "tool") {
            return (
              <ToolStep
                key={child.id}
                item={stripAssistantTurn(child)}
                autoCollapse={!streaming && child.status !== "running"}
                collapseEnabled={!streaming && child.status !== "running"}
              />
            );
          }
          if (child.type === "reasoning") {
            return (
              <ThinkContent
                key={child.id}
                content={child.text}
                closed={child.status === "done"}
                streaming={child.status === "streaming"}
              />
            );
          }
          return <RunTerminalCard key={child.id} terminal={child} />;
        })}
      </AssistantTurnGroup>
    );
  }
  if (item.type === "reasoning") {
    return (
      <ThinkContent
        key={item.id}
        content={item.text}
        closed={item.status === "done"}
        streaming={item.status === "streaming"}
      />
    );
  }
  if (item.type === "message") {
    return (
      <ContentItem
        key={item.id}
        message={item.message}
        streaming={item.streaming}
        assistantTurn={item.assistantTurn}
      />
    );
  }
  if (item.type === "tool") return <ToolStep key={item.id} item={item} />;
  return <RunTerminalCard key={item.id} terminal={item} />;
};

const findLastAssistantTurn = (items: AssistantTimelineItem[]) => {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    if (item?.type === "message" && item.assistantTurn) return item.assistantTurn;
    if (item?.type === "tool" && item.assistantTurn) return item.assistantTurn;
  }
  return undefined;
};

const findLastCopyableMessageIndex = (items: AssistantTimelineItem[]) => {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    if (item?.type === "message" && item.message.content?.trim()) return index;
  }
  return -1;
};

const stripAssistantTurn = (item: AgentToolTimelineItem): AgentToolTimelineItem => ({
  id: item.id,
  type: item.type,
  status: item.status,
  toolCalls: item.toolCalls,
  toolResults: item.toolResults,
  ...(item.runID ? { runID: item.runID } : {}),
  ...(item.step !== undefined ? { step: item.step } : {})
});

const EmptyWorkspace: FC<{
  configured: boolean;
  hasConversation: boolean;
  onCreateConfig: NormalFunc;
  onCreateConversation: NormalFunc;
  onSubmitPrompt: NormalFunc<[text: string], Promise<boolean>>;
  currentTrack: Nullable<MessageData<"bus_deliver_track_meta">["track"]>;
}> = ({
  onCreateConfig,
  onSubmitPrompt,
  onCreateConversation,
  configured,
  currentTrack,
  hasConversation
}) => {
  const cover = useMemo(
    () =>
      currentTrack
        ? NeteaseNetworkImage.fromURL(currentTrack.detail.al.picUrl)?.setSize(
            RendererImageConstants.HomePageTrackCoverSize
          )
        : null,
    [currentTrack]
  );
  const prompts = currentTrack
    ? [
        `介绍一下正在播放的《${currentTrack.name}》`,
        "分析当前歌曲的歌词和情绪",
        "找几首和当前歌曲相似的歌",
        "这首歌适合加入什么类型的歌单？"
      ]
    : [
        "根据我的播放历史推荐几首歌",
        "看看最近有什么值得听的新歌",
        "打开今日音乐热搜",
        "帮我整理一个工作专注歌单"
      ];

  if (!configured) {
    return (
      <EmptyStateFrame icon={KeyRound} title="先接入一个模型" eyebrow="MODEL SETUP">
        <p className="max-w-sm text-[12px] leading-5 text-white/45">
          API Key 仅交给主进程保存。配置完成后，Agent 才能搜索音乐、读取歌词并操作播放器。
        </p>
        <PrimaryAction icon={Plus} label="创建模型配置" onClick={onCreateConfig} />
      </EmptyStateFrame>
    );
  }

  if (!hasConversation) {
    return (
      <EmptyStateFrame title="创建一段新对话" eyebrow="NEW SESSION" icon={MessageSquarePlus}>
        <p className="max-w-sm text-[12px] leading-5 text-white/45">
          每段对话独立保存上下文。你可以随时从左侧切换，运行中的任务也不会被打断。
        </p>
        <PrimaryAction label="新建对话" icon={MessageSquarePlus} onClick={onCreateConversation} />
      </EmptyStateFrame>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[44rem] items-center py-4">
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(17rem,1.08fr)] lg:items-end">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.16em] text-[color-mix(in_srgb,var(--theme-color-main)_62%,white)]">
            <span className="size-1 rounded-full bg-[color-mix(in_srgb,var(--theme-color-main)_80%,white)]" />
            从此刻开始
          </div>
          <h2 className="mt-2.5 max-w-md text-[1.75rem] leading-[1.08] font-semibold tracking-[-0.03em] text-white/92 sm:text-[1.9rem]">
            从正在听的音乐开始
          </h2>
          <p className="mt-3 max-w-md text-[11.5px] leading-5.5 text-white/42">
            我可以读取 AiraMusic 当前状态、搜索站内音乐，也可以在需要时浏览公开网页。
          </p>

          {currentTrack && (
            <div className="mt-5 flex min-w-0 items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.035] p-2 backdrop-blur-xl transition-colors hover:border-[color-mix(in_srgb,var(--theme-color-main)_22%,transparent)]">
              <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-black/20 ring-1 ring-[color-mix(in_srgb,var(--theme-color-main)_18%,transparent)]">
                {cover ? (
                  <NeteaseImage
                    className="size-full rounded-lg"
                    cache={true}
                    image={cover}
                    shadow="none"
                    preview={false}
                    cacheLazy={false}
                    title={currentTrack.name}
                  />
                ) : (
                  <div className="grid size-full place-items-center">
                    <Music2 className="size-5 text-white/35" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[8px] font-semibold tracking-[0.12em] text-[color-mix(in_srgb,var(--theme-color-main)_52%,white)]">
                  正在播放
                </div>
                <div className="mt-0.5 truncate text-[12px] font-medium text-white/84">
                  {currentTrack.name}
                </div>
                <div className="mt-0.5 truncate text-[10px] text-white/38">
                  {currentTrack.detail.ar.map((artist) => artist.name).join(" / ") || "未知艺人"}
                </div>
              </div>
              <Sparkles className="mr-1 size-4 shrink-0 text-primary" />
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <div className="mb-0.5 text-[9px] font-semibold tracking-[0.1em] text-white/30 sm:col-span-2 lg:col-span-1">
            可以这样问
          </div>
          {prompts.map((prompt, index) => (
            <button
              key={prompt}
              className="
                group flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl border
                border-white/7 bg-black/10 px-3 py-2 text-left text-[11px] leading-4
                text-white/58 outline-none transition-all duration-200
                hover:border-[color-mix(in_srgb,var(--theme-color-main)_26%,transparent)]
                hover:bg-[color-mix(in_srgb,var(--theme-color-main)_7%,transparent)]
                hover:text-white/84 focus-visible:ring-2 focus-visible:ring-white/45
              "
              type="button"
              onClick={() => void onSubmitPrompt(prompt)}>
              <span className="text-[9px] font-bold tabular-nums text-[color-mix(in_srgb,var(--theme-color-main)_38%,white)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">{prompt}</span>
              <ArrowDown className="size-3.5 shrink-0 -rotate-90 text-[color-mix(in_srgb,var(--theme-color-main)_62%,white)] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const EmptyStateFrame: FC<{
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  children: ReactNode;
}> = ({ title, eyebrow, children, icon: Icon }) => (
  <div className="grid h-full place-items-center py-6">
    <div className="grid max-w-md justify-items-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--theme-color-main)_12%,transparent)] text-[color-mix(in_srgb,var(--theme-color-main)_72%,white)] ring-1 ring-[color-mix(in_srgb,var(--theme-color-main)_20%,transparent)]">
        <Icon className="size-5.5" />
      </div>
      <div>
        <div className="text-[9px] font-bold tracking-[0.2em] text-[color-mix(in_srgb,var(--theme-color-main)_48%,white)]">
          {eyebrow}
        </div>
        <h2 className="mt-1.5 text-xl font-bold tracking-[-0.025em] text-white/88">{title}</h2>
      </div>
      {children}
    </div>
  </div>
);

const PrimaryAction: FC<{
  label: string;
  icon: LucideIcon;
  onClick: NormalFunc;
}> = ({ onClick, label, icon: Icon }) => (
  <button
    className="
      inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-primary px-3.5
      text-[12px] font-semibold text-primary-text outline-none transition-opacity hover:opacity-85
      focus-visible:ring-2 focus-visible:ring-white/50
    "
    type="button"
    onClick={() => onClick()}>
    <Icon className="size-4" />
    {label}
  </button>
);

const buildTimeline = (conversation: Nullable<ThreadSnapshot>): ChatTimelineItem[] => {
  const items: ChatTimelineItem[] = [];
  const consumed = new Set<number>();
  const messages = conversation?.messages ?? [];

  for (let index = 0; index < messages.length; index++) {
    if (consumed.has(index)) continue;

    const message = messages[index];
    if (!message) continue;
    if (message.role === "inner") {
      if (message.innerType === "usage") {
        const parsed = parseStoredTurnUsage(message.content);
        if (parsed) attachTurnUsage(items, parsed);
      }
      continue;
    }
    if (message.role === "system") continue;
    const assistantItemPrefix = `assistant-${index}`;

    if (message.role === "assistant" && message.reasoningContent?.trim()) {
      items.push({
        id: `${assistantItemPrefix}-reasoning`,
        type: "reasoning",
        status: "done",
        step: index + 1,
        messageID: `${assistantItemPrefix}-reasoning`,
        text: message.reasoningContent
      });
    }

    if (message.role === "tool") {
      const callID = message.toolCallId ?? `unknown-${index}`;
      items.push({
        id: `tool-result-${index}-${callID}`,
        type: "tool",
        status: "done",
        toolCalls: [],
        toolResults: [
          {
            name: "tool",
            callID,
            output: message.content
          }
        ]
      });
      continue;
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      if (message.content) {
        items.push({
          id: `${assistantItemPrefix}-assistant`,
          type: "message",
          message: { role: "assistant", content: message.content ?? "" }
        });
      }

      const calls = message.toolCalls.map((call) => ({
        name: call.name,
        callID: call.id,
        arguments: JSON.stringify(call.args)
      }));
      const callIDs = new Set(calls.map((call) => call.callID));
      const toolResultsByCallID = new Map<
        string,
        { name: string; callID: string; output: string }
      >();
      messages.slice(index + 1).forEach((candidate, offset) => {
        const callID = candidate.toolCallId;
        if (candidate.role !== "tool" || !callID || !callIDs.has(callID)) return;
        consumed.add(index + offset + 1);
        const call = calls.find((item) => item.callID === callID);
        toolResultsByCallID.set(callID, {
          name: call?.name ?? "tool",
          callID,
          output: candidate.content
        });
      });
      const toolResults = calls.flatMap((call) => {
        const result = toolResultsByCallID.get(call.callID);
        return result ? [result] : [];
      });
      const allToolCallsResolved = calls.every((call) => toolResultsByCallID.has(call.callID));

      items.push({
        id: `${assistantItemPrefix}-tool`,
        type: "tool",
        status: allToolCallsResolved
          ? "done"
          : conversation?.runtime.status === "failed"
            ? "error"
            : "running",
        toolCalls: calls,
        toolResults
      });
      continue;
    }

    items.push({
      id:
        message.role === "assistant"
          ? `${assistantItemPrefix}-assistant`
          : `${message.role}-${index}`,
      type: "message",
      message: { role: message.role, content: message.content }
    });
  }

  return items;
};

const parseStoredTurnUsage = (content: string) => {
  try {
    return parseAgentTurnUsage(JSON.parse(content) as unknown);
  } catch {
    return undefined;
  }
};

const attachTurnUsage = (
  items: ChatTimelineItem[],
  turn: Pick<AgentAssistantTurnObservability, "step" | "usage">
) => {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    if (!item || (item.type === "message" && item.message.role === "user")) return;
    if (item.type === "terminal") {
      items[index] = { ...item, usage: turn.usage };
      return;
    }
    if (item.type === "message" || item.type === "tool") {
      items[index] = {
        ...item,
        assistantTurn: {
          ...turn,
          status: "complete"
        }
      };
      return;
    }
  }
};

const buildLiveTimeline = (
  items: AgentLiveTimelineItem[],
  streamText: string,
  waitingForModel: boolean,
  runningRunID: string
): ChatTimelineItem[] => {
  const timeline = items.map<ChatTimelineItem>((item) => {
    if (item.type === "assistant") {
      return {
        id: item.id,
        type: "message",
        message: { role: "assistant", content: item.text },
        ...(item.runID ? { runID: item.runID } : {})
      };
    }
    if (item.type === "tool") {
      return {
        ...item,
        toolResults: item.toolResults ?? []
      };
    }
    return item;
  });
  if (!streamText && !waitingForModel) return timeline;

  const inferredRunID = [...items].reverse().find((item) => item.runID)?.runID;
  const streamRunID = runningRunID || inferredRunID;
  timeline.push({
    id: `${streamRunID || "active"}-stream-assistant`,
    type: "message",
    streaming: true,
    message: { role: "assistant", content: streamText },
    ...(streamRunID ? { runID: streamRunID } : {})
  });
  return timeline;
};

const groupAssistantTimeline = (items: ChatTimelineItem[]): ChatRenderableTimelineItem[] => {
  const grouped: ChatRenderableTimelineItem[] = [];
  let activeGroup: undefined | AssistantTimelineGroup;

  for (const item of items) {
    if (item.type === "terminal") {
      if (activeGroup && item.runID && activeGroup.runID === item.runID) {
        activeGroup.items.push(item);
      } else {
        grouped.push(item);
      }
      activeGroup = undefined;
      continue;
    }

    if (!isAssistantContentTimelineItem(item)) {
      grouped.push(item);
      activeGroup = undefined;
      continue;
    }

    const runID = item.runID ?? (item.type === "reasoning" ? undefined : item.assistantTurn?.runID);
    const belongsToActiveGroup =
      !!activeGroup && (runID ? activeGroup.runID === runID : activeGroup.runID === undefined);
    if (belongsToActiveGroup && activeGroup) {
      activeGroup.items.push(item);
      continue;
    }

    activeGroup = {
      items: [item],
      type: "assistant-group",
      id: runID ? `${runID}-assistant-group` : `assistant-group-${item.id}`,
      ...(runID ? { runID } : {})
    };
    grouped.push(activeGroup);
  }

  return grouped;
};

const isAssistantContentTimelineItem = (
  item: ChatTimelineItem
): item is AssistantContentTimelineItem =>
  item.type === "reasoning" ||
  item.type === "tool" ||
  (item.type === "message" && item.message.role === "assistant");

export default memo(ChatContent);
