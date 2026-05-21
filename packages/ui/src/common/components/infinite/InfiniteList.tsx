import {
  type CSSProperties,
  type Key,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef
} from "react";
import { useLatestRef } from "../../hooks/useLatestRef";
import { Log } from "@mahiru/ui/common/constants/dev";
import AppLoading from "../../components/fallback/AppLoading";
import AppEmpty from "../../components/fallback/AppEmpty";
import { cx } from "@emotion/css";
import { useScrollAutoHide } from "../../hooks/useScrollAutoHide";

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
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
  style?: CSSProperties;
  LoadingFallback?: ReactNode;
  EmptyFallback?: ReactNode;
};

const InfiniteList = <T,>({
  items,
  render,
  buildKey = (_, index) => index,
  hasMore,
  isLoading = false,
  onLoadMore,
  rootMargin = "200px 0px",
  threshold = 0,
  disabled = false,
  className,
  itemClassName,
  style,
  LoadingFallback = <AppLoading loading />,
  EmptyFallback = <AppEmpty />
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
        role="listitem"
        key={buildKey(item, index)}
        className={itemClassName}
        children={render(item, index)}
      />
    ));
  }, [buildKey, itemClassName, items, render]);

  useScrollAutoHide(containerRef);

  return (
    <div
      role="list"
      ref={containerRef}
      className={cx("w-full overflow-y-auto overflow-x-hidden scrollbar scrollbar-show", className)}
      style={style}>
      {children}
      {isEmpty && !isLoading && EmptyFallback}
      {isLoading && LoadingFallback}
      <span aria-hidden ref={sentinelRef} className="h-px" />
    </div>
  );
};

export default memo(InfiniteList) as typeof InfiniteList;
