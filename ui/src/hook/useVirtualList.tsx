import {
  FC,
  forwardRef,
  ForwardRefRenderFunction,
  RefObject,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";

export function useVirtualList<T extends HasID, U = never>({
  items,
  containerRef,
  overscan = 5,
  itemHeight = 64,
  extraData,
  onRangeUpdate,
  onScrollCallback
}: VirtualListProps<T, U>) {
  const [scrollTop, setScrollTop] = useState(0);
  const ticking = useRef(false);
  const total = items.length;
  const containerHeight = containerRef.current?.clientHeight ?? 0;
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const start = Math.max(0, visibleStart - overscan);
  const end = Math.min(total, visibleStart + visibleCount + overscan);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(() => {
          const top = container.scrollTop;
          setScrollTop(top);
          onScrollCallback?.(top);
          ticking.current = false;
        });
      }
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [containerRef, onScrollCallback]);
  useEffect(() => {
    onRangeUpdate?.([visibleStart, Math.min(total, visibleStart + visibleCount)]);
  }, [visibleStart, visibleCount, total, onRangeUpdate]);

  const List: ListComponentType<T, U> = ({ RowComponent, paddingBottom }, ref) => {
    const baseHeight = total * itemHeight;
    const heightWithNumberPadding =
      typeof paddingBottom === "number" ? baseHeight + paddingBottom : baseHeight;
    useImperativeHandle(ref, () => ({
      getScrollHeight: () => heightWithNumberPadding,
      setScrollTop: (top: number) => containerRef.current && (containerRef.current.scrollTop = top)
    }));
    const heightStyle = (() => {
      if (typeof paddingBottom !== "string") return heightWithNumberPadding;
      return `calc(${baseHeight}px + ${paddingBottom})`;
    })();
    return (
      <div
        className="relative w-full will-change-auto contain-paint contain-layout"
        style={{ height: heightStyle }}>
        {items.slice(start, end).map((item, i) => {
          const realIndex = start + i;
          return (
            <div
              key={item.id}
              className="virtual-item absolute w-full"
              style={{
                height: itemHeight,
                transform: `translate3d(0, ${realIndex * itemHeight}px, 0)`
              }}>
              <RowComponent items={items} index={realIndex} extra={extraData} />
            </div>
          );
        })}
      </div>
    );
  };

  return forwardRef(List);
}

interface HasID {
  id: string | number;
}

export interface VirtualListProps<T extends HasID, U = never> {
  items: T[];
  containerRef: RefObject<HTMLDivElement | null>;
  overscan?: number;
  itemHeight?: number;
  extraData?: U;
  onRangeUpdate?: (range: [number, number]) => void;
  onScrollCallback?: (top: number) => void;
}

export type RowComponentType<T, U = never> = FC<{
  items: T[];
  index: number;
  extra?: U;
}>;

export type ListRef = {
  getScrollHeight: () => number;
  setScrollTop: (top: number) => void;
};

export type ListComponentType<T, U = never> = ForwardRefRenderFunction<
  ListRef,
  {
    RowComponent: RowComponentType<T, U>;
    paddingBottom?: number | string;
  }
>;
