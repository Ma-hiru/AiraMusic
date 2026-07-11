import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import type { LucideIcon } from "lucide-react";

interface TrayItemProps {
  text: string;
  active?: boolean;
  danger?: boolean;
  icon: LucideIcon;
  disabled?: boolean;
  onClick: NormalFunc;
}

const TrayItem: FC<TrayItemProps> = ({ onClick, text, active, danger, disabled, icon: Icon }) => {
  return (
    <button
      className={cx(
        `
          group flex h-8 w-full items-center gap-2 rounded-md px-2 text-left
          text-[12px] font-semibold outline-none transition-all duration-300 ease-in-out
          focus-visible:ring-2 focus-visible:ring-primary/40
        `,
        active ? "bg-primary text-(--text-color-on-main)" : "hover:bg-black/20 active:scale-[0.98]",
        danger && "text-red-600 hover:bg-red-500/10 hover:text-red-700",
        disabled && "pointer-events-none opacity-35"
      )}
      title={text}
      type="button"
      disabled={disabled}
      onClick={() => onClick()}>
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{text}</span>
    </button>
  );
};

export default memo(TrayItem);
