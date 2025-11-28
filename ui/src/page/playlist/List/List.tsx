import { ComponentProps, FC, memo, useEffect, useRef } from "react";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { css, cx } from "@emotion/css";
import ListItem from "@mahiru/ui/page/playlist/List/ListItem";
import { useVirtualList, RowComponentType, ListRef } from "@mahiru/ui/hook/useVirtualList";
import Loading from "@mahiru/ui/componets/public/Loading";

interface ListProps {
  filterTracks: { tracks: NeteaseTrack[]; absoluteIdx: number[] | null };
  id: number;
  isLikedList?: boolean;
  onVirtualListRangeUpdate: (range: IndexRange) => void;
}

const ListContainer: FC<ListProps> = ({
  filterTracks,
  id,
  isLikedList = false,
  onVirtualListRangeUpdate
}) => {
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  const List = useVirtualList(
    filterTracks.tracks,
    containerRef,
    10,
    50,
    { id, isLikedList, absoluteIdx: filterTracks.absoluteIdx },
    onVirtualListRangeUpdate
  );
  const listRef = useRef<ListRef>(null);
  // id变化时，重置滚动位置
  useEffect(() => {
    listRef.current?.setScrollTop(0);
  }, [id]);
  return (
    <div className="w-full h-[calc(100%-210px)] relative">
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
      {filterTracks.tracks.length === 0 && (
        <div className="flex flex-col justify-center items-center gap-1 font-medium text-lg absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 text-black/70 select-none">
          <Loading className="size-8" />
          <span className="font-semibold">加载中</span>
        </div>
      )}
    </div>
  );
};

export default memo(ListContainer);

function RowComponent(
  props: ComponentProps<
    RowComponentType<
      NeteaseTrack,
      { id: number; isLikedList: boolean; absoluteIdx: number[] | null }
    >
  >
) {
  const { index, items, extra } = props;
  return (
    <ListItem
      index={index}
      data={items}
      playListID={extra!.id}
      isLikedList={extra!.isLikedList}
      absoluteIdx={extra!.absoluteIdx}
    />
  );
}
