import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import type { LucideIcon } from "lucide-react";

interface TrayItemProps {
  icon: LucideIcon;
  text: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: NormalFunc;
}

const TrayItem: FC<TrayItemProps> = ({ icon: Icon, text, active, danger, disabled, onClick }) => {
  return (
    <button
      type="button"
      title={text}
      disabled={disabled}
      onClick={() => onClick()}
      className={cx(
        `
          group flex h-8 w-full items-center gap-2 rounded-md px-2 text-left
          text-[12px] font-semibold outline-none transition-all duration-200 ease-in-out
          focus-visible:ring-2 focus-visible:ring-(--theme-color-main)/40
        `,
        active
          ? "bg-(--theme-color-main) text-(--text-color-on-main)"
          : "text-black/72 hover:bg-black/6 hover:text-black active:scale-[0.98]",
        danger && "text-red-600 hover:bg-red-500/10 hover:text-red-700",
        disabled && "pointer-events-none opacity-35"
      )}>
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{text}</span>
    </button>
  );
};

export default memo(TrayItem);
