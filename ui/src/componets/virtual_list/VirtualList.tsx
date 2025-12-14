import { FC, memo, useMemo } from "react";

export type VirtualListRow<T extends HasID, U> = FC<{
  items: T[];
  index: number;
  extra: U;
}>;

export interface VirtualListProps<T extends HasID, U> {
  items: T[];
  extraData: U;
  end: number;
  start: number;
  itemHeight: number;
  paddingBottom?: number | string;
  RowComponent: VirtualListRow<T, U>;
}

const VirtualList = <T extends HasID, U>({
  RowComponent,
  paddingBottom,
  itemHeight,
  start,
  end,
  extraData,
  items
}: VirtualListProps<T, U>) => {
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
            }}>
            <RowComponent items={items} index={realIndex} extra={extraData} />
          </div>
        );
      })}
    </div>
  );
};

export default memo(VirtualList) as typeof VirtualList;
