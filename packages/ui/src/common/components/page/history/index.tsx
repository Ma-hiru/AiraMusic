import {
  type FC,
  memo,
  type Ref,
  type RefObject,
  startTransition,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { NeteaseHistoryRecord, NeteaseTrackRecord } from "@/common/netease/models";
import type {
  TrackListClickFunc,
  TrackListPlayableManager,
  TrackListRef
} from "@/common/components/display/track_list";
import TrackList from "@/common/components/display/track_list";
import { SearchTrack } from "@mahiru/wasm";
import { PlaylistSource } from "@/common/enum";
import { type HeartManager } from "@/common/hooks/use-heart";
import { useTrackCoverPreload } from "@/common/hooks/use-track-cover-preload";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import RendererImageConstants from "@/common/constants/image";
import RendererPlayerHistory from "@/common/player/history";

import Header from "./header";

export type HistoryRef = {
  tracks: NeteaseHistoryRecord[];
  totalTracks: RefObject<NeteaseHistoryRecord[]>;
  trackListRef: RefObject<Nullable<TrackListRef>>;
  currentVisibleItemIndex: RefObject<number>;
  scrollTop: NormalFunc;
  fastLocator: NormalFunc;
};

interface HistoryProps {
  ref?: Ref<HistoryRef>;
  className?: string;
  historyList: NeteaseHistoryRecord[];
  onPlay: TrackListClickFunc;
  heartManager: Optional<HeartManager>;
  playableManager: Optional<TrackListPlayableManager>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  onClickAlbum: NormalFunc<[id: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  canScrollTop: Optional<NormalFunc<[enable: boolean]>>;
  canFastLocate: Optional<NormalFunc<[enable: boolean]>>;
  activeTrackID?: number;
  pageActionType?: "enter" | "out" | "none";
  onPageAction?: NormalFunc;
  setIsTyping?: NormalFunc<[tying: boolean]>;
}

const History: FC<HistoryProps> = ({
  ref,
  className,
  historyList,
  onPlay,
  heartManager,
  playableManager,
  addToPlaylistNext,
  addToPlaylistLast,
  openComment,
  onClickAlbum,
  onClickArtist,
  canScrollTop,
  canFastLocate,
  activeTrackID,
  pageActionType,
  onPageAction,
  setIsTyping
}) => {
  const [tracks, setTracks] = useState<NeteaseHistoryRecord[]>([]);
  const totalTracks = useRef<NeteaseHistoryRecord[]>([]);
  const trackListRef = useRef<Nullable<TrackListRef>>(null);

  // 搜索曲目
  const searcher = useMemo(() => new SearchTrack(), []);
  const searchTracks = useCallback(
    (k: string) => {
      if (k.trim() === "") {
        setTracks(totalTracks.current);
      } else {
        const lowerK = k.toLowerCase();
        const indexs = Array.from(searcher.search(lowerK));

        const result: NeteaseHistoryRecord[] = [];
        for (const i of indexs) {
          result.push(totalTracks.current[i]!);
        }

        setTracks(result);
      }
    },
    [searcher]
  );
  // 历史列表更新时同步数据与搜索索引
  useEffect(() => {
    totalTracks.current = historyList;
    startTransition(() => {
      setTracks(historyList);
      searcher.update(RendererPlayerHistory.toSearchStruct(historyList));
    });
  }, [historyList, searcher]);
  // 回到顶部
  const scrollTop = useRef(() => trackListRef.current?.scrollToItem(0)).current;
  // 封面预缓存
  const coverSize = RendererImageConstants.PlaylistPageTrackCoverSize;
  const { currentVisibleItemIndex, onRangeUpdate } = useTrackCoverPreload({
    totalTracks,
    visibleCount: tracks.length,
    canScrollTop,
    coverSize
  });
  // 快速定位到当前播放歌曲（稳定引用，内部读取最新数据，避免频繁变更/旧闭包）
  const activeTrackIDRef = useLatestRef(activeTrackID);
  const tracksRef = useLatestRef(tracks);
  const fastLocator = useRef(() => {
    const id = activeTrackIDRef.current;
    if (!id) return;
    const idx = tracksRef.current.findIndex((t) => t.id === id);
    if (idx === -1) return;
    trackListRef.current?.scrollToItem(idx);
  }).current;

  useEffect(() => {
    const exits = activeTrackID ? tracks.findIndex((track) => track.id === activeTrackID) : -1;
    canFastLocate?.(exits !== -1);
  }, [canFastLocate, activeTrackID, tracks]);

  // 右键菜单
  const { onContextMenu } = useTrackContextMenu({
    onPlay,
    onClickAlbum,
    addToPlaylistNext,
    addToPlaylistLast,
    openComment
  });

  useImperativeHandle(
    ref,
    () => ({
      tracks,
      totalTracks,
      trackListRef,
      currentVisibleItemIndex,
      scrollTop,
      fastLocator
    }),
    [currentVisibleItemIndex, fastLocator, scrollTop, tracks]
  );

  return (
    <div className={className}>
      <Header
        count={historyList.length}
        searchTracks={searchTracks}
        setIsTyping={setIsTyping}
        pageActionType={pageActionType}
        onPageAction={onPageAction}
      />
      <div className="w-full h-full pb-18 relative">
        <TrackList
          ref={trackListRef}
          tracks={tracks}
          id={null}
          type={PlaylistSource.History}
          activeID={activeTrackID}
          onClick={onPlay}
          onContext={onContextMenu}
          onRangeUpdate={onRangeUpdate}
          onClickAlbum={onClickAlbum}
          onClickArtist={onClickArtist}
          heartManager={heartManager}
          playableManager={playableManager}
          trackCoverSize={coverSize}
          emptyTips="暂无播放记录"
        />
      </div>
    </div>
  );
};

export default memo(History);
