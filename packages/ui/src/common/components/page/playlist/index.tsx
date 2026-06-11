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
import {
  NeteasePlaylist,
  NeteaseTrack,
  NeteaseTrackRecord,
  NeteaseUser
} from "@/common/netease/models";
import type {
  TrackListClickFunc,
  TrackListPlayableManager,
  TrackListRef
} from "@/common/components/display/track_list";
import TrackList from "@/common/components/display/track_list";
import { SearchTrack } from "@mahiru/wasm";
import { PlaylistSource } from "@/common/enum";
import { NeteaseServicesPlaylist } from "@/common/netease/services";
import { useUpdate } from "@/common/hooks/use-update";
import { useTrackCoverPreload } from "@/common/hooks/use-track-cover-preload";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import { Log } from "@/common/lib/log";
import { type RequestStatus } from "@/common/hooks/use-request-wrap";
import { type HeartManager } from "@/common/hooks/use-heart";
import { RendererNet } from "@/common/lib/net";
import AppToast from "@/common/components/display/toast";
import RendererImageConstants from "@/common/constants/image";

import Top from "./top";
import AppLoading from "@/common/components/fallback/app-loading";
import AppError from "@/common/components/fallback/app-error";
import Divider from "@/common/components/layout/divider";

export type PlaylistRef = {
  tracks: NeteaseTrackRecord[];
  totalTracks: RefObject<NeteaseTrackRecord[]>;
  trackListRef: RefObject<Nullable<TrackListRef>>;
  currentVisibleItemIndex: RefObject<number>;
  scrollTop: NormalFunc;
  fastLocator: NormalFunc;
};

interface PlaylistProps {
  ref?: Ref<PlaylistRef>;
  id: Nullable<string>;
  source: Nullable<PlaylistSource>;
  className?: string;
  onPlay: TrackListClickFunc;
  heartManager: Optional<HeartManager>;
  playableManager: Optional<TrackListPlayableManager>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  onReplace: NormalFunc;
  onAddList: NormalFunc;
  onClickAlbum: NormalFunc<[id: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  canScrollTop: Optional<NormalFunc<[enable: boolean]>>;
  canFastLocate: Optional<NormalFunc<[enable: boolean]>>;
  activeTrackID?: number;
  user: Nullable<NeteaseUser>;
  pageActionType?: "enter" | "out" | "none";
  onPageAction?: NormalFunc;
  onCoverLoaded?: NormalFunc<[src: string]>;
  setIsTyping?: NormalFunc<[tying: boolean]>;
  onDataLoaded?: NormalFunc<[playlist: NeteasePlaylist]>;
}

const Playlist: FC<PlaylistProps> = ({
  ref,
  className,
  id,
  source,
  heartManager,
  playableManager,
  user,
  onPlay,
  addToPlaylistNext,
  addToPlaylistLast,
  openComment,
  onReplace,
  onAddList,
  canScrollTop,
  canFastLocate,
  onClickAlbum,
  onClickArtist,
  activeTrackID,
  pageActionType,
  onPageAction,
  onCoverLoaded,
  setIsTyping,
  onDataLoaded
}) => {
  const [status, setStatus] = useState<RequestStatus>("loading");
  const [playlist, setPlaylist] = useState<Nullable<NeteasePlaylist>>(null);
  const [tracks, setTracks] = useState<NeteaseTrackRecord[]>([]);
  const totalTracks = useRef<NeteaseTrackRecord[]>([]);
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

        const result: NeteaseTrackRecord[] = [];
        for (const i of indexs) {
          result.push(totalTracks.current[i]!);
        }

        setTracks(result);
      }
    },
    [searcher]
  );
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
  // 快速定位到当前播放歌曲
  const fastLocator = useCallback(() => {
    if (!activeTrackID) return;
    const exits = tracks.findIndex((t) => t.id === activeTrackID);
    if (exits === -1) return;
    trackListRef.current?.scrollToItem(exits);
  }, [activeTrackID, tracks]);

  useEffect(() => {
    if (!activeTrackID) return;
    const exits = tracks.findIndex((track) => track.id === activeTrackID);
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
  // 切换歌单时重置状态
  const update = useUpdate();
  const reload = useCallback(() => {
    startTransition(() => {
      setStatus("loading");
      update();
    });
  }, [update]);
  useEffect(() => {
    startTransition(() => {
      totalTracks.current = [];
      searcher.update("[]");
      setPlaylist(null);
      setTracks([]);
      setStatus("loading");
    });
  }, [id, source, searcher]);
  // 数据加载
  useEffect(() => {
    let cancel = false;
    if (source === "normal" || source === "like") {
      const playlistID = source === "like" ? user?.likedPlaylist.id : Number(id);
      if (playlistID) {
        NeteaseServicesPlaylist.id(playlistID)
          .then((list) => {
            startTransition(() => {
              if (cancel) return;
              const tracks = NeteaseTrackRecord.fromPlaylist(list);
              searcher.update(NeteaseTrack.toSearchStructString(list.tracks));
              totalTracks.current = tracks;
              setPlaylist(list);
              setTracks(tracks);
              setStatus("success");
            });
          })
          .catch((err) => {
            if (cancel) return;
            startTransition(() => setStatus("error"));
            Log.error(err);
            AppToast.show({
              type: "error",
              text: "请求错误"
            });
          });
      }
    }

    return () => {
      cancel = true;
    };
  }, [
    id,
    searcher,
    source,
    user?.likedPlaylist.id,
    // 手动添加reload依赖
    update.count
  ]);

  useEffect(() => {
    return RendererNet.onOnlineChange(() => {
      RendererNet.isOnline && reload();
    });
  }, [reload]);

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

  useEffect(() => {
    playlist && onDataLoaded?.(playlist);
  }, [onDataLoaded, playlist]);

  return (
    <div className={className}>
      <AppError reset={reload} message="歌曲加载失败" when={status === "error"}>
        <AppLoading loading={status === "loading"} className="w-full h-full">
          <Top
            type={source!}
            loading={false}
            summary={playlist}
            onPlayAll={onReplace}
            onAddList={onAddList}
            searchTracks={searchTracks}
            setIsTyping={setIsTyping}
            onCoverLoaded={onCoverLoaded}
            onPageAction={onPageAction}
            pageActionType={pageActionType}
            coverCacheKey={source === "like" ? String(user?.likedTrackIDs.checkPoint) : undefined}
          />
          {playlist !== null && <Divider className="my-3" />}
          <div className="w-full h-[calc(100%-210px)] relative">
            <TrackList
              ref={trackListRef}
              tracks={tracks}
              id={playlist?.id}
              type={source!}
              activeID={activeTrackID}
              onClick={onPlay}
              onContext={onContextMenu}
              onRangeUpdate={onRangeUpdate}
              onClickAlbum={onClickAlbum}
              onClickArtist={onClickArtist}
              heartManager={heartManager}
              playableManager={playableManager}
              trackCoverSize={coverSize}
            />
          </div>
        </AppLoading>
      </AppError>
    </div>
  );
};

export default memo(Playlist);
