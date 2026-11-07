import { cx } from "@emotion/css";
import { memo, type FC, useMemo } from "react";
import { CommentType } from "@/common/enum";

import FloorItem from "./item";

interface FloorListProps {
  total: number;
  hasMore: boolean;
  sourceID?: number;
  className?: string;
  type?: CommentType;
  floors: NeteaseAPI.NeteaseFloorComment[];
  status: "idle" | "error" | "loading" | "success";
  onRetry: NormalFunc;
  onCollapse: NormalFunc;
  onLoadMore: NormalFunc;
  onLikedChange: NormalFunc<[commentId: number, liked: boolean]>;
}

const FloorList: FC<FloorListProps> = ({
  className,
  onRetry,
  onCollapse,
  onLoadMore,
  onLikedChange,
  type,
  total,
  floors,
  status,
  hasMore,
  sourceID
}) => {
  const isEmpty = floors.length === 0;
  const remaining = useMemo(() => Math.max(total - floors.length, 0), [floors.length, total]);

  const textAction =
    "text-[10px] font-semibold cursor-pointer transition-opacity duration-300 ease-in-out";

  return (
    <div
      className={cx(
        "mt-0.5 ml-0.5 pl-2.5 border-l border-white/20 flex flex-col gap-2 min-w-0",
        className
      )}>
      {floors.map((floor) => (
        <FloorItem
          key={floor.commentId}
          type={type}
          data={floor}
          sourceID={sourceID}
          onLikedChange={onLikedChange}
        />
      ))}
      {isEmpty && status !== "success" && status !== "error" && (
        <span className="text-[10px] font-semibold opacity-60">正在加载回复…</span>
      )}
      {isEmpty && status === "success" && (
        <span className="text-[10px] font-semibold opacity-60">暂无回复</span>
      )}
      {isEmpty && status === "error" && (
        <button
          className={cx(textAction, "self-start opacity-80 hover:opacity-100")}
          type="button"
          onClick={onRetry}>
          加载失败，点击重试
        </button>
      )}
      {!isEmpty && (
        <div className="flex flex-row flex-wrap items-center justify-start gap-x-3 gap-y-1">
          {status === "loading" && (
            <span className="text-[10px] font-semibold opacity-60">正在加载…</span>
          )}
          {status === "error" && (
            <button
              className={cx(textAction, "opacity-80 hover:opacity-100")}
              type="button"
              onClick={onRetry}>
              加载失败，点击重试
            </button>
          )}
          {status !== "loading" && hasMore && (
            <button
              className={cx(textAction, "opacity-80 hover:opacity-100")}
              type="button"
              onClick={onLoadMore}>
              展开更多回复
              {remaining > 0 && (
                <span className="opacity-70">
                  （还有 <span className="font-semibold">{remaining}</span> 条）
                </span>
              )}
            </button>
          )}
          <button
            className={cx(textAction, "opacity-60 hover:opacity-100")}
            type="button"
            onClick={onCollapse}>
            收起
          </button>
        </div>
      )}
    </div>
  );
};

export default memo(FloorList);
