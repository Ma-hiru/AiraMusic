import { cx } from "@emotion/css";
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
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { NeteaseServicesPlaylist } from "@/common/netease/services";
import { useUpdate } from "@/common/hooks/use-update";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useTrackCoverPreload } from "@/common/hooks/use-track-cover-preload";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import { Log } from "@/common/lib/log";
import { type RequestStatus } from "@/common/hooks/use-request-wrap";
import { type HeartManager } from "@/common/hooks/use-heart";
import { RendererNet } from "@/common/lib/net";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import AppToast from "@/common/components/display/toast";
import RendererImageConstants from "@/common/constants/image";

import Top from "./top";
import SelectionIndicator from "./selection-indicator";
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
  reload: NormalFunc;
};

interface PlaylistProps {
  ref?: Ref<PlaylistRef>;
  id: Nullable<string>;
  source: Nullable<"like" | "normal">;
  className?: string;
  onPlay: TrackListClickFunc;
  heartManager: Optional<HeartManager>;
  playableManager: Optional<TrackListPlayableManager>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylist: NormalFunc<[track: NeteaseTrackRecord]>;
  addTracksToPlaylist?: NormalFunc<[tracks: NeteaseTrackRecord[]]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  onReplace: NormalFunc;
  onAddList: NormalFunc;
  onClickAlbum: NormalFunc<[id: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  onEdited: Optional<NormalFunc>;
  onDeleted?: NormalFunc;
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
  addTrackToPlaylist,
  addTracksToPlaylist,
  onEdited,
  onDeleted,
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
  // 切换歌单时重置状态 / 刷新
  const update = useUpdate();
  const reload = useCallback(() => {
    startTransition(() => {
      setStatus("loading");
      update();
    });
  }, [update]);

  // 批量选择 + 删除
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const editable =
    !!playlist && playlist.creator?.userId === user?.profile.userId && source !== "like";
  // 选择切换
  const onToggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  // 退出选择
  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);
  // 切换选择模式
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((m) => !m);
    setSelectedIds(new Set());
  }, []);
  // 全选（已全选就取消）
  const selectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === tracks.length ? new Set() : new Set(tracks.map((t) => t.id))
    );
  }, [tracks]);

  const playlistIDRef = useLatestRef({ id, source });
  const removeTracks = useCallback(
    async (ids: number[]) => {
      const pid = playlist?.id;
      if (!pid || ids.length === 0) return true;
      if (!user?.isLoggedIn) {
        AppToast.show({
          type: "info",
          text: "请先登录"
        });
        return false;
      }
      try {
        const res = await NeteaseAPIPlaylist.modify({ op: "del", pid, tracks: ids });
        if (res.status !== 200) {
          AppToast.show({
            type: "info",
            text: "删除失败"
          });
          return false;
        }
        RendererIPCMessageBus.modified.twoWay({
          type: "playlist-update",
          source: playlistIDRef.current.source,
          id: playlistIDRef.current.id
        });
        RendererIPCMessageBus.modified.twoWay({
          type: "user-playlist"
        });
        AppToast.show({
          type: "success",
          text: `已删除 ${ids.length} 首`
        });
        return true;
      } catch (err) {
        Log.error(err);
        AppToast.show({
          type: "error",
          text: "删除失败，请重试"
        });
        return false;
      }
    },
    [playlist?.id, playlistIDRef, user?.isLoggedIn]
  );

  const onBatchDelete = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const ok = await removeTracks(ids);
    ok && exitSelection();
  }, [selectedIds, removeTracks, exitSelection]);

  const onBatchAdd = useCallback(() => {
    const selected = totalTracks.current.filter((t) => selectedIds.has(t.id));
    if (selected.length === 0) return;
    addTracksToPlaylist?.(selected);
    exitSelection();
  }, [addTracksToPlaylist, exitSelection, selectedIds]);

  const removeSingle = useCallback(
    (track: NeteaseTrackRecord) => void removeTracks([track.id]),
    [removeTracks]
  );

  // 右键菜单
  const { onContextMenu } = useTrackContextMenu({
    onPlay,
    onClickAlbum,
    addToPlaylistNext,
    addToPlaylistLast,
    openComment,
    removeFromPlaylist: editable ? removeSingle : undefined,
    addTrackToPlaylist
  });
  useEffect(() => {
    startTransition(() => {
      totalTracks.current = [];
      searcher.update("[]");
      setPlaylist(null);
      setTracks([]);
      setStatus("loading");
      setSelectionMode(false);
      setSelectedIds(new Set());
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
      fastLocator,
      reload
    }),
    [currentVisibleItemIndex, fastLocator, reload, scrollTop, tracks]
  );

  useEffect(() => {
    playlist && onDataLoaded?.(playlist);
  }, [onDataLoaded, playlist]);

  return (
    <div className={cx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <AppError reset={reload} message="歌曲加载失败" when={status === "error"}>
        <AppLoading loading={status === "loading"} className="h-full w-full">
          <Top
            editable={editable}
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
            onEdited={() => {
              reload();
              onEdited?.();
            }}
            onDeleted={onDeleted}
            selectionMode={selectionMode}
            onToggleSelectionMode={toggleSelectionMode}
          />
          {playlist !== null && <Divider className="my-3" />}
          <div className="relative min-h-0 w-full flex-1">
            <TrackList
              ref={trackListRef}
              tracks={tracks}
              paddingBottom={selectionMode ? 70 : 5}
              id={playlist?.id}
              type={source ?? "normal"}
              activeID={activeTrackID}
              onClick={onPlay}
              onContext={onContextMenu}
              onRangeUpdate={onRangeUpdate}
              onClickAlbum={onClickAlbum}
              onClickArtist={onClickArtist}
              heartManager={heartManager}
              playableManager={playableManager}
              trackCoverSize={coverSize}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
            />
            {selectionMode && (
              <SelectionIndicator
                editable={editable}
                selectedIds={selectedIds}
                exitSelection={exitSelection}
                tracks={tracks}
                selectAll={selectAll}
                onBatchAdd={onBatchAdd}
                onBatchDelete={onBatchDelete}
              />
            )}
          </div>
        </AppLoading>
      </AppError>
    </div>
  );
};

export default memo(Playlist);
