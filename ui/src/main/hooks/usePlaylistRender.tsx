import { SearchTrack } from "@mahiru/wasm";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Copy, DiscAlbum, ListMusic, ListPlus, MessageSquare, Play } from "lucide-react";
import { clamp } from "lodash-es";

import { Log } from "@mahiru/ui/public/utils/dev";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { useLocalStore } from "@mahiru/ui/public/store/local";
import { useKeepAliveCtx } from "@mahiru/ui/public/ctx/KeepAliveCtx";
import { OnContextMenuFunc } from "@mahiru/ui/public/components/track_item/TrackItem";
import { TrackListProps, TrackListRef } from "@mahiru/ui/public/components/track_list";
import { Playlist, PlaylistCacheEntry } from "@mahiru/ui/public/entry/playlist";
import { CommentType, NeteaseImageSize } from "@mahiru/ui/public/enum";
import { ContextMenuItem, ContextMenuRender } from "@mahiru/ui/public/components/menu/MenuProvider";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { nextIdle } from "@mahiru/ui/public/utils/frame";
import { useContextMenu } from "@mahiru/ui/public/hooks/useContextMenu";
import { useHeart } from "@mahiru/ui/public/hooks/useHeart";

import { useInfoWindow } from "@mahiru/ui/main/hooks/useInfoWindow";
import { PlayerHistory } from "@mahiru/ui/main/entry/history";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { getPlayerStoreSnapshot, usePlayerStore } from "@mahiru/ui/main/store/player";

export function usePlaylistNormalRender(id?: string) {
  const listRef = useRef<TrackListRef>(null);
  const [entry, setEntry] = useState<Nullable<PlaylistCacheEntry>>(null);
  const [filterTracks, setFilterTracks] = useState({
    tracks: [] as NeteaseTrack[],
    // 搜索时的绝对索引，如果为null则表示未搜索
    absoluteIdx: null as Nullable<number[]>
  });
  const [loading, setLoading] = useState(true);
  const [requestMissedTracks, setRequestMissedTracks] = useState(0);
  const { mainColor, textColorOnMain } = useThemeColor();
  const { PlayerTrackStatus } = usePlayerStore(["PlayerTrackStatus"]);
  const { User } = useLocalStore(["User"]);
  const source = id ? Number(id) : undefined;
  const isLikedPlayList = User.UserLikedPlaylistID === source;
  const currentTrackID = PlayerTrackStatus?.track?.id;

  // 所有曲目
  const tracks = useRef<NeteaseTrack[]>([]);

  const clearState = useCallback(() => {
    tracks.current = [];
    maxRange.current = [0, 0];
    setFilterTracks({
      tracks: [],
      absoluteIdx: null
    });
    setEntry(null);
    searchTrackInstance.current?.update();
    setLoading(true);
  }, []);

  // 挂载updater
  const forceUpdater = useUpdate();
  useEffect(() => {
    id && Playlist.addOuterUpdater(forceUpdater, Number(id));
    return () => {
      id && Playlist.removeOuterUpdater(forceUpdater, Number(id));
    };
  }, [id, forceUpdater]);
  // 监听id变化，加载歌单详情
  useEffect(() => {
    let cancelled = false;
    let timer: Nullable<number> = null;
    clearState();
    if (id) {
      Log.debug("usePlayListNormal", `加载歌单详情 ${id}`);
      Playlist.requestPlaylistDetail(Number(id), [0, 50], NeteaseImageSize.xs, (missedTrack) => {
        if (!cancelled) {
          setRequestMissedTracks(missedTrack);
        }
      })
        .then((entry) => {
          if (entry && !cancelled) {
            tracks.current = entry.playlist.tracks;
            timer = window.setTimeout(() => {
              requestIdleCallback(() => {
                if (!cancelled) {
                  void checkAndUpdateLastPreloadRange([0, 50]);
                }
              });
            }, 2000);
            searchTrackInstance.current?.update(JSON.stringify(tracks.current));
            setFilterTracks({
              tracks: tracks.current,
              absoluteIdx: null
            });
            setEntry(entry);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
            setRequestMissedTracks(0);
          }
        });
    }
    return () => {
      cancelled = true;
      timer && clearTimeout(timer);
    };
    // outerUpdate.count 用于监听外部更新请求
  }, [
    checkAndUpdateLastPreloadRange,
    clearState,
    id,
    // 通过id精确监听歌单数据更新
    forceUpdater.count
  ]);

  const { activeKey } = useKeepAliveCtx();
  const controller = usePlaylistController({
    filterTracks,
    tracks: tracks.current,
    listRef,
    onVirtualListRangeUpdate,

    source,
    routerActive: !!activeKey?.startsWith("/playlist")
  });

  return {
    ...controller,
    entry,
    mainColor,
    textColorOnMain,
    loading,
    source,
    tracks: filterTracks.tracks,
    requestMissedTracks,
    currentTrackID,
    isLikedPlayList,
    searchTracks,
    showHeart: true,
    ref: listRef
  } satisfies TrackListProps & {
    searchTracks: NormalFunc<[k: string]>;
    ref: RefObject<Nullable<TrackListRef>>;
    entry: Nullable<PlaylistCacheEntry>;
  };
}

export function usePlaylistHistoryRender() {
  const listRef = useRef<TrackListRef>(null);
  const historyTracks = useRef<NeteaseTrack[]>([]);
  const searchTrackInstance = useRef<Nullable<SearchTrack>>(null);
  const [filterTracks, setFilterTracks] = useState({
    tracks: [] as NeteaseTrack[],
    // 搜索时的绝对索引，如果为null则表示未搜索
    absoluteIdx: null as Nullable<number[]>
  });
  const { mainColor, textColorOnMain } = useThemeColor();
  const { PlayerTrackStatus } = usePlayerStore(["PlayerTrackStatus"]);
  const currentTrackID = PlayerTrackStatus?.track?.id;

  // 历史最大滚动范围
  const maxRange = useRef<IndexRange>([0, 0]);
  // 检查并更新前一段预缓存范围
  const checkAndUpdateLastPreloadRange = useCallback(
    async (range: IndexRange, signal?: AbortSignal) => {
      const [start, end] = range;
      return await Playlist.requestTracksCoverPreCache(
        historyTracks.current,
        [start, end],
        NeteaseImageSize.xs,
        true,
        signal
      );
    },
    []
  );
  // 虚拟列表范围更新回调
  const coverCacheController = useRef<Nullable<AbortController>>(null);
  const onVirtualListRangeUpdate = useCallback(
    async (range: IndexRange) => {
      const controller = new AbortController();
      coverCacheController.current?.abort();
      coverCacheController.current = controller;
      // 搜索状态不处理预缓存
      if (filterTracks.absoluteIdx !== null) return;
      // 50 70 75 95
      const [start, end] = range;
      // 向上滚动不处理
      if (start < maxRange.current[0]) return;
      // 向下滚动，更新最大范围
      maxRange.current = range;
      // 如果开始位置是25的倍数再进行预缓存，减少调用次数
      if (start % 25 === 0 && start !== 0) {
        Log.debug("ui/PlayListPage.tsx:onVirtualListRangeUpdate", "预缓存封面", end, end + 25);
        if (controller.signal.aborted) return;
        historyTracks.current = await Playlist.requestTracksCoverPreCache(
          historyTracks.current,
          [end, end + 25], // 70 95 95 120
          NeteaseImageSize.xs,
          false,
          controller.signal
        );
        // 检查前一段范围，写入预缓存
        if (start - 50 > 0) {
          Log.debug(
            "ui/PlayListPage.tsx:onVirtualListRangeUpdate",
            "检查前一段范围预缓存",
            end - 25,
            end
          );
          if (controller.signal.aborted) return;
          await checkAndUpdateLastPreloadRange([end - 25, end], controller.signal);
        }
      }
    },
    [checkAndUpdateLastPreloadRange, filterTracks.absoluteIdx]
  );
  // 搜索曲目
  const searchTracks = useCallback((k: string) => {
    if (k.trim() === "") {
      setFilterTracks({
        tracks: historyTracks.current,
        absoluteIdx: null
      });
    } else {
      const searcher = searchTrackInstance.current;
      if (searcher) {
        const lowerK = k.toLowerCase();
        const indexs = searcher.search(lowerK);
        const result: NeteaseTrack[] = [];
        indexs.forEach((i) => {
          result.push(historyTracks.current[i]!);
        });
        setFilterTracks({
          tracks: result,
          absoluteIdx: Array.from(indexs)
        });
      }
    }
  }, []);
  // 初始化搜索实例
  useEffect(() => {
    if (searchTrackInstance.current === null) {
      searchTrackInstance.current = new SearchTrack();
    }
  }, []);
  // 加载历史歌曲详情
  const forceUpdate = useUpdate();
  useEffect(() => {
    let cancelled = false;
    let timer: Nullable<number> = null;
    historyTracks.current = PlayerHistory.tracks;
    timer = window.setTimeout(() => {
      requestIdleCallback(() => {
        if (!cancelled) {
          void checkAndUpdateLastPreloadRange([0, 50]);
        }
      });
    }, 1000);
    searchTrackInstance.current?.update(JSON.stringify(historyTracks.current));
    setFilterTracks({
      tracks: historyTracks.current,
      absoluteIdx: null
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    checkAndUpdateLastPreloadRange,
    // 监听ref变化
    forceUpdate.count
  ]);
  // 挂载updater
  useEffect(() => {
    PlayerHistory.addOuterUpdater(forceUpdate);
    return () => {
      PlayerHistory.removeOuterUpdater(forceUpdate);
    };
  }, [forceUpdate]);
  // 监听路由激活状态，强制刷新
  const { activeKey } = useKeepAliveCtx();
  const routerActive = !!activeKey?.startsWith("/history");
  useEffect(() => {
    if (routerActive) {
      forceUpdate();
    }
  }, [forceUpdate, routerActive]);

  const controller = usePlaylistController({
    filterTracks,
    tracks: historyTracks.current,
    listRef,
    onVirtualListRangeUpdate,
    routerActive
  });

  return {
    ...controller,
    mainColor,
    textColorOnMain,
    tracks: filterTracks.tracks,
    requestMissedTracks: 0,
    currentTrackID,
    isLikedPlayList: false,
    searchTracks,
    showHeart: true,
    ref: listRef
  } satisfies TrackListProps & {
    searchTracks: NormalFunc<[k: string]>;
    ref: RefObject<Nullable<TrackListRef>>;
  };
}

function usePlaylistController(props: {
  filterTracks: {
    tracks: NeteaseTrack[];
    absoluteIdx: Nullable<number[]>;
  };
  tracks: NeteaseTrack[];
  listRef: RefObject<TrackListRef | null>;
  onVirtualListRangeUpdate: (range: IndexRange) => Promise<void>;
  routerActive: boolean;
  source?: number;
}) {
  const { filterTracks, tracks, listRef, onVirtualListRangeUpdate, source, routerActive } = props;
  const [fastLocation, setFastLocation] = useState(false);
  const { mainColor, textColorOnMain } = useThemeColor();
  const { openInfoWindow } = useInfoWindow(true);
  const { setContextMenuData, setContextMenuVisible, contextMenuVisible } = useContextMenu();
  const { PlayerTrackStatus, PlayerCoreGetter } = usePlayerStore([
    "PlayerTrackStatus",
    "PlayerCoreGetter"
  ]);
  const { UpdateScrollTop, SetTrackListFastLocater } = useLayoutStore([
    "UpdateScrollTop",
    "SetTrackListFastLocater"
  ]);
  const currentVisibleItemIndex = useRef(0);
  const player = PlayerCoreGetter();

  // 播放歌曲
  const onPlay = useCallback(
    (trackIdx: number) => {
      const rawTracks = tracks;
      const rawIdx = filterTracks.absoluteIdx ? filterTracks.absoluteIdx[trackIdx]! : trackIdx;
      if (!rawTracks[rawIdx]!.playable) return;
      // 如果与当前播放列表相同，仅切换位置，避免重建列表导致状态抖动
      if (player.isSamePlaylist(rawTracks, source)) {
        player.setPlayerPosition(rawIdx);
      } else {
        player.replacePlaylist(rawTracks, source, rawIdx);
      }
    },
    [filterTracks.absoluteIdx, player, source, tracks]
  );
  // 喜欢状态
  const { isTrackLiked, likeChange } = useHeart();
  const likeChangeWrap = useCallback(
    (trackBase: NeteaseTrackBase) => {
      const track = tracks.find((t) => t.id === trackBase.id);
      return likeChange(track);
    },
    [likeChange, tracks]
  );
  return {
    mainColor,
    fastLocation,
    textColorOnMain,
    onListScroll,
    onContextMenu,
    onVirtualListRangeUpdate: wrapRangeUpdate,
    onPlay,
    isTrackLiked,
    likeChange: likeChangeWrap
  };
}

