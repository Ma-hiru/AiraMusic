import { FC, memo, ReactNode, useCallback, useEffect, useRef } from "react";
import { useLatestRef } from "@mahiru/ui/public/hooks/useLatestRef";
import { Log } from "@mahiru/ui/public/utils/dev";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";
import AppEmpty from "@mahiru/ui/public/components/fallback/AppEmpty";
import { cx } from "@emotion/css";
import { useScrollAutoHide } from "@mahiru/ui/public/hooks/useScrollAutoHide";

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
  disabled?: boolean;
  className?: string;
  LoadingFallback?: ReactNode;
  EmptyFallback?: ReactNode;
  children: Nullable<ReactNode>;
};

const InfiniteContainer: FC<InfiniteContainerProps> = ({
  hasMore,
  isLoading = false,
  onLoadMore,
  rootMargin = "200px 0px",
  threshold = 0,
  disabled = false,
  className,
  LoadingFallback = <AppLoading loading />,
  EmptyFallback = <AppEmpty />,
  children
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
      role="list"
      ref={containerRef}
      className={cx(
        "w-full overflow-y-auto overflow-x-hidden scrollbar scrollbar-show",
        className
      )}>
      {children}
      {isEmpty && !isLoading && EmptyFallback}
      {isLoading && LoadingFallback}
      <span aria-hidden ref={sentinelRef} className="h-px" />
    </div>
  );
};

export default memo(InfiniteContainer);
