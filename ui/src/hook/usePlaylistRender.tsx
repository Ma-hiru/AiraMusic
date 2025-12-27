import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";

import type { RefObject } from "react";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { Log } from "@mahiru/ui/utils/dev";
import type { PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";
import { PlaylistManager } from "@mahiru/ui/utils/playlist";
import { Copy, DiscAlbum, ListMusic, ListPlus, MessageSquare, Play } from "lucide-react";
import { PlaylistHistoryCache } from "@mahiru/ui/utils/history";
import { useUpdate } from "@mahiru/ui/hook/useUpdate";
import { useInfoWindow } from "@mahiru/ui/hook/useInfoWindow";
import { useContextMenu } from "@mahiru/ui/hook/useContextMenu";
import { usePersistZustandShallowStore, usePlayerStatus } from "@mahiru/ui/store";
import { Player } from "@mahiru/ui/utils/player";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { useHeart } from "@mahiru/ui/hook/useHeart";
import { SearchTrack } from "@mahiru/wasm";
import { CommentType } from "@mahiru/ui/api/comment";
import type { TrackListProps, TrackListRef } from "@mahiru/ui/componets/track_list";
import type { OnContextMenuFunc } from "@mahiru/ui/componets/track_item/TrackItem";
import type { ContextMenuItem, ContextMenuRender } from "@mahiru/ui/componets/menu/MenuProvider";
import { useKeepAliveCtx } from "@mahiru/ui/ctx/KeepAliveCtx";

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
  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  const { userLikedListSummary } = usePersistZustandShallowStore(["userLikedListSummary"]);
  const source = id ? Number(id) : undefined;
  const isLikedPlayList = userLikedListSummary?.id === source;
  const currentTrackID = trackStatus?.track?.id;
  const searchTrackInstance = useRef<Nullable<SearchTrack>>(null);
  // 所有曲目
  const tracks = useRef<NeteaseTrack[]>([]);
  // 历史最大滚动范围
  const maxRange = useRef<IndexRange>([0, 0]);
  // 检查并更新前一段预缓存范围
  const checkAndUpdateLastPreloadRange = useCallback(async (range: IndexRange) => {
    const [start, end] = range;
    return await Filter.NeteaseTrackCoverPreCache(tracks.current, [start, end], ImageSize.xs, true);
  }, []);
  // 虚拟列表范围更新回调
  const onVirtualListRangeUpdate = useCallback(
    async (range: IndexRange) => {
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
        tracks.current = await Filter.NeteaseTrackCoverPreCache(
          tracks.current,
          [end, end + 25], // 70 95 95 120
          ImageSize.xs
        );
        // 检查前一段范围，写入预缓存
        if (start - 50 > 0) {
          Log.debug(
            "ui/PlayListPage.tsx:onVirtualListRangeUpdate",
            "检查前一段范围预缓存",
            end - 25,
            end
          );
          await checkAndUpdateLastPreloadRange([end - 25, end]);
        }
      }
    },
    [checkAndUpdateLastPreloadRange, filterTracks.absoluteIdx]
  );
  // 搜索曲目
  const searchTracks = useCallback((k: string) => {
    if (k.trim() === "") {
      setFilterTracks({
        tracks: tracks.current,
        absoluteIdx: null
      });
    } else {
      const searcher = searchTrackInstance.current;
      if (searcher) {
        const lowerK = k.toLowerCase();
        const indexs = Array.from(searcher.search(lowerK));
        const result: NeteaseTrack[] = [];
        indexs.forEach((i) => {
          result.push(tracks.current[i]!);
        });
        setFilterTracks({
          tracks: result,
          absoluteIdx: indexs as unknown as number[]
        });
      }
    }
  }, []);
  // 清除状态
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
  // 初始化搜索实例
  useEffect(() => {
    if (searchTrackInstance.current === null) {
      searchTrackInstance.current = new SearchTrack();
    }
  }, []);
  // 挂载updater
  const outerUpdaterForID = useUpdate();
  const outerUpdaterForAll = useUpdate();
  useEffect(() => {
    id && PlaylistManager.addOuterUpdater(outerUpdaterForID, Number(id));
    PlaylistManager.addOuterUpdater(outerUpdaterForAll, null);
    return () => {
      id && PlaylistManager.removeOuterUpdater(null, Number(id));
      PlaylistManager.removeOuterUpdater(outerUpdaterForAll, null);
    };
  }, [id, outerUpdaterForAll, outerUpdaterForID]);
  // 监听id变化，加载歌单详情
  useEffect(() => {
    let cancelled = false;
    clearState();
    if (id) {
      Log.trace("usePlayListNormal", `加载歌单详情 ${id}`);
      PlaylistManager.requestPlaylistDetail(Number(id), [0, 50], ImageSize.xs, (missedTrack) => {
        if (!cancelled) {
          setRequestMissedTracks(missedTrack);
        }
      })
        .then((entry) => {
          if (entry && !cancelled) {
            tracks.current = entry.playlist.tracks;
            setTimeout(() => {
              if (!cancelled) {
                void checkAndUpdateLastPreloadRange([0, 50]);
              }
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
    };
    // outerUpdate.count 用于监听外部更新请求
  }, [
    checkAndUpdateLastPreloadRange,
    clearState,
    id,
    // 通过id精确监听歌单数据更新
    outerUpdaterForID.count
  ]);
  // 监听外部歌单更新请求(一般是喜欢歌曲的变更)，重载列表
  const lastUpdateAllCount = useRef(outerUpdaterForID.count);
  useEffect(() => {
    if (lastUpdateAllCount.current === outerUpdaterForID.count) {
      // 说明 outerUpdaterForID 没有触发更新，是外部歌单更新
      // 此时仅仅重载一下列表，触发列表项的useEffect，更新状态，不要重载数据
      Log.trace("usePlayListNormalRender", "检测到外部歌单更新，重载列表");
      setFilterTracks(() => filterTracks);
    } else {
      Log.trace("usePlayListNormalRender", "检测到当前歌单更新，重载数据");
      // 更新的是当前歌单，那么已经重载数据了，不需要再处理
      lastUpdateAllCount.current = outerUpdaterForID.count;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outerUpdaterForAll.count, outerUpdaterForID.count]);
  // 组件卸载时保存脏数据
  const entryRef = useRef(entry);
  entryRef.current = entry;
  useEffect(() => {
    return () => {
      Log.info("usePlayListRender", "组件卸载，保存脏数据");
      const entry = entryRef.current;
      entry && PlaylistManager.saveDirtyEntry(entry);
    };
  }, []);

  const { activeKey } = useKeepAliveCtx();
  const controller = usePlaylistController({
    filterTracks,
    tracks: tracks.current,
    listRef,
    onVirtualListRangeUpdate,
    entry,
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
  const [loading, setLoading] = useState(true);
  const [filterTracks, setFilterTracks] = useState({
    tracks: [] as NeteaseTrack[],
    // 搜索时的绝对索引，如果为null则表示未搜索
    absoluteIdx: null as Nullable<number[]>
  });
  const { mainColor, textColorOnMain } = useThemeColor();
  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  const currentTrackID = trackStatus?.track?.id;

  // 历史最大滚动范围
  const maxRange = useRef<IndexRange>([0, 0]);
  // 检查并更新前一段预缓存范围
  const checkAndUpdateLastPreloadRange = useCallback(async (range: IndexRange) => {
    const [start, end] = range;
    return await Filter.NeteaseTrackCoverPreCache(
      historyTracks.current,
      [start, end],
      ImageSize.xs,
      true
    );
  }, []);
  // 虚拟列表范围更新回调
  const onVirtualListRangeUpdate = useCallback(
    async (range: IndexRange) => {
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
        historyTracks.current = await Filter.NeteaseTrackCoverPreCache(
          historyTracks.current,
          [end, end + 25], // 70 95 95 120
          ImageSize.xs
        );
        // 检查前一段范围，写入预缓存
        if (start - 50 > 0) {
          Log.debug(
            "ui/PlayListPage.tsx:onVirtualListRangeUpdate",
            "检查前一段范围预缓存",
            end - 25,
            end
          );
          await checkAndUpdateLastPreloadRange([end - 25, end]);
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
          absoluteIdx: indexs as unknown as number[]
        });
      }
    }
  }, []);
  const forceUpdate = useUpdate();
  const updater = useCallback(() => {
    setLoading(true);
    PlaylistHistoryCache.load()
      .then((data) => {
        historyTracks.current = data;
        forceUpdate();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [forceUpdate]);
  const saver = useCallback(() => {
    if (historyTracks.current.length) {
      void PlaylistHistoryCache.save(historyTracks.current);
    }
  }, []);
  // 加载历史歌曲详情
  useEffect(() => {
    let cancelled = false;
    setTimeout(() => {
      if (!cancelled) {
        void checkAndUpdateLastPreloadRange([0, 50]);
      }
    }, 1000);
    searchTrackInstance.current?.update(JSON.stringify(historyTracks.current));
    setFilterTracks({
      tracks: historyTracks.current,
      absoluteIdx: null
    });
    if (loading) setLoading(false);
    return () => {
      cancelled = true;
    };
  }, [
    checkAndUpdateLastPreloadRange,
    historyTracks,
    loading,
    // 监听ref变化
    forceUpdate.count
  ]);
  // 初始化搜索实例
  useEffect(() => {
    if (searchTrackInstance.current === null) {
      searchTrackInstance.current = new SearchTrack();
    }
  }, []);
  // 挂载updater
  useEffect(() => {
    PlaylistHistoryCache.outerUpdater = updater;
    void updater();
    return () => {
      PlaylistHistoryCache.outerUpdater = null;
      // 保存脏数据
      Log.info("usePlayListHistoryRender", "组件卸载，保存历史缓存");
      void saver();
    };
  }, [saver, updater]);

  const { activeKey } = useKeepAliveCtx();
  const controller = usePlaylistController({
    filterTracks,
    tracks: historyTracks.current,
    listRef,
    onVirtualListRangeUpdate,
    entry: null,
    routerActive: !!activeKey?.startsWith("/history")
  });

  return {
    ...controller,
    mainColor,
    textColorOnMain,
    loading,
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
  entry: Nullable<PlaylistCacheEntry>;
  routerActive: boolean;
  source?: number;
}) {
  const { filterTracks, tracks, listRef, onVirtualListRangeUpdate, entry, source, routerActive } =
    props;
  const [fastLocation, setFastLocation] = useState(false);
  const { mainColor, textColorOnMain } = useThemeColor();
  const { openInfoWindow } = useInfoWindow(true);
  const { setContextMenuRenderer, setContextMenuVisible, contextMenuVisible } = useContextMenu();
  const { setLocateCurrentTrack, trackStatus, requestCanScrollTop } = usePlayerStatus([
    "setLocateCurrentTrack",
    "trackStatus",
    "requestCanScrollTop"
  ]);
  // 定位当前播放歌曲
  useEffect(() => {
    if (!routerActive) return;
    const currentTrackIndex = filterTracks.tracks.findIndex(
      (track) => track.id === trackStatus?.track?.id
    );
    const scrollTo = () => {
      setFastLocation(true);
      startTransition(() => {
        listRef.current?.scrollToItem(currentTrackIndex);
        setTimeout(() => {
          startTransition(() => {
            setFastLocation(false);
          });
        }, 1500);
      });
    };
    if (currentTrackIndex !== -1) {
      setLocateCurrentTrack(() => scrollTo);
    }
    return () => {
      setLocateCurrentTrack(null);
    };
  }, [filterTracks.tracks, listRef, routerActive, setLocateCurrentTrack, trackStatus?.track?.id]);
  const onListScroll = useCallback(() => {
    if (contextMenuVisible) {
      setContextMenuVisible?.(false);
    }
  }, [contextMenuVisible, setContextMenuVisible]);
  // 右键菜单
  const onContextMenu = useCallback<OnContextMenuFunc>(
    (e, trackBase) => {
      const track = tracks.find((t) => t.id === trackBase.id);
      track &&
        setContextMenuRenderer?.(
          createContextMenu({
            track,
            clientX: e.clientX,
            clientY: e.clientY,
            source: source,
            openInfoWindow
          })
        );
      setContextMenuVisible?.(true);
    },
    [openInfoWindow, setContextMenuRenderer, setContextMenuVisible, source, tracks]
  );
  // 回到顶部
  const scrollTop = useCallback(() => {
    setFastLocation(true);
    startTransition(() => {
      listRef.current?.containerRef.current?.scrollTo({
        top: 0,
        behavior: "smooth"
      });
      setTimeout(() => {
        startTransition(() => {
          setFastLocation(false);
        });
      }, 1500);
    });
  }, [listRef]);
  useEffect(() => {
    return () => {
      requestCanScrollTop("none");
    };
  }, [requestCanScrollTop]);
  // 包装范围更新，处理回到顶部请求
  const wrapRangeUpdate = useCallback(
    (range: IndexRange) => {
      if (range[0] > 5) requestCanScrollTop("playlist", scrollTop);
      else requestCanScrollTop("none");
      if (fastLocation) return;
      return onVirtualListRangeUpdate(range);
    },
    [fastLocation, onVirtualListRangeUpdate, requestCanScrollTop, scrollTop]
  );
  // 播放歌曲
  const onPlay = useCallback(
    (trackIdx: number) => {
      const rawTracks = tracks;
      const rawIdx = filterTracks.absoluteIdx ? filterTracks.absoluteIdx[trackIdx]! : trackIdx;
      if (!rawTracks[rawIdx]!.playable) return;
      // 如果与当前播放列表相同，仅切换位置，避免重建列表导致状态抖动
      if (Player.isSamePlaylist(rawTracks, source)) {
        Player.setPosition(rawIdx);
      } else {
        Player.replacePlaylist(rawTracks, source, rawIdx);
      }
    },
    [filterTracks.absoluteIdx, source, tracks]
  );
  // 封面缓存命中/错误回调
  const onCoverCacheHit = useCallback<NormalFunc<[file: string, id: string, trackIdx: number]>>(
    (file, id, trackIdx) => {
      const entryTrackIdx = filterTracks.absoluteIdx
        ? filterTracks.absoluteIdx[trackIdx]
        : trackIdx;
      if (!entry || typeof entryTrackIdx === "undefined") return;
      PlaylistManager.updateTrackCoverCache({
        entry,
        trackIdx: entryTrackIdx,
        cachedPicUrl: file,
        cachedPicUrlID: id
      });
    },
    [entry, filterTracks.absoluteIdx]
  );
  const onCoverCacheError = useCallback(
    (trackIdx: number) => {
      const entryTrackIdx = filterTracks.absoluteIdx
        ? filterTracks.absoluteIdx[trackIdx]
        : trackIdx;
      if (!entry || typeof entryTrackIdx === "undefined") return;
      PlaylistManager.updateTrackCoverCache({
        entry,
        trackIdx: entryTrackIdx,
        cachedPicUrl: "",
        cachedPicUrlID: ""
      });
    },
    [entry, filterTracks.absoluteIdx]
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
    onCoverCacheHit,
    onCoverCacheError,
    isTrackLiked,
    likeChange: likeChangeWrap
  };
}

function createContextMenu(props: {
  clientX: number;
  clientY: number;
  track: NeteaseTrack;
  source?: number;
  openInfoWindow: <T extends keyof InfoSyncValueMap>(type: T, value: InfoSyncValueMap[T]) => void;
}) {
  const { clientX, clientY, track, source, openInfoWindow } = props;
  return {
    header: createHeader(track),
    items: createMenuItems({
      track,
      openInfoWindow,
      source
    }),
    clientX,
    clientY
  } satisfies ContextMenuRender;
}

function createHeader(track: NeteaseTrack) {
  return (
    <div className="w-full h-full grid items-center grid-rows-1 grid-cols-[auto_1fr]">
      <NeteaseImage
        className={`
            size-8 rounded-md select-none
            ease-in-out duration-300 transition-all
          `}
        src={track.al.cachedPicUrl || track.al.picUrl}
        retryURL={track.al.picUrl}
        alt={track.al.name}
        size={ImageSize.xs}
        shadowColor="light"
      />
      <div className="w-full overflow-hidden flex flex-col items-start justify-center px-2 select-none truncate">
        <p className="w-full font-semibold text-left text-[12px] truncate">{track.name}</p>
        <p className="w-full font-normal text-left text-[8px] opacity-50 truncate">
          {track.ar.map((ar) => ar.name).join(" / ")}
        </p>
      </div>
    </div>
  );
}

function createMenuItems(props: {
  track: NeteaseTrack;
  openInfoWindow: <T extends keyof InfoSyncValueMap>(type: T, value: InfoSyncValueMap[T]) => void;
  source?: number;
}): ContextMenuItem[] {
  const disabled = !props.track.playable;
  const items: ContextMenuItem[] = [];
  items.push(
    {
      prefix: <Copy size={14} />,
      label: <p className="text-[12px]">复制歌曲名</p>,
      onClick: () => {
        window.navigator.clipboard.writeText(props.track.name).then(() => {
          //todo
        });
      }
    },
    {
      prefix: <div className="size-3.5" />,
      label: <p className="text-[12px]">复制专辑名</p>,
      onClick: () => {
        window.navigator.clipboard.writeText(props.track.al.name).then(() => {
          //todo
        });
      }
    },
    {
      prefix: <div className="size-3.5" />,
      label: <p className="text-[12px]">复制歌手名</p>,
      onClick: () => {
        window.navigator.clipboard
          .writeText(props.track.ar.map((a) => a.name).join(" "))
          .then(() => {
            //todo
          });
      }
    },
    {
      prefix: <DiscAlbum size={14} />,
      label: <p className="text-[12px]">专辑</p>
    },
    {
      prefix: <MessageSquare size={14} />,
      label: <p className="text-[12px]">评论</p>,
      onClick: () => {
        props.openInfoWindow("comments", {
          type: CommentType.Song,
          id: props.track.id,
          track: props.track
        });
      }
    }
  );
  if (!disabled) {
    items.push(
      {
        prefix: <Play size={14} />,
        label: <p className="text-[12px]">播放</p>,
        onClick: () => {
          Player.addTrack(props.track, props.source, "next");
          Player.next(true);
        }
      },
      {
        prefix: <ListPlus size={14} />,
        label: <p className="text-[12px]">下一首播放</p>,
        onClick: () => {
          Player.addTrack(props.track, props.source, "next");
        }
      },
      {
        prefix: <ListMusic size={14} />,
        label: <p className="text-[12px]">添加到播放列表</p>,
        onClick: () => {
          Player.addTrack(props.track, props.source, "end");
        }
      }
    );
  }
  return items;
}
