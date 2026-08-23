import { cx } from "@emotion/css";
import { Sparkles } from "lucide-react";
import { memo, type FC, Fragment } from "react";
import { useConversation } from "@/wins/agent/hooks/use-conversation";
import Card from "@/common/components/layout/card";
import type { ProviderConfigView } from "@mahiru/agent/browser";

import ChatInput from "./input";
import ChatContent from "./content";
import ConfigPicker from "./config-picker";
import { getAgentToolPresentation } from "./tool-presentation";

interface ChatProps {
  className?: string;
  conversationID: string;
  loadingConfigs?: boolean;
  selectedConfigID: string;
  configs: ProviderConfigView[];
  activeConfig: Undefinable<ProviderConfigView>;
  onCreateConfig: NormalFunc;
  onRefreshConfigs: NormalFunc;
  onCreateConversation: NormalFunc;
  onSelectConfig: NormalFunc<[id: string]>;
  onEditConfig: NormalFunc<[config: ProviderConfigView]>;
}

const Chat: FC<ChatProps> = ({
  className,
  onEditConfig,
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
  const runningTool = [...liveTimeline]
    .reverse()
    .find((item) => item.type === "tool" && item.status === "running");
  const runningToolName = runningTool?.type === "tool" ? runningTool.toolCalls[0]?.name : undefined;
  const runningLabel = runningToolName
    ? getAgentToolPresentation(runningToolName).label
    : "正在生成回复";

  return (
    <Card
      className={cx(
        "agent-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl! p-0!",
        className
      )}>
      <header className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-white/6 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--theme-color-main)_14%,transparent)] text-[color-mix(in_srgb,var(--theme-color-main)_78%,white)] ring-1 ring-[color-mix(in_srgb,var(--theme-color-main)_22%,transparent)]">
            <Sparkles className="size-3" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-white/84">音乐助手</div>
            <div className="mt-px flex items-center gap-1 text-[9px] text-white/30">
              <span
                className={cx(
                  "size-1 rounded-full",
                  runningRunID
                    ? "animate-pulse bg-[color-mix(in_srgb,var(--theme-color-main)_80%,white)]"
                    : activeConfig
                      ? "bg-emerald-300/70"
                      : "bg-amber-200/70"
                )}
              />
              Aira Agent
            </div>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <ConfigPicker
            configs={configs}
            loading={loadingConfigs}
            disabled={!!runningRunID}
            activeConfig={activeConfig}
            selectedConfigID={selectedConfigID}
            onEdit={onEditConfig}
            onCreate={onCreateConfig}
            onSelect={onSelectConfig}
            onRefresh={onRefreshConfigs}
          />
        </div>
      </header>
      <Fragment key={`conversation-${conversationID || "empty"}`}>
        <ChatContent
          recovering={recovering}
          streamText={streamText}
          running={!!runningRunID}
          configured={!!activeConfig}
          conversation={conversation}
          liveTimeline={liveTimeline}
          runningRunID={runningRunID}
          hasConversation={!!conversationID}
          pendingUserMessage={pendingUserMessage}
          onSubmitPrompt={submit}
          onCreateConfig={onCreateConfig}
          onCreateConversation={onCreateConversation}
        />
        <ChatInput
          sending={sending}
          activeConfig={activeConfig}
          runningLabel={runningLabel}
          runningRunID={runningRunID}
          selectedConversationID={conversationID}
          onAbort={abort}
          onSubmit={submit}
        />
      </Fragment>
    </Card>
  );
};

export default memo(Chat);
