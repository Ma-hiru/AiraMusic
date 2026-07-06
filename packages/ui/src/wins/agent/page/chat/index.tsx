import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { Bot, Circle } from "lucide-react";
import { useConversation } from "@/wins/agent/hooks/use-conversation";
import type { AIProviderConfigSnapshot } from "@mahiru/ai";

import ChatInput from "./input";
import ChatContent from "./content";

interface ChatProps {
  className?: string;
  conversationID: string;
  loadingConfigs?: boolean;
  selectedConfigID: string;
  configs: AIProviderConfigSnapshot[];
  activeConfig: Undefinable<AIProviderConfigSnapshot>;
  onCreateConfig: NormalFunc;
  onRefreshConfigs: NormalFunc;
  onCreateConversation: NormalFunc;
  onSelectConfig: NormalFunc<[id: string]>;
}

const Chat: FC<ChatProps> = ({
  className,
  onCreateConfig,
  onSelectConfig,
  onRefreshConfigs,
  onCreateConversation,
  configs,
  activeConfig,
  conversationID,
  loadingConfigs,
  selectedConfigID
}) => {
  const {
    abort,
    submit,
    sending,
    recovering,
    streamText,
    conversation,
    liveTimeline,
    runningRunID,
    pendingUserMessage
  } = useConversation(conversationID);
  const messages = conversation?.messages ?? [];

  const statusText = recovering
    ? "恢复中"
    : runningRunID
      ? "运行中"
      : activeConfig
        ? "就绪"
        : "待配置";

  return (
    <section
      className={cx(
        `
          flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/12
          bg-black/18 shadow-2xl shadow-black/18 backdrop-blur-2xl backdrop-saturate-150
        `,
        className
      )}>
      <header className="flex h-13 shrink-0 items-center justify-between gap-3 border-b border-white/8 bg-white/6 px-4">
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-bold leading-5">
            {conversation?.name || "新对话"}
          </h2>
          <p className="truncate text-[11px] leading-4 text-white/46">
            {activeConfig
              ? `${activeConfig.name} · ${activeConfig.config.model}`
              : "未选择模型配置"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[12px] font-semibold text-white/58">
          <Bot className="size-4 opacity-70" />
          <Circle
            className={cx(
              "size-2 fill-current",
              runningRunID || recovering
                ? "text-primary"
                : activeConfig
                  ? "text-emerald-200/75"
                  : "text-white/32"
            )}
          />
          <span>{statusText}</span>
        </div>
      </header>
      <ChatContent
        messages={messages}
        recovering={recovering}
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
        selectedConversationID={conversationID}
        onAbort={abort}
        onSubmit={submit}
        onCreateConfig={onCreateConfig}
        onSelectConfig={onSelectConfig}
        onRefreshConfigs={onRefreshConfigs}
      />
    </section>
  );
};

export default memo(Chat);
