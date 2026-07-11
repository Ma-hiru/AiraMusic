import { cx } from "@emotion/css";
import { LoaderCircle } from "lucide-react";
import { memo, useRef, type FC, useEffect, useCallback, type ReactNode } from "react";
import { Log } from "@/common/lib/log";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import AppEmpty from "@/common/components/fallback/app-empty";

export type InfiniteContainerProps = {
  /**
   * 是否还有下一页
   */
  hasMore: boolean;
  /**
   * 外部加载状态
   */
  isLoading: boolean;
  /**
   * 触底加载下一页，可以使用闭包函数
   */
  onLoadMore: NormalFunc | PromiseFunc;
  /**
   * IntersectionObserver rootMargin
   */
  rootMargin?: string;
  /**
   * IntersectionObserver threshold
   */
  threshold?: number;
  /**
   * 禁用自动加载
   */
  className?: string;
  disabled?: boolean;
  EmptyFallback?: ReactNode;
  children: Nullable<ReactNode>;
};

const InfiniteContainer: FC<InfiniteContainerProps> = ({
  className,
  onLoadMore,
  hasMore,
  children,
  threshold = 0,
  disabled = false,
  isLoading = false,
  rootMargin = "200px 0px",
  EmptyFallback = <AppEmpty />
}) => {
  const isEmpty = children === null;
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);

  const hasMoreRef = useLatestRef(hasMore);
  const isLoadingRef = useLatestRef(isLoading);
  const disabledRef = useLatestRef(disabled);
  const onLoadMoreRef = useLatestRef(onLoadMore);

  const checkIfNeedLoadMore = useCallback(() => {
    if (disabledRef.current) return false;
    if (!hasMoreRef.current) return false;
    if (isLoadingRef.current) return false;
    return !inFlightRef.current;
  }, [disabledRef, hasMoreRef, isLoadingRef]);

  const triggerLoadMore = useCallback(async () => {
    if (!checkIfNeedLoadMore()) return;
    inFlightRef.current = true;
    Log.info("InfiniteContainer", "trigger load more");
    try {
      // onLoadMore 可以为普通函数，不一定有thenable，所以使用await
      await onLoadMoreRef.current();
    } finally {
      inFlightRef.current = false;
    }
  }, [checkIfNeedLoadMore, onLoadMoreRef]);

  // 在守卫上注册observer，以便触发自动加载
  useEffect(() => {
    const root = containerRef.current;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    if (disabled || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && triggerLoadMore(),
      { root, rootMargin, threshold }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [disabled, hasMore, rootMargin, threshold, triggerLoadMore]);

  useScrollAutoHide(containerRef);

  return (
    <div
      ref={containerRef}
      className={cx("w-full overflow-y-auto overflow-x-hidden scrollbar scrollbar-show", className)}
      role="list">
      {children}
      {isEmpty && !isLoading && EmptyFallback}
      {hasMore ? (
        <div className="flex items-center justify-center gap-2 text-xs font-semibold opacity-55 text-center mt-3">
          {isLoading && <LoaderCircle className="size-4 animate-spin" />}
          {isLoading ? "正在加载更多" : "继续下滑加载更多"}
        </div>
      ) : (
        <div className="text-xs font-semibold opacity-40 text-center block mt-3">已经到底了</div>
      )}
      <span ref={sentinelRef} className="h-px" aria-hidden />
    </div>
  );
};

export default memo(InfiniteContainer);
