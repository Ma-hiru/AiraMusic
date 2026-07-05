import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { RefreshCw, MessageSquarePlus } from "lucide-react";
import IconButton from "@/common/components/data-input/icon-button";
import type { AgentConversationSummary } from "@mahiru/ipc/types";

import ConversationItem from "./item";

interface ConversationListProps {
  open: boolean;
  loading?: boolean;
  className?: string;
  runningRunID: string;
  selectedConversationID: string;
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
  runningRunID,
  conversations,
  selectedConversationID
}) => {
  return (
    <div
      className={cx(
        `
          h-full w-(--side-bar-expand-width) shrink-0 overflow-hidden
          transition-all duration-500 ease-in-out
        `,
        className,
        !open && "w-0!"
      )}>
      <div
        className={cx(
          `
            flex h-full w-(--side-bar-expand-width) flex-col gap-3
            py-3 pl-3 pr-0 transition-all duration-500 ease-in-out
          `,
          !open && "opacity-0"
        )}>
        <section className="surface-1 flex min-h-0 flex-1 flex-col rounded-lg p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-[13px] font-bold">对话</h2>
              <p className="truncate text-[10px] font-semibold uppercase opacity-45">
                Conversations
              </p>
            </div>
            <div className="flex items-center gap-1">
              <IconButton
                label="刷新对话"
                size="compact"
                icon={RefreshCw}
                disabled={loading}
                onClick={onRefresh}
              />
              <IconButton
                label="新建对话"
                size="compact"
                icon={MessageSquarePlus}
                onClick={onCreateConversation}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 scrollbar scrollbar-show">
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === selectedConversationID}
                disabled={!!runningRunID && conversation.id === selectedConversationID}
                onOpen={onOpenConversation}
                onRemove={onRemoveConversation}
              />
            ))}
            {conversations.length === 0 && (
              <div className="grid min-h-32 place-items-center rounded-md border border-white/10 px-3 text-center text-[12px] text-white/45">
                暂无对话
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default memo(ConversationList);
