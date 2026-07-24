import { cx } from "@emotion/css";
import { Cpu, Activity } from "lucide-react";
import { memo, type FC, Fragment } from "react";
import { useConversation } from "@/wins/agent/hooks/use-conversation";
import Card from "@/common/components/layout/card";
import type { AIProviderConfigSnapshot } from "@mahiru/ai";

import ChatInput from "./input";
import ChatContent from "./content";
import ConfigPicker from "./config-picker";
import { getAgentToolPresentation } from "./tool-presentation";

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
  onEditConfig: NormalFunc<[config: AIProviderConfigSnapshot]>;
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
    retry,
    submit,
    sending,
    recovering,
    streamText,
    conversation,
    liveTimeline,
    runningRunID,
    retryCandidate,
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
      <header className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-white/7 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/5">
            <Cpu className="size-3.5 text-white/48" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium text-white/76">音乐助手</div>
            <div className="mt-px text-[9px] text-white/26">Aira Agent</div>
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
      {runningRunID && (
        <div className="flex min-h-10 shrink-0 items-center gap-2.5 border-b border-sky-200/10 bg-sky-200/[0.035] px-3.5 sm:px-5">
          <span className="relative flex size-5 shrink-0 items-center justify-center">
            <span className="absolute size-4 animate-ping rounded-full bg-sky-200/10" />
            <Activity className="relative size-3.5 text-sky-100/72" />
          </span>
          <div className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white/56">
            {runningLabel}
          </div>
        </div>
      )}
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
          runningRunID={runningRunID}
          retryCandidate={retryCandidate}
          selectedConversationID={conversationID}
          onAbort={abort}
          onRetry={retry}
          onSubmit={submit}
        />
      </Fragment>
    </Card>
  );
};

export default memo(Chat);
