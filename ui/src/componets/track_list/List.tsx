import { ComponentProps, FC, memo, useEffect, useRef } from "react";
import { css, cx } from "@emotion/css";
import { useVirtualList, RowComponentType, ListRef } from "@mahiru/ui/hook/useVirtualList";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import ListItem from "./ListItem";
import Loading from "../public/Loading";
import { useDynamicZustandShallowStore } from "@mahiru/ui/store";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playList";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";

interface ListProps {
  entry: Nullable<PlaylistCacheEntry>;
  id?: number;
  loading: boolean;
  filterTracks: { tracks: NeteaseTrack[]; absoluteIdx: Nullable<number[]> };
  onVirtualListRangeUpdate: (range: IndexRange) => void;
  paddingBottom?: number | string;
}

const ListContainer: FC<ListProps> = ({
  id,
  filterTracks,
  onVirtualListRangeUpdate,
  loading,
  paddingBottom,
  entry
}) => {
  const { userLikedPlayList } = useDynamicZustandShallowStore(["userLikedPlayList"]);
  const { mainColor } = useThemeColor();
  const { tracks, absoluteIdx } = filterTracks;
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  const isLikedPlayList = id === userLikedPlayList?.id;

  const List = useVirtualList({
    items: tracks,
    containerRef,
    overscan: 10,
    itemHeight: 50,
    extraData: { id, isLikedPlayList, absoluteIdx, entry },
    onRangeUpdate: onVirtualListRangeUpdate
  });
  const listRef = useRef<ListRef>(null);
  // id变化时，重置滚动位置
  useEffect(() => {
    listRef.current?.setScrollTop(0);
  }, [id]);
  const { onScrollEnd, onScroll } = useScrollAutoHide(containerRef);
  return (
    <>
      <div
        ref={containerRef}
        onScrollEnd={onScrollEnd}
        onScroll={onScroll}
        className={cx(
          "w-full h-full overflow-y-auto contain-content will-change-scroll scrollbar",
          css`
            -webkit-overflow-scrolling: auto;
          `
        )}>
        <List ref={listRef} RowComponent={RowComponent} paddingBottom={paddingBottom} />
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
    RowComponentType<
      NeteaseTrack,
      { id?: number; absoluteIdx: number[] | null; entry: Nullable<PlaylistCacheEntry> }
    >
  >
) {
  const { index, items, extra } = props;
  return (
    <ListItem
      entry={extra!.entry}
      index={index}
      data={items}
      playListID={extra!.id}
      absoluteIdx={extra!.absoluteIdx}
    />
  );
}
