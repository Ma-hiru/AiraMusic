import { cx } from "@emotion/css";
import { memo, useRef, type FC, useMemo } from "react";
import { RefreshCw, MessageSquarePlus } from "lucide-react";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import AppEmpty from "@/common/components/fallback/app-empty";
import IconButton from "@/common/components/data-input/icon-button";
import type { AgentConversationSummary } from "@mahiru/ipc/types";

import ConversationItem from "./item";

interface ConversationListProps {
  open: boolean;
  loading?: boolean;
  overlay?: boolean;
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
  overlay,
  conversations,
  runningConversationIDs,
  selectedConversationID
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollAutoHide(scrollRef, 700);
  const runningConversationIDSet = useMemo(
    () => new Set(runningConversationIDs),
    [runningConversationIDs]
  );

  return (
    <div
      className={cx(
        "h-full overflow-hidden transition-all duration-300 ease-out",
        overlay
          ? "absolute inset-y-0 left-0 z-30 w-70 max-w-[calc(100%-2.5rem)]"
          : "w-(--side-bar-expand-width) shrink-0",
        className,
        overlay
          ? open
            ? "translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-[calc(100%+1rem)] opacity-0"
          : !open
            ? "w-0!"
            : "mr-3"
      )}>
      <div
        className={cx(
          "flex h-full flex-col transition-opacity duration-200",
          overlay ? "w-full" : "w-(--side-bar-expand-width)",
          !open && !overlay && "opacity-0"
        )}>
        <aside
          className={cx(
            "agent-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border",
            overlay && "shadow-2xl shadow-black/35"
          )}>
          <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-white/7 px-3">
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold text-white/78">对话记录</div>
              <div className="mt-0.5 text-[9px] tabular-nums text-white/28">
                {conversations.length} 个会话
              </div>
            </div>
            <div className="flex items-center gap-0.5">
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
            </div>
          </header>
          <div
            ref={scrollRef}
            className="agent-scroll min-h-0 flex-1 space-y-1 overflow-y-auto p-2 pr-1.5">
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
                className="min-h-28 rounded-lg border border-white/8 bg-white/[0.025] text-[11px] opacity-45"
                tips="暂无对话"
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default memo(ConversationList);
