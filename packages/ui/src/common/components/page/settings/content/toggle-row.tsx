import { type FC, memo } from "react";
import { cx } from "@emotion/css";
import type { LucideIcon } from "lucide-react";

import BaseItem from "./base-item";

interface ToggleRowProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onClick: NormalFunc;
  emptyIcon?: boolean;
}

const ToggleRow: FC<ToggleRowProps> = ({
  icon,
  title,
  description,
  checked,
  onClick,
  emptyIcon = false
}) => {
  return (
    <BaseItem
      emptyIcon={emptyIcon}
      icon={icon}
      children={
        <section className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-black tracking-normal">{title}</h3>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 ">{description}</p>
          </div>
          <button
            type="button"
            title={checked ? "关闭" : "开启"}
            onClick={onClick}
            className={cx(
              `
              h-7 w-12 shrink-0 rounded-full border
              transition-all duration-300 ease-in-out
              cursor-pointer hover:opacity-50 active:scale-95
              flex justify-start items-center p-0
            `,
              checked ? "border-(--theme-color-main) pl-6" : "border-white/50 pl-1"
            )}>
            <span
              className={cx(
                `
                  inline-block size-5 rounded-full shadow-sm
                  transition-all duration-300 ease-in-out
                `,
                checked ? "bg-(--theme-color-main)" : "bg-(--text-color)"
              )}
            />
          </button>
        </section>
      }
    />
  );
};

export default memo(ToggleRow);
