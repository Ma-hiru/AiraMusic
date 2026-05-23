import { type FC, memo } from "react";
import { cx } from "@emotion/css";
import type { LucideIcon } from "lucide-react";

interface ToggleRowProps {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onClick: NormalFunc;
}

const ToggleRow: FC<ToggleRowProps> = ({ icon: Icon, title, description, checked, onClick }) => {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-black tracking-normal  ">{title}</h3>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4  ">{description}</p>
      </div>
      <button
        type="button"
        title={checked ? "关闭" : "开启"}
        onClick={onClick}
        className={cx(
          `
          relative h-7 w-12 shrink-0 rounded-full border transition-all duration-300 cursor-pointer hover:opacity-50 active:scale-95
        `,
          checked ? "border-(--theme-color-main) " : "border-(--text-color-on-main)"
        )}>
        <span
          className={cx(
            `
            absolute top-1 size-5 rounded-full   shadow-sm
            transition-all duration-300
          `,
            checked ? "left-6 bg-(--theme-color-main)" : "left-1 bg-(--text-color-on-main)"
          )}
        />
      </button>
    </div>
  );
};

export default memo(ToggleRow);
