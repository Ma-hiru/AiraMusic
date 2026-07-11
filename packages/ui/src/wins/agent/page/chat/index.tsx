import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { useConversation } from "@/wins/agent/hooks/use-conversation";
import Card from "@/common/components/layout/card";
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

  return (
    <Card className={cx("flex min-h-0 min-w-0 flex-col overflow-hidden p-0!", className)}>
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
    </Card>
  );
};

export default memo(Chat);
