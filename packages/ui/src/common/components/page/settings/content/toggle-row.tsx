import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import type { LucideIcon } from "lucide-react";

import BaseItem from "./base-item";

interface ToggleRowProps {
  title: string;
  checked: boolean;
  icon?: LucideIcon;
  disabled?: boolean;
  description: string;
  emptyIcon?: boolean;
  onClick: NormalFunc;
}

const ToggleRow: FC<ToggleRowProps> = ({
  onClick,
  icon,
  title,
  checked,
  description,
  disabled = false,
  emptyIcon = false
}) => {
  return (
    <BaseItem
      icon={icon}
      emptyIcon={emptyIcon}
      children={
        <section className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold tracking-normal">{title}</h3>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 ">{description}</p>
          </div>
          <button
            className={cx(
              `
              h-7 w-12 shrink-0 rounded-full border
              transition-all duration-300 ease-in-out
              cursor-pointer hover:opacity-50 active:scale-95
              disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100
              flex justify-start items-center p-0
            `,
              checked ? "border-primary pl-6" : "border-white/50 pl-1"
            )}
            type="button"
            disabled={disabled}
            aria-pressed={checked}
            title={checked ? "关闭" : "开启"}
            onClick={onClick}>
            <span
              className={cx(
                `
                  inline-block size-5 rounded-full shadow-sm
                  transition-all duration-300 ease-in-out
                `,
                checked ? "bg-primary" : "bg-(--text-color)"
              )}
            />
          </button>
        </section>
      }
    />
  );
};

export default memo(ToggleRow);
