import {
  memo,
  useRef,
  type FC,
  useMemo,
  type Ref,
  useState,
  useEffect,
  useCallback,
  type RefObject,
  startTransition,
  useImperativeHandle
} from "react";
import { SearchTrack } from "@mahiru/wasm";
import { RendererFormat } from "@/common/lib/format";
import { type HeartManager } from "@/common/hooks/use-heart";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useAgentFocusCtx } from "@/common/hooks/use-agent-focus-ctx";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import { useTrackCoverPreload } from "@/common/hooks/use-track-cover-preload";
import { NeteaseTrackRecord, NeteaseHistoryRecord } from "@/common/netease/models";
import RendererPlayerHistory from "@/common/player/history";
import RendererImageConstants from "@/common/constants/image";
import TrackList from "@/common/components/display/track_list";
import type {
  TrackListRef,
  TrackListClickFunc,
  TrackListPlayableManager
} from "@/common/components/display/track_list";

import Header from "./header";

export type HistoryRef = {
  scrollTop: NormalFunc;
  fastLocator: NormalFunc;
  tracks: NeteaseHistoryRecord[];
  currentVisibleItemIndex: RefObject<number>;
  totalTracks: RefObject<NeteaseHistoryRecord[]>;
  trackListRef: RefObject<Nullable<TrackListRef>>;
};

interface HistoryProps {
  ref?: Ref<HistoryRef>;
  className?: string;
  routerActive: boolean;
  activeTrackID?: number;
  historyList: NeteaseHistoryRecord[];
  pageActionType?: "out" | "none" | "enter";
  heartManager: Optional<HeartManager>;
  playableManager: Optional<TrackListPlayableManager>;
  canScrollTop: Optional<NormalFunc<[enable: boolean]>>;
  canFastLocate: Optional<NormalFunc<[enable: boolean]>>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylist: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  setIsTyping?: NormalFunc<[tying: boolean]>;
  onPageAction?: NormalFunc;
  onPlay: TrackListClickFunc;
  onClickAlbum: NormalFunc<[id: number]>;
  onClickArtist: NormalFunc<[id: number]>;
}

const History: FC<HistoryProps> = ({
  ref,
  className,
  activeTrackID,
  pageActionType,
  heartManager,
  playableManager,
  canScrollTop,
  canFastLocate,
  addToPlaylistLast,
  addToPlaylistNext,
  addTrackToPlaylist,
  openComment,
  setIsTyping,
  onPlay,
  onClickAlbum,
  onPageAction,
  onClickArtist,
  historyList,
  routerActive
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
  const { onRangeUpdate, currentVisibleItemIndex } = useTrackCoverPreload({
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
    openComment,
    addTrackToPlaylist
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

  useAgentFocusCtx(
    useMemo(
      () => ({
        page: "history",
        recent: tracks.slice(0, 100).map((t) => ({
          name: t.name,
          id: t.id,
          playDuration: RendererFormat.duration(t.playDuration),
          time: RendererFormat.time(t.time)
        }))
      }),
      [tracks]
    ),
    routerActive
  );

  return (
    <div className={className}>
      <Header
        setIsTyping={setIsTyping}
        count={historyList.length}
        searchTracks={searchTracks}
        pageActionType={pageActionType}
        onPageAction={onPageAction}
      />
      <div className="w-full h-full pb-18 relative">
        <TrackList
          ref={trackListRef}
          id={null}
          type="history"
          tracks={tracks}
          emptyTips="暂无播放记录"
          activeID={activeTrackID}
          trackCoverSize={coverSize}
          heartManager={heartManager}
          playableManager={playableManager}
          onClick={onPlay}
          onContext={onContextMenu}
          onClickAlbum={onClickAlbum}
          onClickArtist={onClickArtist}
          onRangeUpdate={onRangeUpdate}
        />
      </div>
    </div>
  );
};

export default memo(History);
