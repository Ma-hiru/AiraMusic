import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { Radio, Trash2 } from "lucide-react";
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
          group flex items-center gap-1 rounded-xl border border-transparent
          transition-colors duration-200
        `,
        active
          ? "border-primary/30 bg-primary/74 text-primary-text shadow-sm shadow-black/10"
          : "text-white/72 hover:border-white/10 hover:bg-white/9"
      )}>
      <button
        className="min-w-0 flex-1 px-2.5 py-2 text-left"
        type="button"
        onClick={() => onOpen(conversation.id)}>
        <span className="flex min-w-0 items-center gap-1.5">
          {disabled && <Radio className="size-3 shrink-0 opacity-70" />}
          <span className="block min-w-0 truncate text-[13px] font-semibold leading-5">
            {conversation.name || "未命名会话"}
          </span>
        </span>
        <span className="block truncate text-[10px] opacity-42">
          {disabled ? "运行中" : conversation.id}
        </span>
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
