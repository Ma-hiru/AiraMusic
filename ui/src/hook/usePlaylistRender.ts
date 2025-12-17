import { useCallback, useEffect, useRef, useState } from "react";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { Log } from "@mahiru/ui/utils/dev";
import { PlaylistCacheEntry, PlaylistManager } from "@mahiru/ui/utils/playlist";
import { SearchTrack } from "@mahiru/wasm";

import { PlaylistHistoryCache } from "@mahiru/ui/utils/history";
import { useUpdate } from "@mahiru/ui/hook/useUpdate";

export function usePlaylistNormalRender(id?: string) {
  const [entry, setEntry] = useState<Nullable<PlaylistCacheEntry>>(null);
  const [filterTracks, setFilterTracks] = useState({
    tracks: [] as NeteaseTrack[],
    // 搜索时的绝对索引，如果为null则表示未搜索
    absoluteIdx: null as Nullable<number[]>
  });
  const [searchTrackInstance, setSearchTrackInstance] = useState<Nullable<SearchTrack>>(null);
  const [loading, setLoading] = useState(true);
  const [requestMissedTracks, setRequestMissedTracks] = useState(0);
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
  const searchTracks = useCallback(
    (k: string) => {
      if (k.trim() === "") {
        setFilterTracks({
          tracks: tracks.current,
          absoluteIdx: null
        });
      } else {
        if (searchTrackInstance) {
          const lowerK = k.toLowerCase();
          const indexs = Array.from(searchTrackInstance.search(lowerK));
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
    },
    [searchTrackInstance]
  );
  // 清除状态
  const clearState = useCallback(() => {
    tracks.current = [];
    maxRange.current = [0, 0];
    setFilterTracks({
      tracks: [],
      absoluteIdx: null
    });
    setEntry(null);
    searchTrackInstance?.update();
    setLoading(true);
  }, [searchTrackInstance]);
  // 初始化搜索实例
  useEffect(() => {
    if (searchTrackInstance === null) {
      setSearchTrackInstance(new SearchTrack());
    }
  }, [searchTrackInstance]);
  // 监听id变化，加载歌单详情
  const outerUpdate = useUpdate();
  useEffect(() => {
    PlaylistManager.addOuterUpdater(outerUpdate);
    return () => {
      PlaylistManager.removeOuterUpdater(outerUpdate);
    };
  }, [outerUpdate]);
  useEffect(() => {
    let cancelled = false;
    clearState();
    if (id) {
      PlaylistManager.requestPlaylistDetail(Number(id), [0, 50], ImageSize.xs, (missedTrack) => {
        if (!cancelled) {
          Log.info("usePlayListNormal", `请求缺失的曲目，数量 ${missedTrack}`);
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
            searchTrackInstance?.update(JSON.stringify(tracks.current));
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
  }, [checkAndUpdateLastPreloadRange, clearState, id, searchTrackInstance, outerUpdate.count]);
  useEffect(() => {
    return () => {
      // 保存脏数据
      Log.info("usePlayListNormal", "组件卸载，保存脏数据");
      entry && PlaylistManager.saveDirtyEntry(entry);
    };
  }, [entry]);
  return {
    entry,
    loading,
    filterTracks,
    searchTracks,
    onVirtualListRangeUpdate,
    requestMissedTracks
  };
}

export function usePlaylistHistoryRender() {
  const historyTracks = useRef<NeteaseTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTracks, setFilterTracks] = useState({
    tracks: [] as NeteaseTrack[],
    // 搜索时的绝对索引，如果为null则表示未搜索
    absoluteIdx: null as Nullable<number[]>
  });
  const [searchTrackInstance, setSearchTrackInstance] = useState<Nullable<SearchTrack>>(null);

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
  const searchTracks = useCallback(
    (k: string) => {
      if (k.trim() === "") {
        setFilterTracks({
          tracks: historyTracks.current,
          absoluteIdx: null
        });
      } else {
        if (searchTrackInstance) {
          const lowerK = k.toLowerCase();
          const indexs = searchTrackInstance.search(lowerK);
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
    },
    [searchTrackInstance]
  );
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
    searchTrackInstance?.update(JSON.stringify(historyTracks.current));
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
    searchTrackInstance,
    // 监听ref变化
    forceUpdate.count
  ]);
  // 初始化搜索实例
  useEffect(() => {
    if (searchTrackInstance === null) {
      setSearchTrackInstance(new SearchTrack());
    }
  }, [searchTrackInstance]);
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
  return {
    filterTracks,
    onVirtualListRangeUpdate,
    searchTracks,
    loading
  };
}
