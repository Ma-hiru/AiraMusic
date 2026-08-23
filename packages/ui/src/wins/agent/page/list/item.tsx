import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { Radio, Trash2 } from "lucide-react";
import IconButton from "@/common/components/data-input/icon-button";
import type { ThreadSummary } from "@mahiru/agent/browser";

interface ConversationItemProps {
  active: boolean;
  disabled?: boolean;
  conversation: ThreadSummary;
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
          group relative flex items-center gap-0.5 rounded-lg border border-transparent
          transition-colors duration-200
        `,
        active
          ? "border-white/9 bg-white/9 text-white shadow-sm shadow-black/8"
          : "text-white/58 hover:border-white/7 hover:bg-white/5 hover:text-white/78"
      )}>
      {active && (
        <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary/85" />
      )}
      <button
        className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40"
        type="button"
        aria-current={active ? "page" : undefined}
        onClick={() => onOpen(conversation.id)}>
        <span className="flex min-w-0 items-center gap-1.5">
          {disabled && <Radio className="size-3 shrink-0 opacity-70" />}
          <span className="block min-w-0 truncate text-[12px] font-medium leading-5">
            {conversation.name || "未命名会话"}
          </span>
        </span>
      </button>
      <IconButton
        className={cx(
          "mr-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
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
