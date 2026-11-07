import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { List, LayoutGrid, RotateCwSquare, type LucideIcon } from "lucide-react";
import PageAction from "@/common/components/display/page-action";

import StarTabs from "./tabs";
import type { StarCategory, StarViewMode } from "./types";

interface StarHeaderProps {
  className?: string;
  showTabs?: boolean;
  active: StarCategory;
  refreshing?: boolean;
  viewMode?: StarViewMode;
  pageActionType?: "out" | "none" | "enter";
  counts?: Partial<Record<StarCategory, number>>;
  onRefresh?: NormalFunc;
  onPageAction?: NormalFunc;
  onChange?: NormalFunc<[category: StarCategory]>;
  onViewModeChange?: NormalFunc<[mode: StarViewMode]>;
}

const viewOptions: {
  label: string;
  Icon: LucideIcon;
  key: StarViewMode;
}[] = [
  { key: "grid", label: "网格视图", Icon: LayoutGrid },
  { key: "list", label: "列表视图", Icon: List }
];

const StarHeader: FC<StarHeaderProps> = ({
  className,
  pageActionType,
  onChange,
  onRefresh,
  onPageAction,
  onViewModeChange,
  active,
  counts,
  showTabs = true,
  viewMode = "grid",
  refreshing = false
}) => {
  const count = counts?.[active];
  const hasPageAction = pageActionType === "out" || pageActionType === "enter";

  return (
    <div className={cx("w-full shrink-0 select-none", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 items-baseline gap-2 truncate">
          <h1 className="truncate text-[28px] font-bold">收藏</h1>
          {typeof count === "number" && (
            <span className="shrink-0 text-[12px] font-semibold opacity-40">{count} 项</span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center">
          {showTabs ? (
            <div
              className="
                inline-flex items-center gap-0.5 rounded-full border border-white/20
                bg-white/10 p-0.5 px-1.5 relative left-0.5 shadow-md backdrop-blur-lg
              ">
              <StarTabs active={active} onChange={onChange} />
              <span className="mx-0.5 h-4.5 w-px bg-(--text-color)/15" />
              {viewOptions.map(({ key, Icon, label }) => {
                const selected = viewMode === key;

                return (
                  <button
                    key={key}
                    className={cx(
                      `
                        flex size-7 cursor-pointer items-center justify-center rounded-full
                        transition-all duration-200 ease-in-out
                      `,
                      selected
                        ? "bg-(--text-color)/15 text-normal-text"
                        : "text-(--text-color)/45 hover:bg-white/20 hover:text-normal-text"
                    )}
                    title={label}
                    type="button"
                    aria-label={label}
                    aria-pressed={selected}
                    onClick={() => onViewModeChange?.(key)}>
                    <Icon className="size-4" />
                  </button>
                );
              })}
              <span className="mx-0.5 h-4.5 w-px bg-(--text-color)/15" />
              <button
                className="
                  flex size-8 cursor-pointer items-center justify-center rounded-full
                  text-normal-text transition-all duration-200 ease-in-out
                  hover:bg-white/20 active:scale-95
                "
                title="刷新"
                type="button"
                aria-label="刷新"
                onClick={onRefresh}>
                <RotateCwSquare className={cx("size-5", refreshing && "animate-spin")} />
              </button>
              {hasPageAction && (
                <>
                  <span className="mx-0.5 h-4.5 w-px bg-(--text-color)/15" />
                  <PageAction
                    className="size-8! rounded-full!"
                    type={pageActionType}
                    iconClassName="size-4.5!"
                    onClick={onPageAction}
                  />
                </>
              )}
            </div>
          ) : (
            <PageAction type={pageActionType} onClick={onPageAction} />
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(StarHeader);
