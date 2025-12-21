import { RefObject, useCallback, useEffect, useRef, useState } from "react";

interface Props {
  total: number;
  containerRef: RefObject<Nullable<HTMLDivElement>>;
  overscan?: number;
  itemHeight?: number;
  onRangeUpdate?: NormalFunc<[range: IndexRange]>;
}

export function useVirtualList({
  total,
  containerRef,
  overscan = 5,
  itemHeight = 64,
  onRangeUpdate
}: Props) {
  const ticking = useRef(false);
  const scrollTopRef = useRef(0);
  const visibleStartRef = useRef(0);
  const [visibleStart, setVisibleStart] = useState(0);
  const [visibleCount, setVisibleCount] = useState(1);
  // 滚动事件处理
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const calcVisibleCount = () => {
      const containerHeight = container.clientHeight;
      const nextCount = Math.max(1, Math.ceil(containerHeight / itemHeight));
      setVisibleCount((prev) => (prev === nextCount ? prev : nextCount));
    };

    calcVisibleCount();
    const resizeObserver = new ResizeObserver(calcVisibleCount);
    resizeObserver.observe(container);

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(() => {
          const top = container.scrollTop;
          scrollTopRef.current = top;
          const nextVisibleStart = Math.floor(top / itemHeight);
          if (visibleStartRef.current !== nextVisibleStart) {
            visibleStartRef.current = nextVisibleStart;
            setVisibleStart(nextVisibleStart);
          }
          ticking.current = false;
        });
      }
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      resizeObserver.disconnect();
      container.removeEventListener("scroll", onScroll);
    };
  }, [containerRef, itemHeight]);
  // 范围更新回调
  const prevRange = useRef<Nullable<IndexRange>>(null);
  useEffect(() => {
    const range: IndexRange = [visibleStart, Math.min(total, visibleStart + visibleCount)];
    if (
      !prevRange.current ||
      prevRange.current[0] !== range[0] ||
      prevRange.current[1] !== range[1]
    ) {
      onRangeUpdate?.(range);
      prevRange.current = range;
    }
  }, [visibleStart, visibleCount, total, onRangeUpdate]);
  // 滚动到指定项
  const scrollToItem = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (!container) return;
      if (index < 0 || index >= total) return;
      container.scrollTo({
        top: index * itemHeight,
        behavior: "smooth"
      });
    },
    [containerRef, itemHeight, total]
  );
  // 计算渲染范围
  const start = Math.max(0, visibleStart - overscan);
  const end = Math.min(total, visibleStart + visibleCount + overscan);

  return {
    start,
    end,
    scrollToItem
  };
}
