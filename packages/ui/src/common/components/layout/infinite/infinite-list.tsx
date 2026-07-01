import { cx } from "@emotion/css";
import {
  memo,
  useRef,
  useMemo,
  type Key,
  useEffect,
  useCallback,
  type ReactNode,
  type CSSProperties
} from "react";
import { Log } from "@/common/lib/log";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import AppEmpty from "@/common/components/fallback/app-empty";
import AppLoading from "@/common/components/fallback/app-loading";

export type InfiniteList<T> = {
  /**
   * 列表数据
   */
  items: readonly T[];
  /**
   * 渲染每一项，可以使用闭包函数
   */
  render: NormalFunc<[item: T, index: number], ReactNode>;
  /**
   * 构建渲染key，可以使用闭包函数
   * */
  buildKey: NormalFunc<[item: T, index: number], Key>;
  /**
   * 是否还有下一页
   */
  hasMore: boolean;
  /**
   * 外部加载状态
   */
  isLoading?: boolean;
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
  style?: CSSProperties;
  itemClassName?: string;
  EmptyFallback?: ReactNode;
  LoadingFallback?: ReactNode;
};

const InfiniteList = <T,>({
  className,
  onLoadMore,
  items,
  style,
  render,
  hasMore,
  itemClassName,
  threshold = 0,
  disabled = false,
  isLoading = false,
  rootMargin = "200px 0px",
  EmptyFallback = <AppEmpty />,
  buildKey = (_, index) => index,
  LoadingFallback = <AppLoading loading />
}: InfiniteList<T>) => {
  const isEmpty = items.length === 0;
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
    Log.info("InfiniteList", "trigger load more");
    try {
      // onLoadMore 可以为普通函数，不一定有thenable，所以使用await
      await onLoadMoreRef.current();
    } finally {
      inFlightRef.current = false;
    }
  }, [checkIfNeedLoadMore, onLoadMoreRef]);

  useEffect(() => {
    // 在守卫上注册observer，以便触发自动加载
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

  const children = useMemo(() => {
    return items.map((item, index) => (
      <div
        key={buildKey(item, index)}
        className={itemClassName}
        role="listitem"
        children={render(item, index)}
      />
    ));
  }, [buildKey, itemClassName, items, render]);

  useScrollAutoHide(containerRef);

  return (
    <div
      ref={containerRef}
      className={cx("w-full overflow-y-auto overflow-x-hidden scrollbar scrollbar-show", className)}
      style={style}
      role="list">
      {children}
      {isEmpty && !isLoading && EmptyFallback}
      {isLoading && LoadingFallback}
      <span ref={sentinelRef} className="h-px" aria-hidden />
    </div>
  );
};

export default memo(InfiniteList) as typeof InfiniteList;
