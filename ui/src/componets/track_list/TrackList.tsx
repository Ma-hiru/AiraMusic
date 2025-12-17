import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  RefObject,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
} from "react";
import { css, cx } from "@emotion/css";
import { useVirtualList } from "@mahiru/ui/hook/useVirtualList";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { usePersistZustandShallowStore, usePlayerStatus } from "@mahiru/ui/store";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";
import Loading from "@mahiru/ui/componets/public/Loading";
import ListItem from "@mahiru/ui/componets/track_list/ListItem";
import VirtualList, { VirtualListRow } from "@mahiru/ui/componets/virtual_list/VirtualList";

export interface TrackListRef {
  containerRef: RefObject<Nullable<HTMLDivElement>>;
}

interface TrackListProps {
  id?: number;
  loading: boolean;
  requestMissedTracks: number;
  paddingBottom?: number | string;
  entry: Nullable<PlaylistCacheEntry>;
  onVirtualListRangeUpdate: NormalFunc<[range: IndexRange]>;
  filterTracks: { tracks: NeteaseTrack[]; absoluteIdx: Nullable<number[]> };
}

const TrackList: ForwardRefRenderFunction<TrackListRef, TrackListProps> = (
  {
    id,
    filterTracks,
    onVirtualListRangeUpdate,
    loading,
    paddingBottom,
    entry,
    requestMissedTracks
  },
  ref
) => {
  const { textColorOnMain, mainColor } = useThemeColor();
  const { trackStatus, audioControl, playerStatus } = usePlayerStatus([
    "trackStatus",
    "audioControl",
    "playerStatus"
  ]);
  const { userLikedListSummary } = usePersistZustandShallowStore(["userLikedListSummary"]);
  const { tracks, absoluteIdx } = filterTracks;
  const containerRef = useRef<HTMLDivElement>(null);
  const isLikedPlayList = id === userLikedListSummary?.id;

  const isPlaying = useRef(false);
  isPlaying.current = playerStatus.playing;
  const play = useRef<Undefinable<NormalFunc>>(undefined);
  play.current = audioControl.current()?.play;

  const extraData = useMemo(
    () => ({
      id,
      isLikedPlayList,
      absoluteIdx,
      entry,
      currentTrackID: trackStatus?.track?.id,
      textColorOnMain: textColorOnMain.string(),
      play: () => {
        if (!isPlaying.current) {
          play.current?.();
        }
      }
    }),
    [absoluteIdx, entry, id, isLikedPlayList, textColorOnMain, trackStatus?.track?.id]
  );

  const { start, end } = useVirtualList({
    total: tracks.length,
    containerRef,
    overscan: 10,
    itemHeight: 50,
    onRangeUpdate: onVirtualListRangeUpdate
  });
  const { onScroll } = useScrollAutoHide(containerRef);
  // id变化时，重置滚动位置
  useEffect(() => {
    containerRef.current?.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }, [id]);
  useImperativeHandle(
    ref,
    () => ({
      containerRef
    }),
    []
  );
  return (
    <>
      <div
        ref={containerRef}
        onScroll={onScroll}
        className={cx(
          "w-full h-full overflow-y-auto contain-content will-change-scroll scrollbar",
          css`
            -webkit-overflow-scrolling: auto;
          `
        )}>
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

const RowComponent: VirtualListRow<
  NeteaseTrack,
  {
    id?: number;
    absoluteIdx: number[] | null;
    entry: Nullable<PlaylistCacheEntry>;
    currentTrackID?: number;
    textColorOnMain: string;
    play?: NormalFunc;
  }
> = ({ index, items, extra }) => {
  const track = items[index];
  return (
    <ListItem
      active={track?.id === extra.currentTrackID}
      textColorOnMain={extra.textColorOnMain}
      entry={extra.entry}
      index={index}
      data={items}
      playListID={extra.id}
      play={extra.play}
      absoluteIndex={extra.absoluteIdx ? extra.absoluteIdx[index]! : index}
    />
  );
};

TrackList.displayName = "ListContainer";
export default memo(forwardRef(TrackList));
