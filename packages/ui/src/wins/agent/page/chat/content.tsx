import { Bot, MessageSquarePlus } from "lucide-react";
import { memo, useRef, type FC, useMemo, useEffect } from "react";
import { useUser } from "@/common/store/user";
import { NeteaseNetworkImage } from "@/common/netease/models";
import RendererImageConstants from "@/common/constants/image";
import type { LLMMessage, LLMMessageText } from "@mahiru/ai";

import ToolStep from "./tool-step";
import ContentItem from "./content-item";
import type { AgentLiveTimelineItem, AgentToolTimelineItem } from "../types";

type ChatTimelineItem =
  | AgentToolTimelineItem
  | {
      id: string;
      type: "message";
      message: LLMMessageText;
    };

interface ChatContentProps {
  running: boolean;
  streamText: string;
  messages: LLMMessage[];
  pendingUserMessage: string;
  liveTimeline: AgentLiveTimelineItem[];
  onCreateConversation: NormalFunc;
}

const ChatContent: FC<ChatContentProps> = ({
  onCreateConversation,
  running,
  messages,
  streamText,
  liveTimeline,
  pendingUserMessage
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const user = useUser();
  const timeline = useMemo(() => buildTimeline(messages), [messages]);
  const userName = user?.isLoggedIn ? user.profile.nickname : "你";
  const userAvatar = useMemo(
    () =>
      user?.isLoggedIn
        ? NeteaseNetworkImage.fromUserAvatar(user)?.setSize(
            RendererImageConstants.TopMiniAvatarSize
          )
        : null,
    [user]
  );
  const lastLiveItem = liveTimeline.at(-1);
  const waitingForModel =
    running && !(lastLiveItem?.type === "tool" && lastLiveItem.status === "running");
  const empty =
    !timeline.length && !pendingUserMessage && !liveTimeline.length && !streamText && !running;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [timeline.length, pendingUserMessage, liveTimeline.length, streamText, running]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar scrollbar-show">
      {empty ? (
        <div className="grid h-full place-items-center">
          <div className="grid max-w-md gap-3 text-center">
            <Bot className="mx-auto size-10 text-white/50" />
            <div className="grid gap-1">
              <p className="text-[14px] font-bold text-white/70">开始一段 Agent 对话</p>
              <p className="text-[12px] leading-5 text-white/45">
                选择模型配置后，新建对话即可让 Agent 读取当前音乐上下文并调用工具。
              </p>
            </div>
            <button
              className="
                mx-auto inline-flex h-9 cursor-pointer items-center gap-2 rounded-md
                border border-white/15 bg-white/10 px-3 text-[13px] font-semibold
                transition-all hover:bg-white/15 active:scale-96
              "
              type="button"
              onClick={onCreateConversation}>
              <MessageSquarePlus className="size-4" />
              新建对话
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          {timeline.map((item) =>
            item.type === "message" ? (
              <ContentItem
                key={item.id}
                userName={userName}
                message={item.message}
                userAvatar={userAvatar}
              />
            ) : (
              <ToolStep key={item.id} item={item} />
            )
          )}
          {pendingUserMessage && (
            <ContentItem
              userName={userName}
              userAvatar={userAvatar}
              message={{ role: "user", content: pendingUserMessage }}
            />
          )}
          {liveTimeline.map((item) =>
            item.type === "assistant" ? (
              <ContentItem
                key={item.id}
                userName={userName}
                userAvatar={userAvatar}
                message={{ role: "assistant", content: item.text }}
              />
            ) : (
              <ToolStep
                key={item.id}
                item={{
                  ...item,
                  toolResults: item.toolResults ?? []
                }}
              />
            )
          )}
          {(streamText || waitingForModel) && (
            <ContentItem
              userName={userName}
              userAvatar={userAvatar}
              message={{ role: "assistant", content: streamText }}
              streaming
            />
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};

const buildTimeline = (messages: LLMMessage[]): ChatTimelineItem[] => {
  const items: ChatTimelineItem[] = [];
  const consumed = new Set<number>();

  for (let index = 0; index < messages.length; index++) {
    if (consumed.has(index)) continue;

    const message = messages[index];
    if (!message) continue;
    if (message.role === "tool") {
      items.push({
        id: `tool-result-${index}-${message.callID}`,
        type: "tool",
        status: "done",
        toolCalls: [],
        toolResults: [
          {
            name: message.name,
            callID: message.callID,
            output: message.content
          }
        ]
      });
      continue;
    }

    if (message.role === "assistant" && "toolCalls" in message) {
      if (message.content) {
        items.push({
          id: `assistant-${index}`,
          type: "message",
          message: { role: "assistant", content: message.content }
        });
      }

      const callIDs = new Set(message.toolCalls.map((call) => call.callID));
      const toolResults = messages.slice(index + 1).flatMap((candidate, offset) => {
        if (candidate.role !== "tool" || !callIDs.has(candidate.callID)) return [];
        consumed.add(index + offset + 1);
        return {
          name: candidate.name,
          callID: candidate.callID,
          output: candidate.content
        };
      });

      items.push({
        id: `tool-call-${index}-${message.toolCalls.map((call) => call.callID).join("-")}`,
        type: "tool",
        status: toolResults.length >= message.toolCalls.length ? "done" : "running",
        toolCalls: message.toolCalls,
        toolResults
      });
      continue;
    }

    items.push({
      id: `${message.role}-${index}`,
      type: "message",
      message: message as LLMMessageText
    });
  }

  return items;
};

export default memo(ChatContent);
