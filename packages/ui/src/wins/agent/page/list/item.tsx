import { cx } from "@emotion/css";
import { Trash2 } from "lucide-react";
import { memo, type FC } from "react";
import IconButton from "@/common/components/data-input/icon-button";
import type { AgentConversationSummary } from "@mahiru/ipc/types";

interface ConversationItemProps {
  active: boolean;
  disabled?: boolean;
  conversation: AgentConversationSummary;
  onOpen: NormalFunc<[id: string]>;
  onRemove: NormalFunc<[id: string]>;
}

const ConversationItem: FC<ConversationItemProps> = ({
  onOpen,
  onRemove,
  active,
  disabled,
  conversation
}) => {
  return (
    <div
      className={cx(
        `
          group flex items-center gap-1 rounded-md transition-colors
          border border-transparent
        `,
        active
          ? "border-primary/30 bg-primary/80 text-primary-text"
          : "text-white/75 hover:border-white/10 hover:bg-white/10"
      )}>
      <button
        className="min-w-0 flex-1 px-2.5 py-2 text-left"
        type="button"
        onClick={() => onOpen(conversation.id)}>
        <span className="block truncate text-[13px] font-semibold leading-5">
          {conversation.name || "未命名会话"}
        </span>
        <span className="block truncate text-[10px] opacity-50">{conversation.id}</span>
      </button>
      <IconButton
        className={cx(
          "mr-1 opacity-0 transition-opacity group-hover:opacity-100",
          active && "opacity-80"
        )}
        label="删除会话"
        icon={Trash2}
        size="compact"
        disabled={disabled}
        onClick={() => onRemove(conversation.id)}
      />
    </div>
  );
};

export default memo(ConversationItem);
