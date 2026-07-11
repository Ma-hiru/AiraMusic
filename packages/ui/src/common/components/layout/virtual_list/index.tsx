import {
  memo,
  useRef,
  type FC,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type RefObject
} from "react";
import { Log } from "@/common/lib/log";
import RendererTheme from "@/common/player/ui";

export type VirtualListRow<T extends HasID, U> = FC<{
  extra: U;
  items: T[];
  index: number;
}>;

export interface VirtualListProps<T extends HasID, U> {
  items: T[];
  extraData: U;
  overscan?: number;
  itemHeight?: number;
  paddingBottom?: number | string;
  RowComponent: VirtualListRow<T, U>;
  containerRef: RefObject<Nullable<HTMLDivElement>>;
  setScrollToItem?: NormalFunc<[scrollToItem: (index: number) => Promise<void>]>;
  onRangeUpdate?: NormalFunc<[range: IndexRange]>;
  onItemClick?: NormalFunc<[item: T, index: number]>;
}

const VirtualList = <T extends HasID, U>({
  setScrollToItem,
  onItemClick,
  onRangeUpdate,
  items,
  extraData,
  containerRef,
  overscan = 5,
  RowComponent,
  paddingBottom,
  itemHeight = 64
}: VirtualListProps<T, U>) => {
  const { end, start, scrollToItem } = useVirtualList({
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

  useEffect(() => {
    setScrollToItem?.(scrollToItem);
  }, [scrollToItem, setScrollToItem]);
  return (
    <div className="relative w-full will-change-auto contain-strict" style={finalHeight}>
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
            <RowComponent items={items} extra={extraData} index={realIndex} />
          </div>
        );
      })}
    </div>
  );
};

export default memo(VirtualList) as typeof VirtualList;

function useVirtualList(props: {
  total: number;
  overscan: number;
  itemHeight: number;
  onRangeUpdate?: NormalFunc<[range: IndexRange]>;
  containerRef: RefObject<Nullable<HTMLDivElement>>;
}) {
  const { onRangeUpdate, total, overscan, itemHeight, containerRef } = props;
  const ticking = useRef(false);
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
      setVisibleCount(nextCount);
    };
    const resizeObserver = new ResizeObserver(calcVisibleCount);
    resizeObserver.observe(container);
    calcVisibleCount();

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(() => {
          const nextVisibleStart = Math.floor(container.scrollTop / itemHeight);
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
      if (!container) return Promise.resolve();
      if (index < 0 || index >= total) return Promise.resolve();
      Log.debug(`Scrolling to item ${index}, position ${index * itemHeight}px`);
      return RendererTheme.smoothScrollTo(container, index * itemHeight);
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
