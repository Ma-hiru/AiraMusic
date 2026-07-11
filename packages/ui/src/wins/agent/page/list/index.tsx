import { cx } from "@emotion/css";
import { memo, type FC, useMemo } from "react";
import { RefreshCw, MessageSquarePlus } from "lucide-react";
import Card from "@/common/components/layout/card";
import AppEmpty from "@/common/components/fallback/app-empty";
import IconButton from "@/common/components/data-input/icon-button";
import type { AgentConversationSummary } from "@mahiru/ipc/types";

import ConversationItem from "./item";

interface ConversationListProps {
  open: boolean;
  loading?: boolean;
  className?: string;
  selectedConversationID: string;
  runningConversationIDs: string[];
  conversations: AgentConversationSummary[];
  onRefresh: NormalFunc;
  onCreateConversation: NormalFunc;
  onOpenConversation: NormalFunc<[id: string]>;
  onRemoveConversation: NormalFunc<[id: string]>;
}

const ConversationList: FC<ConversationListProps> = ({
  className,
  onRefresh,
  onOpenConversation,
  onCreateConversation,
  onRemoveConversation,
  open,
  loading,
  conversations,
  runningConversationIDs,
  selectedConversationID
}) => {
  const runningConversationIDSet = useMemo(
    () => new Set(runningConversationIDs),
    [runningConversationIDs]
  );

  return (
    <div
      className={cx(
        `
          h-full w-(--side-bar-expand-width) shrink-0 overflow-hidden
          transition-all duration-500 ease-in-out
        `,
        className,
        !open ? "w-0!" : "mr-3"
      )}>
      <div
        className={cx(
          `
            flex h-full w-(--side-bar-expand-width) flex-col
            transition-all duration-500 ease-in-out
          `,
          !open && "opacity-0"
        )}>
        <Card
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          title="对话"
          subTitle="Conversations"
          action={
            <>
              <IconButton
                label="刷新对话"
                size="compact"
                icon={RefreshCw}
                disabled={loading}
                iconClassName="size-4.5! opacity-65"
                onClick={onRefresh}
              />
              <IconButton
                label="新建对话"
                size="compact"
                icon={MessageSquarePlus}
                iconClassName="size-4.5! opacity-65"
                onClick={onCreateConversation}
              />
            </>
          }>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 scrollbar scrollbar-show">
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === selectedConversationID}
                disabled={runningConversationIDSet.has(conversation.id)}
                onOpen={onOpenConversation}
                onRemove={onRemoveConversation}
              />
            ))}
            {conversations.length === 0 && (
              <AppEmpty
                className="min-h-32 rounded-lg border border-white/10 bg-white/6 text-[12px] opacity-45"
                tips="暂无对话"
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default memo(ConversationList);
