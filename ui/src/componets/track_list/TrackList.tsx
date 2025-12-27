import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  MouseEvent as ReactMouseEvent,
  RefObject,
  startTransition,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
} from "react";
import { useVirtualList } from "@mahiru/ui/hook/useVirtualList";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";
import { ColorInstance } from "color";

import Loading from "@mahiru/ui/componets/public/Loading";
import ListItem from "@mahiru/ui/componets/track_list/ListItem";
import VirtualList, { VirtualListRow } from "@mahiru/ui/componets/virtual_list/VirtualList";

export interface TrackListRef {
  containerRef: RefObject<Nullable<HTMLDivElement>>;
  scrollToItem: NormalFunc<[item: number]>;
}

export interface TrackListProps {
  tracks: NeteaseTrack[];
  textColorOnMain: ColorInstance;
  mainColor: ColorInstance;
  source?: number;
  loading?: boolean;
  requestMissedTracks?: number;
  paddingBottom?: number | string;
  entry?: Nullable<PlaylistCacheEntry>;
  onVirtualListRangeUpdate?: NormalFunc<[range: IndexRange]>;
  absoluteIdx?: Nullable<number[]>;
  isLikedPlayList?: boolean;
  currentTrackID?: number;
  onPlay?: NormalFunc<[index: number]>;
  onContextMenu?: OnContextMenuFunc;
  onListScroll?: NormalFunc;
  fastLocation?: boolean;
}

const TrackList: ForwardRefRenderFunction<TrackListRef, TrackListProps> = (
  {
    source,
    tracks,
    absoluteIdx,
    onVirtualListRangeUpdate,
    loading,
    paddingBottom,
    entry,
    requestMissedTracks,
    mainColor,
    textColorOnMain,
    isLikedPlayList,
    currentTrackID,
    onPlay,
    onContextMenu,
    onListScroll,
    fastLocation
  },
  ref
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const extraData = useMemo<ExtraData>(
    () => ({
      isLikedList: isLikedPlayList,
      playlistEntry: entry,
      absoluteIdx,
      currentTrackID,
      textColorOnMain: textColorOnMain.string(),
      isMainColorDark: mainColor.isDark(),
      createPlayHandler: (index: number) => {
        return () => onPlay?.(index);
      },
      onContextMenu,
      fastLocation
    }),
    [
      absoluteIdx,
      currentTrackID,
      entry,
      fastLocation,
      isLikedPlayList,
      mainColor,
      onContextMenu,
      onPlay,
      textColorOnMain
    ]
  );
  const { start, end, scrollToItem } = useVirtualList({
    total: tracks.length,
    containerRef,
    overscan: 10,
    itemHeight: 50,
    onRangeUpdate: onVirtualListRangeUpdate
  });

  const { onScroll } = useScrollAutoHide(containerRef);
  const wrapScroll = useCallback(() => {
    onListScroll?.();
    return onScroll();
  }, [onListScroll, onScroll]);

  // id变化时，重置滚动位置
  useEffect(() => {
    startTransition(() => {
      containerRef.current?.scrollTo({
        top: 0,
        behavior: "instant"
      });
    });
  }, [source]);

  useImperativeHandle(
    ref,
    () => ({
      containerRef,
      scrollToItem
    }),
    [scrollToItem]
  );
  return (
    <>
      <div
        ref={containerRef}
        onScroll={wrapScroll}
        className="w-full h-full overflow-y-auto contain-content will-change-scroll scrollbar">
        <VirtualList
          items={tracks}
          extraData={extraData}
          itemHeight={50}
          RowComponent={RowComponent}
          paddingBottom={paddingBottom}
          start={start}
          end={end}
        />
      </div>
      {loading && (
        <div
          style={{ color: mainColor.hex() }}
          className="absolute flex flex-col justify-center items-center gap-1 font-medium text-lg left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 select-none">
          <Loading className="size-8" />
          {requestMissedTracks !== 0 ? (
            <span className="font-semibold">
              歌曲较多，正在获取 {requestMissedTracks} 首歌曲详情
            </span>
          ) : (
            <span className="font-semibold">加载中</span>
          )}
        </div>
      )}
    </>
  );
};

export type OnContextMenuFunc = NormalFunc<
  [
    e: ReactMouseEvent<HTMLDivElement>,
    props: { track: NeteaseTrack; tracksIdx: number; rawIdx?: number }
  ]
>;

type ExtraData = {
  textColorOnMain: string;
  isMainColorDark: boolean;
  createPlayHandler?: NormalFunc<[number], NormalFunc>;
  playlistEntry?: Nullable<PlaylistCacheEntry>;
  absoluteIdx?: Nullable<number[]>;
  currentTrackID?: Optional<number>;
  onContextMenu?: OnContextMenuFunc;
  fastLocation?: boolean;
  isLikedList?: boolean;
};

const RowComponent: VirtualListRow<NeteaseTrack, ExtraData> = ({ index, items, extra }) => {
  return (
    <ListItem
      textColorOnMain={extra.textColorOnMain}
      isMainColorDark={extra.isMainColorDark}
      tracks={items}
      tracksIdx={index}
      fastLocation={extra.fastLocation}
      playlistEntry={extra.playlistEntry}
      entryTrackIdx={extra.absoluteIdx?.[index]}
      isLikedList={extra.isLikedList}
      active={items[index]?.id === extra.currentTrackID}
      onPlay={extra.createPlayHandler?.(index)}
      onContextMenu={extra.onContextMenu}
    />
  );
};

TrackList.displayName = "ListContainer";
export default memo(forwardRef(TrackList));
