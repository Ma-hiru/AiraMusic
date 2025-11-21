import { FC, RefObject, useCallback, useEffect, useState } from "react";

interface HasID {
  id: string | number;
}

export type RowComponentType<T> = FC<{
  items: T[];
  index: number;
}>;

export type ListComponentType<T> = FC<{
  RowComponent: RowComponentType<T>;
}>;

export function useVirtualList<T extends HasID>(
  items: T[],
  containerRef: RefObject<Nullable<HTMLDivElement>>,
  overscan: number = 5,
  itemHeight: number = 64
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

  return useCallback<ListComponentType<T>>(
    ({ RowComponent }) => {
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
                  transform: `translate3d(0, ${realIndex * itemHeight}px, 0)`
                }}>
                <RowComponent items={items} index={realIndex} />
              </div>
            );
          })}
        </div>
      );
    },
    [start, items, end, total, itemHeight]
  );
}
