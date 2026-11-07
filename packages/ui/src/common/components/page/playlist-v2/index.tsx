import { cx } from "@emotion/css";
import { GlobeOff, ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  memo,
  useId,
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
import { RendererNet } from "@/common/lib/net";
import { RendererWindow } from "@/common/lib/window";
import { useOnline } from "@/common/hooks/use-online";
import { useUpdate } from "@/common/hooks/use-update";
import { PlaylistCollectionIndex } from "@mahiru/wasm";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { type HeartManager } from "@/common/hooks/use-heart";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { settingsStoreSnapshot } from "@/common/store/settings";
import { RoutePathMain, RoutePathDisplay } from "@/common/routes";
import { NeteaseServicesPlaylist } from "@/common/netease/services";
import { type RequestStatus } from "@/common/hooks/use-request-wrap";
import { useAgentFocusCtx } from "@/common/hooks/use-agent-focus-ctx";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import { useTrackCoverPreload } from "@/common/hooks/use-track-cover-preload";
import { NeteaseUser, NeteasePlaylist, NeteaseTrackRecord } from "@/common/netease/models";
import {
  readLikedCollection,
  type LikedCollection,
  serializeCollectionTracks
} from "@/common/utils/liked-collection";
import AppToast from "@/common/components/display/toast";
import AppError from "@/common/components/fallback/app-error";
import RendererImageConstants from "@/common/constants/image";
import TrackList from "@/common/components/display/track_list";
import AppLoading from "@/common/components/fallback/app-loading";
import type { PlaylistScope } from "@/common/types/playlist-scope";
import type { PlaylistModifyType } from "@/common/hooks/use-playlist-modify-sync";
import type {
  TrackListRef,
  TrackListClickFunc,
  TrackListPlayableManager
} from "@/common/components/display/track_list";

import Top from "./top";
import LikedAlbums from "./liked-albums";
import LikedArtists from "./liked-artists";
import SimilarPlaylists from "./similar-playlists";
import SelectionIndicator from "./selection-indicator";
import ContentTabs, { type PlaylistTab } from "./content-tabs";

export type PlaylistRef = {
  reload: NormalFunc;
  scrollTop: NormalFunc;
  fastLocator: NormalFunc;
  tracks: NeteaseTrackRecord[];
  scope?: Nullable<PlaylistScope>;
  currentVisibleItemIndex: RefObject<number>;
  totalTracks: RefObject<NeteaseTrackRecord[]>;
  trackListRef: RefObject<Nullable<TrackListRef>>;
  playbackTracks?: RefObject<NeteaseTrackRecord[]>;
};

interface PlaylistProps {
  ref?: Ref<PlaylistRef>;
  className?: string;
  id: Nullable<string>;
  routerActive: boolean;
  activeTrackID?: number;
  user: Nullable<NeteaseUser>;
  source: Nullable<"like" | "normal">;
  initialScope?: Nullable<PlaylistScope>;
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
  onEdited: Optional<NormalFunc<[modifies: PlaylistModifyType[]]>>;
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
  initialScope,
  routerActive
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const tabsID = useId();
  const [activeTab, setActiveTab] = useState<PlaylistTab>("tracks");
  const [status, setStatus] = useState<RequestStatus>("loading");
  const [playlist, setPlaylist] = useState<Nullable<NeteasePlaylist>>(null);
  const [records, setRecords] = useState<NeteaseTrackRecord[]>([]);
  const [scope, setScope] = useState<Nullable<PlaylistScope>>(initialScope ?? null);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState<{ query: string; tab: PlaylistTab }>({
    tab: "tracks",
    query: ""
  });
  const [collection, setCollection] = useState<LikedCollection>({
    duration: 0,
    albumCount: 0,
    artists: [],
    albums: []
  });
  const collectionIndex = useRef<Nullable<PlaylistCollectionIndex>>(null);
  const totalTracks = useRef<NeteaseTrackRecord[]>([]);
  const trackListRef = useRef<Nullable<TrackListRef>>(null);
  const isLikedList = source === "like" || (!!playlist && playlist.id === user?.likedPlaylist.id);
  const selectedGroup =
    isLikedList && scope
      ? (scope.kind === "artist" ? collection.artists : collection.albums).find(
          (group) => group.key === scope.key
        )
      : undefined;
  const currentScope = selectedGroup ? scope : null;
  const query = search.tab === activeTab ? search.query : "";
  const tracks = useMemo(() => {
    const index = collectionIndex.current;
    const keyword = activeTab === "tracks" ? query : "";
    if (!keyword.trim() && !currentScope) return records;
    if (!index) return [];
    return Array.from(
      index.searchTracks(keyword, currentScope?.kind, currentScope?.key),
      (i) => records[i]!
    );
  }, [records, currentScope, query, activeTab]);
  const playbackTracks = useMemo(() => {
    if (!currentScope) return { current: records };
    const index = collectionIndex.current;
    return {
      current: index
        ? Array.from(
            index.searchTracks("", currentScope.kind, currentScope.key),
            (i) => records[i]!
          )
        : []
    };
  }, [records, currentScope]);
  const artists = useMemo(() => {
    if (activeTab !== "artists" || !query.trim()) return collection.artists;
    const index = collectionIndex.current;
    return index ? Array.from(index.searchArtists(query), (i) => collection.artists[i]!) : [];
  }, [activeTab, collection, query]);
  const albums = useMemo(() => {
    if (activeTab !== "albums" || !query.trim()) return collection.albums;
    const index = collectionIndex.current;
    return index ? Array.from(index.searchAlbums(query), (i) => collection.albums[i]!) : [];
  }, [activeTab, collection, query]);

  useEffect(() => {
    if (isLikedList) void trackListRef.current?.scrollToItem(0);
  }, [isLikedList, currentScope?.kind, currentScope?.key]);

  // 三个页签共用输入框，计算与搜索由同一个 WASM 索引处理。
  const searchTracks = useCallback(
    (query: string) => setSearch({ tab: activeTab, query }),
    [activeTab]
  );
  const activeTabRef = useLatestRef(activeTab);
  const resetSearchForTracks = useCallback(() => {
    if (activeTabRef.current === "tracks") return;
    setKeyword("");
    setSearch({ tab: "tracks", query: "" });
  }, [activeTabRef]);
  // 回到顶部
  const scrollTop = useRef(() => {
    resetSearchForTracks();
    setActiveTab("tracks");
    trackListRef.current?.scrollToItem(0);
  }).current;
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
    resetSearchForTracks();
    setActiveTab("tracks");
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
    resetSearchForTracks();
    setActiveTab("tracks");
    setSelectionMode((m) => !m);
    setSelectedIds(new Set());
  }, [resetSearchForTracks]);
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
    onClickArtist,
    addToPlaylistNext,
    addToPlaylistLast,
    openComment,
    removeFromPlaylist: editable ? removeSingle : undefined,
    addTrackToPlaylist
  });
  useEffect(() => {
    startTransition(() => {
      totalTracks.current = [];
      setPlaylist(null);
      setRecords([]);
      setCollection({ duration: 0, albumCount: 0, artists: [], albums: [] });
      setStatus("loading");
      setSelectionMode(false);
      setSelectedIds(new Set());
    });
  }, [id, source, user?.likedPlaylist.id]);
  const initialScopeKind = initialScope?.kind;
  const initialScopeKey = initialScope?.key;
  const scopeRef = useLatestRef(scope);
  const scopeResourceRef = useRef({ id, source, likedPlaylistID: user?.likedPlaylist.id });
  useEffect(() => {
    const previous = scopeResourceRef.current;
    const sameResource =
      previous.id === id &&
      previous.source === source &&
      previous.likedPlaylistID === user?.likedPlaylist.id;
    scopeResourceRef.current = { id, source, likedPlaylistID: user?.likedPlaylist.id };
    // 本地选择会 replace URL；相同范围的回声不应重置刚切换的页签。
    if (
      sameResource &&
      initialScopeKind === scopeRef.current?.kind &&
      initialScopeKey === scopeRef.current?.key
    ) {
      return;
    }
    exitSelection();
    setScope(
      initialScopeKind && initialScopeKey ? { kind: initialScopeKind, key: initialScopeKey } : null
    );
    setActiveTab("tracks");
    setKeyword("");
    setSearch({ tab: "tracks", query: "" });
  }, [
    id,
    source,
    user?.likedPlaylist.id,
    initialScopeKind,
    initialScopeKey,
    exitSelection,
    scopeRef
  ]);
  // 数据加载
  useEffect(() => {
    const controller = new AbortController();
    let index: Nullable<PlaylistCollectionIndex> = null;
    if (source === "normal" || source === "like") {
      const playlistID = source === "like" ? user?.likedPlaylist.id : Number(id);
      if (playlistID) {
        const forceUpdate = forceUpdateRef.current;
        forceUpdateRef.current = false;
        NeteaseServicesPlaylist.id(playlistID, controller.signal, !forceUpdate)
          .then((list) => {
            if (controller.signal.aborted) return;
            index = new PlaylistCollectionIndex();
            index.update(serializeCollectionTracks(list.tracks));
            const collection = readLikedCollection(index);
            startTransition(() => {
              if (controller.signal.aborted) return;
              const tracks = NeteaseTrackRecord.fromPlaylist(list);
              collectionIndex.current = index;
              totalTracks.current = tracks;
              setPlaylist(list);
              setRecords(tracks);
              setCollection(collection);
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
      if (collectionIndex.current === index) collectionIndex.current = null;
      index?.free();
    };
  }, [
    id,
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
      playbackTracks,
      scope: currentScope,
      trackListRef,
      currentVisibleItemIndex,
      scrollTop,
      fastLocator,
      reload
    }),
    [currentVisibleItemIndex, currentScope, fastLocator, playbackTracks, reload, scrollTop, tracks]
  );

  useEffect(() => {
    playlist && onDataLoaded?.(playlist);
  }, [onDataLoaded, playlist]);

  const contextPlaylistID =
    source === "like" ? (user?.likedPlaylist.id ?? null) : id ? Number(id) : null;
  useAgentFocusCtx(
    {
      page: "playlist",
      id: contextPlaylistID,
      name:
        playlist?.id === contextPlaylistID
          ? playlist.name
          : source === "like"
            ? "我喜欢的音乐"
            : "",
      source: source === "normal" ? "normal" : "user-liked-track"
    },
    routerActive
  );

  const { online } = useOnline();

  const updateScope = useCallback(
    (scope: Nullable<PlaylistScope>) => {
      setScope(scope);
      const route = RendererWindow.isMain ? RoutePathMain : RoutePathDisplay;
      if (!isLikedList || location.pathname !== route.playlist.base) return;
      const current = route.playlist.parseQuery(location, false).scope;
      if (current?.kind === scope?.kind && current?.key === scope?.key) return;
      const search = new URLSearchParams(location.search);
      if (scope) search.set("scope", JSON.stringify(scope));
      else search.delete("scope");
      void navigate(
        { pathname: location.pathname, search: search.toString(), hash: location.hash },
        { replace: true }
      );
    },
    [isLikedList, location, navigate]
  );
  const selectScope = useCallback(
    (scope: PlaylistScope) => {
      exitSelection();
      updateScope(scope);
      setActiveTab("tracks");
      setKeyword("");
      setSearch({ tab: "tracks", query: "" });
    },
    [exitSelection, updateScope]
  );
  const changeTab = useCallback(
    (tab: PlaylistTab) => {
      if (tab === activeTab) return;
      exitSelection();
      updateScope(null);
      setActiveTab(tab);
      setKeyword("");
      setSearch({ tab, query: "" });
    },
    [activeTab, exitSelection, updateScope]
  );

  // 从收听卡片定位歌曲：先清掉歌手/专辑筛选，否则目标可能不在当前列表里
  const [locateTarget, setLocateTarget] = useState<Nullable<number>>(null);
  const locateSong = useCallback(
    (songID: number) => {
      if (!totalTracks.current.some((track) => track.id === songID)) {
        AppToast.show({ type: "info", text: "歌曲已被移除" });
        return;
      }
      exitSelection();
      updateScope(null);
      setKeyword("");
      setSearch({ tab: "tracks", query: "" });
      setActiveTab("tracks");
      setLocateTarget(songID);
    },
    [exitSelection, updateScope]
  );
  // 等筛选清空、列表恢复完整数据后再滚动，避免定位到错误的行号
  useEffect(() => {
    if (locateTarget == null || activeTab !== "tracks") return;
    const index = tracks.findIndex((track) => track.id === locateTarget);
    if (index === -1) return;
    trackListRef.current?.scrollToItem(index);
    setLocateTarget(null);
  }, [activeTab, locateTarget, tracks]);

  const openSimilarPlaylist = useCallback(
    async (playlistID: number) => {
      if (playlistID === playlist?.id) return;
      if (
        RendererWindow.isMain &&
        settingsStoreSnapshot()._settings.preference.defaultUseDisplayWindow
      ) {
        NeteaseServicesPlaylist.preload(playlistID);
        await RendererWindow.display.reactReadyAwait();
        RendererIPCMessageBus.display.deliver({
          type: "playlist",
          source: "normal",
          id: playlistID
        });
        return;
      }
      const route = RendererWindow.isMain ? RoutePathMain : RoutePathDisplay;
      await navigate(route.playlist.withQuery(playlistID, "normal"));
    },
    [navigate, playlist?.id]
  );

  return (
    <div className={cx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <AppError
        reset={reload}
        when={status === "error"}
        tipsIcon={!online ? GlobeOff : undefined}
        tips={!online ? "网络连接中断，请检查网络后重试" : undefined}>
        <AppLoading className="h-full w-full" loading={status === "loading"}>
          <Top
            user={user}
            loading={false}
            reload={reload}
            source={source}
            summary={playlist}
            editable={editable}
            collection={collection}
            setIsTyping={setIsTyping}
            searchTracks={searchTracks}
            selectionMode={selectionMode}
            pageActionType={pageActionType}
            coverCacheKey={source === "like" ? String(user?.likedTrackIDs.checkPoint) : undefined}
            onEdited={onEdited}
            onAddList={onAddList}
            onDeleted={onDeleted}
            onPlayAll={onReplace}
            onLocateSong={locateSong}
            onPageAction={onPageAction}
            onSelectScope={selectScope}
            onCoverLoaded={onCoverLoaded}
            onToggleSelectionMode={toggleSelectionMode}>
            <ContentTabs
              id={tabsID}
              keyword={keyword}
              active={activeTab}
              isLikedList={isLikedList}
              setIsTyping={setIsTyping}
              searchTracks={searchTracks}
              albumCount={collection.albums.length}
              trackCount={playlist?.trackCount ?? 0}
              artistCount={collection.artists.length}
              onChange={changeTab}
              onKeywordChange={setKeyword}
            />
            <div className="relative min-h-0 w-full flex-1">
              <div
                id={`${tabsID}-tracks-panel`}
                className={cx(
                  "absolute inset-0 flex min-h-0 flex-col pt-1",
                  activeTab !== "tracks" && "invisible pointer-events-none"
                )}
                role="tabpanel"
                inert={activeTab !== "tracks"}
                aria-hidden={activeTab !== "tracks"}
                aria-labelledby={`${tabsID}-tracks-tab`}>
                {selectedGroup && currentScope && (
                  <div className="flex shrink-0 items-center gap-2 border-b border-white/10 py-2 text-[12px]">
                    <button
                      className="flex shrink-0 cursor-pointer items-center gap-0.5 opacity-65 transition-opacity hover:opacity-100"
                      type="button"
                      onClick={() =>
                        changeTab(currentScope.kind === "artist" ? "artists" : "albums")
                      }>
                      <ChevronLeft className="size-3.5" />
                      {currentScope.kind === "artist" ? "返回歌手" : "返回专辑"}
                    </button>
                    <span className="min-w-0 truncate font-semibold">{selectedGroup.name}</span>
                    <span className="shrink-0 text-[11px] tabular-nums opacity-55">
                      已喜欢 {selectedGroup.trackIDs.length} 首
                    </span>
                    <button
                      className="ml-auto shrink-0 cursor-pointer text-[11px] opacity-65 transition-opacity hover:opacity-100"
                      type="button"
                      onClick={() => {
                        exitSelection();
                        updateScope(null);
                        setKeyword("");
                        setSearch({ tab: "tracks", query: "" });
                      }}>
                      全部歌曲
                    </button>
                  </div>
                )}
                <TrackList
                  ref={trackListRef}
                  id={playlist?.id}
                  className="min-h-0 flex-1 pr-2 [scrollbar-gutter:stable]"
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
              {activeTab === "similar" && !isLikedList && playlist && (
                <div
                  id={`${tabsID}-similar-panel`}
                  className="absolute inset-0 pt-2"
                  role="tabpanel"
                  aria-labelledby={`${tabsID}-similar-tab`}>
                  <SimilarPlaylists
                    id={playlist.id}
                    className="pr-2 [scrollbar-gutter:stable]"
                    refreshToken={update.count}
                    onClick={openSimilarPlaylist}
                  />
                </div>
              )}
              {activeTab === "artists" && isLikedList && (
                <div
                  id={`${tabsID}-artists-panel`}
                  className="absolute inset-0 pt-2"
                  role="tabpanel"
                  aria-labelledby={`${tabsID}-artists-tab`}>
                  <LikedArtists
                    className="pr-2 [scrollbar-gutter:stable]"
                    query={query}
                    artists={artists}
                    totalCount={collection.artists.length}
                    onSelect={(artist) => selectScope({ kind: "artist", key: artist.key })}
                  />
                </div>
              )}
              {activeTab === "albums" && isLikedList && (
                <div
                  id={`${tabsID}-albums-panel`}
                  className="absolute inset-0 pt-2"
                  role="tabpanel"
                  aria-labelledby={`${tabsID}-albums-tab`}>
                  <LikedAlbums
                    className="pr-2 [scrollbar-gutter:stable]"
                    query={query}
                    albums={albums}
                    totalCount={collection.albums.length}
                    onSelect={(album) => selectScope({ kind: "album", key: album.key })}
                  />
                </div>
              )}
            </div>
          </Top>
        </AppLoading>
      </AppError>
    </div>
  );
};

export default memo(Playlist);
