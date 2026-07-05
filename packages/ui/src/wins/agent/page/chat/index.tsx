import { cx } from "@emotion/css";
import { Bot } from "lucide-react";
import { memo, type FC } from "react";
import type { LLMConversationSnapshot, AIProviderConfigSnapshot } from "@mahiru/ai";

import ChatInput from "./input";
import ChatContent from "./content";
import type { AgentLiveTimelineItem } from "../types";

interface ChatProps {
  sending?: boolean;
  className?: string;
  streamText: string;
  runningRunID: string;
  loadingConfigs?: boolean;
  selectedConfigID: string;
  pendingUserMessage: string;
  configs: AIProviderConfigSnapshot[];
  liveTimeline: AgentLiveTimelineItem[];
  conversation: Nullable<LLMConversationSnapshot>;
  activeConfig: Undefinable<AIProviderConfigSnapshot>;
  onAbort: NormalFunc;
  onCreateConfig: NormalFunc;
  onRefreshConfigs: NormalFunc;
  onCreateConversation: NormalFunc;
  onSelectConfig: NormalFunc<[id: string]>;
  onSubmit: NormalFunc<[text: string], Promise<boolean>>;
}

const Chat: FC<ChatProps> = ({
  className,
  onAbort,
  onSubmit,
  onCreateConfig,
  onSelectConfig,
  onRefreshConfigs,
  onCreateConversation,
  configs,
  sending,
  streamText,
  activeConfig,
  conversation,
  liveTimeline,
  runningRunID,
  loadingConfigs,
  selectedConfigID,
  pendingUserMessage
}) => {
  const messages = conversation?.messages ?? [];

  return (
    <section className={cx("surface-1 flex min-h-0 flex-col rounded-lg", className)}>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-bold">{conversation?.name || "新对话"}</h2>
          <p className="truncate text-[11px] text-white/45">
            {activeConfig
              ? `${activeConfig.name} · ${activeConfig.config.model}`
              : "未选择模型配置"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-md border border-white/10 bg-white/8 px-2.5 py-1.5 text-[12px] text-white/60">
          <Bot className="size-4" />
          <span>{runningRunID ? "运行中" : activeConfig ? "就绪" : "待配置"}</span>
        </div>
      </header>
      <ChatContent
        messages={messages}
        streamText={streamText}
        running={!!runningRunID}
        liveTimeline={liveTimeline}
        pendingUserMessage={pendingUserMessage}
        onCreateConversation={onCreateConversation}
      />
      <ChatInput
        configs={configs}
        sending={sending}
        activeConfig={activeConfig}
        runningRunID={runningRunID}
        loadingConfigs={loadingConfigs}
        selectedConfigID={selectedConfigID}
        selectedConversationID={conversation?.id ?? ""}
        onAbort={onAbort}
        onSubmit={onSubmit}
        onCreateConfig={onCreateConfig}
        onSelectConfig={onSelectConfig}
        onRefreshConfigs={onRefreshConfigs}
      />
    </section>
  );
};

export default memo(Chat);
