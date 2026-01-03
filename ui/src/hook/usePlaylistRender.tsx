import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";

import { RefObject, startTransition, useCallback, useEffect, useRef, useState } from "react";
import { Log } from "@mahiru/ui/utils/dev";
import { PlaylistCacheEntry, Playlist } from "@mahiru/ui/utils/playlist";
import { Copy, DiscAlbum, ListMusic, ListPlus, MessageSquare, Play } from "lucide-react";
import { PlaylistHistoryCache } from "@mahiru/ui/utils/history";
import { useUpdate } from "@mahiru/ui/hook/useUpdate";
import { useInfoWindow } from "@mahiru/ui/hook/useInfoWindow";
import { useContextMenu } from "@mahiru/ui/hook/useContextMenu";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { useHeart } from "@mahiru/ui/hook/useHeart";
import { SearchTrack } from "@mahiru/wasm";
import { CommentType } from "@mahiru/ui/api/comment";
import { TrackListProps, TrackListRef } from "@mahiru/ui/componets/track_list";
import { OnContextMenuFunc } from "@mahiru/ui/componets/track_item/TrackItem";
import { ContextMenuItem, ContextMenuRender } from "@mahiru/ui/componets/menu/MenuProvider";
import { useKeepAliveCtx } from "@mahiru/ui/ctx/KeepAliveCtx";
import { getPlayerStoreSnapshot, usePlayerStore } from "@mahiru/ui/store/player";
import { useUserStore } from "@mahiru/ui/store/user";
import { useLayoutStore } from "@mahiru/ui/store/layout";
import { NeteaseImageSize } from "@mahiru/ui/utils/image";

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
  const { UserLikedListSummary } = useUserStore(["UserLikedListSummary"]);
  const source = id ? Number(id) : undefined;
  const isLikedPlayList = UserLikedListSummary?.id === source;
  const currentTrackID = PlayerTrackStatus?.track?.id;
  const searchTrackInstance = useRef<Nullable<SearchTrack>>(null);
  // 所有曲目
  const tracks = useRef<NeteaseTrack[]>([]);
  // 历史最大滚动范围
  const maxRange = useRef<IndexRange>([0, 0]);
  // 检查并更新前一段预缓存范围
  const checkAndUpdateLastPreloadRange = useCallback(async (range: IndexRange) => {
    const [start, end] = range;
    return await Playlist.requestTracksCoverPreCache(
      tracks.current,
      [start, end],
      NeteaseImageSize.xs,
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
        tracks.current = await Playlist.requestTracksCoverPreCache(
          tracks.current,
          [end, end + 25], // 70 95 95 120
          NeteaseImageSize.xs
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
    id && Playlist.addOuterUpdater(outerUpdaterForID, Number(id));
    Playlist.addOuterUpdater(outerUpdaterForAll, null);
    return () => {
      id && Playlist.removeOuterUpdater(null, Number(id));
      Playlist.removeOuterUpdater(outerUpdaterForAll, null);
    };
  }, [id, outerUpdaterForAll, outerUpdaterForID]);
  // 监听id变化，加载歌单详情
  useEffect(() => {
    let cancelled = false;
    clearState();
    if (id) {
      Log.trace("usePlayListNormal", `加载歌单详情 ${id}`);
      Playlist.requestPlaylistDetail(Number(id), [0, 50], NeteaseImageSize.xs, (missedTrack) => {
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
      entry && Playlist.saveDirtyEntry(entry);
    };
  }, []);

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
  const [loading, setLoading] = useState(true);
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
  const checkAndUpdateLastPreloadRange = useCallback(async (range: IndexRange) => {
    const [start, end] = range;
    return await Playlist.requestTracksCoverPreCache(
      historyTracks.current,
      [start, end],
      NeteaseImageSize.xs,
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
        historyTracks.current = await Playlist.requestTracksCoverPreCache(
          historyTracks.current,
          [end, end + 25], // 70 95 95 120
          NeteaseImageSize.xs
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
  routerActive: boolean;
  source?: number;
}) {
  const { filterTracks, tracks, listRef, onVirtualListRangeUpdate, source, routerActive } = props;
  const [fastLocation, setFastLocation] = useState(false);
  const { mainColor, textColorOnMain } = useThemeColor();
  const { openInfoWindow } = useInfoWindow(true);
  const { setContextMenuRenderer, setContextMenuVisible, contextMenuVisible } = useContextMenu();
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
  // 定位当前播放歌曲
  useEffect(() => {
    if (!routerActive) return;
    const currentTrackIndex = filterTracks.tracks.findIndex(
      (track) => track.id === PlayerTrackStatus?.track?.id
    );
    const scrollTo = () => {
      const currentItemIndex = currentVisibleItemIndex.current;
      if (Math.abs(currentItemIndex - currentTrackIndex) > 50) {
        setFastLocation(true);
      }
      startTransition(() => {
        listRef.current?.scrollToItem(currentTrackIndex);
        if (Math.abs(currentItemIndex - currentTrackIndex) > 50) {
          setTimeout(
            () => {
              startTransition(() => {
                setFastLocation(false);
              });
            },
            Math.floor((Math.abs(currentItemIndex - currentTrackIndex) / 10) * 100)
          );
        }
      });
    };
    if (currentTrackIndex !== -1) {
      SetTrackListFastLocater(() => scrollTo);
    }
    return () => {
      SetTrackListFastLocater(() => null);
    };
  }, [
    PlayerTrackStatus?.track?.id,
    SetTrackListFastLocater,
    filterTracks.tracks,
    listRef,
    routerActive
  ]);
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
    const currentItemIndex = currentVisibleItemIndex.current;
    if (currentItemIndex > 200) {
      setFastLocation(true);
    }
    startTransition(() => {
      listRef.current?.containerRef.current?.scrollTo({
        top: 0,
        behavior: "smooth"
      });
      if (currentItemIndex > 200) {
        setTimeout(
          () => {
            startTransition(() => {
              setFastLocation(false);
            });
          },
          Math.floor((currentItemIndex / 10) * 100)
        );
      }
    });
  }, [listRef]);
  useEffect(() => {
    return () => {
      UpdateScrollTop({
        type: "none",
        callback: null
      });
    };
  }, [UpdateScrollTop]);
  // 包装范围更新，处理回到顶部请求
  const wrapRangeUpdate = useCallback(
    (range: IndexRange) => {
      if (range[0] > 5) UpdateScrollTop({ type: "playlist", callback: scrollTop });
      else UpdateScrollTop({ type: "none", callback: null });
      if (fastLocation) return;
      currentVisibleItemIndex.current = range[0];
      return onVirtualListRangeUpdate(range);
    },
    [UpdateScrollTop, fastLocation, onVirtualListRangeUpdate, scrollTop]
  );
  // 播放歌曲
  const onPlay = useCallback(
    (trackIdx: number) => {
      const rawTracks = tracks;
      const rawIdx = filterTracks.absoluteIdx ? filterTracks.absoluteIdx[trackIdx]! : trackIdx;
      if (!rawTracks[rawIdx]!.playable) return;
      // 如果与当前播放列表相同，仅切换位置，避免重建列表导致状态抖动
      if (player?.isSamePlaylist(rawTracks, source)) {
        player?.setPlayerPosition(rawIdx);
      } else {
        player?.replacePlaylist(rawTracks, source, rawIdx);
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
        src={track.al.picUrl}
        alt={track.al.name}
        size={NeteaseImageSize.xs}
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
  const player = getPlayerStoreSnapshot().PlayerCoreGetter();
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
          player?.addTrack(props.track, props.source, "next");
          player?.next(true);
        }
      },
      {
        prefix: <ListPlus size={14} />,
        label: <p className="text-[12px]">下一首播放</p>,
        onClick: () => {
          player?.addTrack(props.track, props.source, "next");
        }
      },
      {
        prefix: <ListMusic size={14} />,
        label: <p className="text-[12px]">添加到播放列表</p>,
        onClick: () => {
          player?.addTrack(props.track, props.source, "end");
        }
      }
    );
  }
  return items;
}
