import { cx } from "@emotion/css";
import { memo, type FC, type MouseEvent as ReactMouseEvent } from "react";
import AppEmpty from "@/common/components/fallback/app-empty";
import AppError from "@/common/components/fallback/app-error";
import MediaGrid from "@/common/components/layout/media-grid";
import AppLoading from "@/common/components/fallback/app-loading";
import InfiniteContainer from "@/common/components/layout/infinite/infinite-container";
import type { MediaItem } from "@/common/components/layout/media-grid/card";
import type { StarCollectionStatus } from "@/common/hooks/use-star-collection";

import StarListView from "./list-view";
import type { StarViewMode } from "./types";

interface StarCollectionViewProps {
  hasMore: boolean;
  emptyTips: string;
  className?: string;
  items: MediaItem[];
  viewMode?: StarViewMode;
  status: StarCollectionStatus;
  onRetry: NormalFunc;
  onLoadMore: NormalFunc;
  onClickItem?: NormalFunc<[id: number]>;
  onContextItem?: NormalFunc<[e: ReactMouseEvent<HTMLButtonElement>, id: number, index: number]>;
}

/** 收藏分类的通用视图：加载中 / 空 / 错误 / 无限滚动，支持网格与列表两种模式 */
const StarCollectionView: FC<StarCollectionViewProps> = ({
  className,
  onRetry,
  onLoadMore,
  onClickItem,
  onContextItem,
  items,
  status,
  hasMore,
  emptyTips,
  viewMode = "grid"
}) => {
  const loading = status === "idle" || status === "loading";

  if (loading && items.length === 0) {
    return <AppLoading className={cx("h-full w-full", className)} tips="正在加载收藏" loading />;
  }

  if (status === "error" && items.length === 0) {
    return (
      <AppError
        className={cx("h-full w-full", className)}
        reset={onRetry}
        tips="收藏加载失败，点击重试"
        when
      />
    );
  }

  if (items.length === 0) {
    return <AppEmpty className={cx("h-full w-full", className)} tips={emptyTips} />;
  }

  return (
    <InfiniteContainer
      className={cx("h-full", className)}
      hasMore={hasMore}
      isLoading={loading}
      disabled={status === "error"}
      onLoadMore={onLoadMore}>
      {status === "error" && (
        <div className="mb-3 flex justify-center">
          <button
            className="cursor-pointer rounded-md px-2 py-1 font-semibold transition-all duration-200 ease-in-out hover:bg-primary hover:text-primary-text active:scale-95"
            type="button"
            onClick={onRetry}>
            加载失败，点击重试
          </button>
        </div>
      )}
      {viewMode === "list" ? (
        <StarListView items={items} onClickItem={onClickItem} onContextItem={onContextItem} />
      ) : (
        <MediaGrid items={items} onClickItem={onClickItem} onContextItem={onContextItem} />
      )}
    </InfiniteContainer>
  );
};

export default memo(StarCollectionView);
