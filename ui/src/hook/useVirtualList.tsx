import {
  FC,
  RefObject,
  useEffect,
  useImperativeHandle,
  useState,
  ForwardRefRenderFunction,
  forwardRef
} from "react";
import { usePlatform } from "@mahiru/ui/hook/usePlatform";
import { useGPU } from "@mahiru/ui/hook/useGPU";

interface HasID {
  id: string | number;
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
  }
>;

export function useVirtualList<T extends HasID, U = never>(
  items: T[],
  containerRef: RefObject<Nullable<HTMLDivElement>>,
  overscan: number = 5,
  itemHeight: number = 64,
  extraData?: U,
  onRangeUpdate?: NormalFunc<[IndexRange]>
) {
  // 滚动距离
  const [scrollTop, setScrollTop] = useState(0);
  // 监听容器滚动，实时更新scrollTop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      setScrollTop(container.scrollTop);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [containerRef]);

  const total = items.length;
  const containerHeight = containerRef.current?.clientHeight ?? 0;
  // 可视区域起始索引
  const visibleStart = Math.floor(scrollTop / itemHeight);
  // 可视区域能容纳的项数
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  // 计算渲染范围（包含缓冲区）
  const start = Math.max(0, visibleStart - overscan);
  const end = Math.min(total, visibleStart + visibleCount + overscan);
  // 通知范围更新
  useEffect(() => {
    onRangeUpdate?.([visibleStart, Math.min(total, visibleStart + visibleCount)]);
  }, [onRangeUpdate, total, visibleCount, visibleStart]);
  const platform = usePlatform();
  const { hasDedicatedGPU } = useGPU();
  const List: ListComponentType<T, U> = ({ RowComponent }, ref) => {
    useImperativeHandle(ref, () => ({
      getScrollHeight: () => containerRef.current?.scrollHeight ?? 0,
      setScrollTop: (top: number) => {
        if (containerRef.current) {
          containerRef.current.scrollTop = top;
        }
      }
    }));
    return (
      <div style={{ height: total * itemHeight, position: "relative" }}>
        {/* 渲染可见区 */}
        {items.slice(start, end).map((item, i) => {
          const realIndex = start + i;
          return (
            <div
              className="absolute w-full will-change-transform"
              key={item.id}
              style={{
                transform:
                // 至少我的独显ubuntu貌似怎么都不行，姑且这样处理吧
                  platform === "linux" && !hasDedicatedGPU
                    ? `translateY(${realIndex * itemHeight}px)`
                    : `translate3d(0, ${realIndex * itemHeight}px, 0)`
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
