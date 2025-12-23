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
  useRef,
  useState
} from "react";
import { useVirtualList } from "@mahiru/ui/hook/useVirtualList";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { usePersistZustandShallowStore, usePlayerStatus } from "@mahiru/ui/store";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";
import Loading from "@mahiru/ui/componets/public/Loading";
import ListItem from "@mahiru/ui/componets/track_list/ListItem";
import VirtualList, { VirtualListRow } from "@mahiru/ui/componets/virtual_list/VirtualList";
import { useContextMenu } from "@mahiru/ui/hook/useContextMenu";
import { createContextMenu } from "@mahiru/ui/componets/track_list/createContextMenu";
import { useInfoWindow } from "@mahiru/ui/hook/useInfoWindow";

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
  rawTracks: RefObject<NeteaseTrack[]>;
}

const TrackList: ForwardRefRenderFunction<TrackListRef, TrackListProps> = (
  {
    id,
    filterTracks,
    onVirtualListRangeUpdate,
    loading,
    paddingBottom,
    entry,
    requestMissedTracks,
    rawTracks
  },
  ref
) => {
  const { textColorOnMain, mainColor } = useThemeColor();
  const { trackStatus, audioControl, playerStatus, setLocateCurrentTrack } = usePlayerStatus([
    "trackStatus",
    "audioControl",
    "playerStatus",
    "setLocateCurrentTrack"
  ]);
  const { userLikedListSummary } = usePersistZustandShallowStore(["userLikedListSummary"]);
  const [fastLocation, setFastLocation] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLikedPlayList = id === userLikedListSummary?.id;

  const isPlaying = useRef(false);
  isPlaying.current = playerStatus.playing;
  const play = useRef<Undefinable<NormalFunc>>(undefined);
  play.current = audioControl.current()?.play;

  const { setContextMenuRenderer, setContextMenuVisible, contextMenuVisible } = useContextMenu();
  const { openInfoWindow } = useInfoWindow();
  const onContextMenu = useCallback<OnContextMenuFunc>(
    (e, { track, index, absoluteIndex }) => {
      setContextMenuRenderer?.(
        createContextMenu({
          track,
          index,
          absoluteIndex,
          clientX: e.clientX,
          clientY: e.clientY,
          source: id,
          openInfoWindow
        })
      );
      setContextMenuVisible?.(true);
    },
    [id, openInfoWindow, setContextMenuRenderer, setContextMenuVisible]
  );

  const extraData = useMemo<ExtraData>(
    () => ({
      id,
      isLikedPlayList,
      absoluteIdx: filterTracks.absoluteIdx,
      entry,
      currentTrackID: trackStatus?.track?.id,
      textColorOnMain: textColorOnMain.string(),
      isMainColorDark: mainColor.isDark(),
      play: () => {
        if (!isPlaying.current) {
          play.current?.();
        }
      },
      onContextMenu,
      rawTracks,
      fastLocation
    }),
    [
      entry,
      fastLocation,
      filterTracks.absoluteIdx,
      id,
      isLikedPlayList,
      mainColor,
      onContextMenu,
      rawTracks,
      textColorOnMain,
      trackStatus?.track?.id
    ]
  );
  const { start, end, scrollToItem } = useVirtualList({
    total: filterTracks.tracks.length,
    containerRef,
    overscan: 10,
    itemHeight: 50,
    onRangeUpdate: onVirtualListRangeUpdate
  });
  const { onScroll } = useScrollAutoHide(containerRef);

  const wrapScroll = useCallback(() => {
    if (contextMenuVisible) {
      setContextMenuVisible?.(false);
    }
    return onScroll();
  }, [contextMenuVisible, onScroll, setContextMenuVisible]);

  // id变化时，重置滚动位置
  useEffect(() => {
    startTransition(() => {
      containerRef.current?.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  }, [id]);

  // 定位当前播放歌曲
  useEffect(() => {
    const currentTrackIndex = filterTracks.tracks.findIndex(
      (track) => track.id === trackStatus?.track?.id
    );
    const scrollTo = () => {
      startTransition(() => {
        setFastLocation(true);
        scrollToItem(currentTrackIndex);

        requestIdleCallback(() => {
          startTransition(() => {
            setFastLocation(false);
          });
        });
      });
    };
    if (currentTrackIndex !== -1) {
      setLocateCurrentTrack(() => scrollTo);
    }
    return () => {
      setLocateCurrentTrack(null);
    };
  }, [filterTracks.tracks, scrollToItem, setLocateCurrentTrack, trackStatus?.track?.id]);

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
        onScroll={wrapScroll}
        className="w-full h-full overflow-y-auto contain-content will-change-scroll scrollbar">
        <VirtualList
          items={filterTracks.tracks}
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

type OnContextMenuFunc = NormalFunc<
  [
    e: ReactMouseEvent<HTMLDivElement>,
    props: { track: NeteaseTrack; index: number; absoluteIndex: number }
  ]
>;

type ExtraData = {
  id?: number;
  absoluteIdx: number[] | null;
  entry: Nullable<PlaylistCacheEntry>;
  currentTrackID?: number;
  textColorOnMain: string;
  play?: NormalFunc;
  isMainColorDark: boolean;
  onContextMenu?: OnContextMenuFunc;
  rawTracks: RefObject<NeteaseTrack[]>;
  fastLocation?: boolean;
};

const RowComponent: VirtualListRow<NeteaseTrack, ExtraData> = ({ index, items, extra }) => {
  const track = items[index];
  return (
    <ListItem
      onContextMenu={extra.onContextMenu}
      active={track?.id === extra.currentTrackID}
      textColorOnMain={extra.textColorOnMain}
      playlistEntry={extra.entry}
      filterIndex={index}
      fastLocation={extra.fastLocation}
      filterTracks={items}
      rawTracks={extra.rawTracks}
      playListID={extra.id}
      play={extra.play}
      isMainColorDark={extra.isMainColorDark}
      rawIndex={extra.absoluteIdx ? extra.absoluteIdx[index]! : index}
    />
  );
};

TrackList.displayName = "ListContainer";
export default memo(forwardRef(TrackList));
