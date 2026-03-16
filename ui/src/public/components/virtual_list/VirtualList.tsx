import { FC, memo, RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";

export type VirtualListRow<T extends HasID, U> = FC<{
  items: T[];
  index: number;
  extra: U;
}>;

export interface VirtualListProps<T extends HasID, U> {
  items: T[];
  extraData: U;
  itemHeight?: number;
  paddingBottom?: number | string;
  RowComponent: VirtualListRow<T, U>;
  containerRef: RefObject<Nullable<HTMLDivElement>>;
  onRangeUpdate?: NormalFunc<[range: IndexRange]>;
  overscan?: number;
  onItemClick?: NormalFunc<[item: T, index: number]>;
}

const VirtualList = <T extends HasID, U>({
  RowComponent,
  paddingBottom,
  itemHeight = 64,
  extraData,
  items,
  containerRef,
  onRangeUpdate,
  overscan = 5,
  onItemClick
}: VirtualListProps<T, U>) => {
  const { start, end } = useVirtualList({
    total: items.length,
    containerRef,
    itemHeight,
    onRangeUpdate,
    overscan
  });
  const visibleItems = useMemo(() => items.slice(start, end), [end, items, start]);
  const finalHeight = useMemo(() => {
    const total = items.length;
    const baseHeight = total * itemHeight;
    let height: number | string = baseHeight;
    if (typeof paddingBottom === "number") {
      height = baseHeight + paddingBottom;
    } else if (typeof paddingBottom === "string") {
      height = `calc(${baseHeight}px + ${paddingBottom})`;
    }
    return { height };
  }, [itemHeight, items.length, paddingBottom]);
  return (
    <div className="relative w-full will-change-auto contain-layout" style={finalHeight}>
      {visibleItems.map((item, i) => {
        const realIndex = start + i;
        return (
          <div
            key={item.id}
            className="virtual-item absolute w-full"
            style={{
              height: itemHeight,
              transform: `translate3d(0, ${realIndex * itemHeight}px, 0)`
            }}
            onClick={() => onItemClick?.(item, realIndex)}>
            <RowComponent items={items} index={realIndex} extra={extraData} />
          </div>
        );
      })}
    </div>
  );
};

export default memo(VirtualList) as typeof VirtualList;

function useVirtualList(props: {
  total: number;
  containerRef: RefObject<Nullable<HTMLDivElement>>;
  overscan: number;
  itemHeight: number;
  onRangeUpdate?: NormalFunc<[range: IndexRange]>;
}) {
  const { total, containerRef, overscan, itemHeight, onRangeUpdate } = props;
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
