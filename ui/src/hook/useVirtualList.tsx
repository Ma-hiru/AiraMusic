import { RefObject, useEffect, useMemo, useRef, useState } from "react";

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
  const { visibleCount } = useMemo(() => {
    const containerHeight = containerRef.current?.clientHeight ?? 0;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    return {
      containerHeight,
      visibleCount
    };
  }, [containerRef, itemHeight]);
  // 滚动事件处理
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
    return () => container.removeEventListener("scroll", onScroll);
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
  // 返回虚拟列表组件
  return useMemo(() => {
    const start = Math.max(0, visibleStart - overscan);
    const end = Math.min(total, visibleStart + visibleCount + overscan);
    return {
      start,
      end
    };
  }, [overscan, total, visibleCount, visibleStart]);
}
