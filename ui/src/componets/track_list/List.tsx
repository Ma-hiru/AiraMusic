import { ComponentProps, FC, memo, useEffect, useRef } from "react";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { css, cx } from "@emotion/css";
import { useVirtualList, RowComponentType, ListRef } from "@mahiru/ui/hook/useVirtualList";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import ListItem from "./ListItem";
import Loading from "../public/Loading";

interface ListProps {
  id?: number;
  loading: boolean;
  filterTracks: { tracks: NeteaseTrack[]; absoluteIdx: Nullable<number[]> };
  onVirtualListRangeUpdate: (range: IndexRange) => void;
}

const ListContainer: FC<ListProps> = ({ id, filterTracks, onVirtualListRangeUpdate, loading }) => {
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  const { mainColor } = useThemeColor();
  const List = useVirtualList(
    filterTracks.tracks,
    containerRef,
    10,
    50,
    { id, absoluteIdx: filterTracks.absoluteIdx },
    onVirtualListRangeUpdate
  );
  const listRef = useRef<ListRef>(null);
  // id变化时，重置滚动位置
  useEffect(() => {
    listRef.current?.setScrollTop(0);
  }, [id]);
  return (
    <>
      <div
        ref={containerRef}
        className={cx(
          "w-full h-full overflow-y-auto contain-content will-change-scroll",
          css`
            scrollbar-width: none;
            -webkit-overflow-scrolling: auto;
          `
        )}>
        <List ref={listRef} RowComponent={RowComponent} />
      </div>
      {loading && (
        <div
          style={{ color: mainColor }}
          className="absolute flex flex-col justify-center items-center gap-1 font-medium text-lg left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 select-none">
          <Loading className="size-8" />
          <span className="font-semibold">加载中</span>
        </div>
      )}
    </>
  );
};

export default memo(ListContainer);

function RowComponent(
  props: ComponentProps<
    RowComponentType<NeteaseTrack, { id?: number; absoluteIdx: number[] | null }>
  >
) {
  const { index, items, extra } = props;
  return (
    <ListItem index={index} data={items} playListID={extra!.id} absoluteIdx={extra!.absoluteIdx} />
  );
}
