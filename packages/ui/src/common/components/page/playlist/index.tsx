import { cx } from "@emotion/css";
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
import { Log } from "@/common/lib/log";
import { SearchTrack } from "@mahiru/wasm";
import { RendererNet } from "@/common/lib/net";
import { useUpdate } from "@/common/hooks/use-update";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { type HeartManager } from "@/common/hooks/use-heart";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { NeteaseServicesPlaylist } from "@/common/netease/services";
import { type RequestStatus } from "@/common/hooks/use-request-wrap";
import { useAgentFocusCtx } from "@/common/hooks/use-agent-focus-ctx";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import { useTrackCoverPreload } from "@/common/hooks/use-track-cover-preload";
import {
  NeteaseUser,
  NeteaseTrack,
  NeteasePlaylist,
  NeteaseTrackRecord
} from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";
import Divider from "@/common/components/layout/divider";
import AppError from "@/common/components/fallback/app-error";
import RendererImageConstants from "@/common/constants/image";
import TrackList from "@/common/components/display/track_list";
import AppLoading from "@/common/components/fallback/app-loading";
import type {
  TrackListRef,
  TrackListClickFunc,
  TrackListPlayableManager
} from "@/common/components/display/track_list";

import Top from "./top";
import SelectionIndicator from "./selection-indicator";

export type PlaylistRef = {
  reload: NormalFunc;
  scrollTop: NormalFunc;
  fastLocator: NormalFunc;
  tracks: NeteaseTrackRecord[];
  currentVisibleItemIndex: RefObject<number>;
  totalTracks: RefObject<NeteaseTrackRecord[]>;
  trackListRef: RefObject<Nullable<TrackListRef>>;
};

interface PlaylistProps {
  ref?: Ref<PlaylistRef>;
  className?: string;
  id: Nullable<string>;
  routerActive: boolean;
  activeTrackID?: number;
  user: Nullable<NeteaseUser>;
  source: Nullable<"like" | "normal">;
  pageActionType?: "out" | "none" | "enter";
  heartManager: Optional<HeartManager>;
  playableManager: Optional<TrackListPlayableManager>;
  canScrollTop: Optional<NormalFunc<[enable: boolean]>>;
  canFastLocate: Optional<NormalFunc<[enable: boolean]>>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylist: PromiseFunc<[track: NeteaseTrackRecord], boolean>;
  addTracksToPlaylist: PromiseFunc<[tracks: NeteaseTrackRecord[]], boolean>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  setIsTyping?: NormalFunc<[tying: boolean]>;
  onAddList: NormalFunc;
  onReplace: NormalFunc;
  onDeleted?: NormalFunc;
  onPageAction?: NormalFunc;
  onPlay: TrackListClickFunc;
  onClickAlbum: NormalFunc<[id: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  onCoverLoaded?: NormalFunc<[src: string]>;
  onDataLoaded?: NormalFunc<[playlist: NeteasePlaylist]>;
  onEdited: Optional<NormalFunc<[modifiedCover: boolean]>>;
}

const Playlist: FC<PlaylistProps> = ({
  ref,
  id,
  user,
  source,
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
  addTracksToPlaylist,
  openComment,
  setIsTyping,
  onPlay,
  onEdited,
  onAddList,
  onDeleted,
  onReplace,
  onClickAlbum,
  onDataLoaded,
  onPageAction,
  onClickArtist,
  onCoverLoaded,
  routerActive
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
  // 切换歌单时重置状态 / 刷新
  const update = useUpdate();
  const forceUpdateRef = useRef(false);
  const reload = useCallback(
    (forceUpdate = false) => {
      startTransition(() => {
        forceUpdate && (forceUpdateRef.current = true);
        setStatus("loading");
        update();
      });
    },
    [update]
  );

  // 批量选择 + 删除
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const editable = !!playlist && playlist.creator?.userId === user?.profile.userId;
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

  const onBatchAdd = useCallback(async () => {
    const selected = totalTracks.current.filter((t) => selectedIds.has(t.id));
    if (selected.length === 0) return;
    const ok = await addTracksToPlaylist?.(selected);
    ok && exitSelection();
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
    const controller = new AbortController();
    if (source === "normal" || source === "like") {
      const playlistID = source === "like" ? user?.likedPlaylist.id : Number(id);
      if (playlistID) {
        const forceUpdate = forceUpdateRef.current;
        forceUpdateRef.current = false;
        NeteaseServicesPlaylist.id(playlistID, controller.signal, !forceUpdate)
          .then((list) => {
            startTransition(() => {
              if (controller.signal.aborted) return;
              const tracks = NeteaseTrackRecord.fromPlaylist(list);
              searcher.update(NeteaseTrack.toSearchStructString(list.tracks));
              totalTracks.current = tracks;
              setPlaylist(list);
              setTracks(tracks);
              setStatus("success");
            });
          })
          .catch((err) => {
            if (controller.signal.aborted) return;
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
      controller.abort();
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

  useAgentFocusCtx(
    {
      page: "playlist",
      id: typeof id === "string" ? Number(id) : id,
      source: source === "normal" ? "normal" : "user-liked-track"
    },
    routerActive
  );

  return (
    <div className={cx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <AppError reset={reload} message="歌曲加载失败" when={status === "error"}>
        <AppLoading className="h-full w-full" loading={status === "loading"}>
          <Top
            loading={false}
            reload={reload}
            source={source}
            summary={playlist}
            editable={editable}
            setIsTyping={setIsTyping}
            searchTracks={searchTracks}
            selectionMode={selectionMode}
            pageActionType={pageActionType}
            coverCacheKey={source === "like" ? String(user?.likedTrackIDs.checkPoint) : undefined}
            onEdited={onEdited}
            onAddList={onAddList}
            onDeleted={onDeleted}
            onPlayAll={onReplace}
            onPageAction={onPageAction}
            onCoverLoaded={onCoverLoaded}
            onToggleSelectionMode={toggleSelectionMode}
          />
          {playlist !== null && <Divider className="my-3" />}
          <div className="relative min-h-0 w-full flex-1">
            <TrackList
              ref={trackListRef}
              id={playlist?.id}
              tracks={tracks}
              activeID={activeTrackID}
              selectedIds={selectedIds}
              type={source ?? "normal"}
              trackCoverSize={coverSize}
              heartManager={heartManager}
              selectionMode={selectionMode}
              playableManager={playableManager}
              paddingBottom={selectionMode ? 70 : 5}
              onClick={onPlay}
              onContext={onContextMenu}
              onClickAlbum={onClickAlbum}
              onClickArtist={onClickArtist}
              onRangeUpdate={onRangeUpdate}
              onToggleSelect={onToggleSelect}
            />
            {selectionMode && (
              <SelectionIndicator
                tracks={tracks}
                editable={editable}
                selectAll={selectAll}
                selectedIds={selectedIds}
                exitSelection={exitSelection}
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
