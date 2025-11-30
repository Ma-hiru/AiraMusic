import { useCallback, useEffect, useRef, useState } from "react";
import { NeteasePlaylistDetailResponse, NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { ImageSize, NeteaseTrackCoverPreCacheFilter } from "@mahiru/ui/utils/filter";
import { Log } from "@mahiru/ui/utils/dev";
import { requestPlayListDetailWithStore } from "@mahiru/ui/utils/playList";
import { SearchTrack } from "@mahiru/wasm";
import { usePersistZustandStore } from "@mahiru/ui/store";
import { useShallow } from "zustand/react/shallow";

export function usePlayListNormal(id?: string) {
  // 歌单详情
  const [detail, setDetail] = useState<Nullable<NeteasePlaylistDetailResponse>>(null);
  // 所有的track地址最终指向Store中的缓存
  const [filterTracks, setFilterTracks] = useState({
    tracks: [] as NeteaseTrack[],
    // 搜索时的绝对索引，如果为null则表示未搜索
    absoluteIdx: null as Nullable<number[]>
  });
  const [searchTrackInstance, setSearchTrackInstance] = useState<Nullable<SearchTrack>>(null);
  const [loading, setLoading] = useState(true);
  // 所有曲目
  const tracks = useRef<NeteaseTrack[]>([]);
  // 历史最大滚动范围
  const maxRange = useRef<IndexRange>([0, 0]);
  // 检查并更新前一段预缓存范围
  const checkAndUpdateLastPreloadRange = useCallback(async (range: IndexRange) => {
    const [start, end] = range;
    return await NeteaseTrackCoverPreCacheFilter(tracks.current, [start, end], ImageSize.xs, true);
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
        tracks.current = await NeteaseTrackCoverPreCacheFilter(
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
          console.log("searchTracks indexs", indexs);
          const result: NeteaseTrack[] = [];
          indexs.forEach((i) => {
            result.push(tracks.current[i]!);
          });
          console.log("searchTracks result", result);
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
    setDetail(null);
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
  useEffect(() => {
    let cancelled = false;
    clearState();
    if (id) {
      requestPlayListDetailWithStore(Number(id), [0, 50], ImageSize.xs)
        .then((res) => {
          if (res && !cancelled) {
            tracks.current = res.playlist.tracks;
            setTimeout(() => {
              if (!cancelled) {
                void checkAndUpdateLastPreloadRange([0, 50]);
              }
            }, 1000);
            searchTrackInstance?.update(JSON.stringify(tracks.current));
            setFilterTracks({
              tracks: tracks.current,
              absoluteIdx: null
            });
            setDetail(res);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [checkAndUpdateLastPreloadRange, clearState, id, searchTrackInstance]);

  return {
    detail,
    filterTracks,
    onVirtualListRangeUpdate,
    searchTracks,
    loading
  };
}

export function usePlayListHistory() {
  // 精确监听历史列表变化
  const { _historyList, getHistoryListStatic } = usePersistZustandStore(
    useShallow((state) => ({
      _historyList: state.data._historyList,
      getHistoryListStatic: state.getHistoryListStatic
    }))
  );
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
    return await NeteaseTrackCoverPreCacheFilter(
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
        historyTracks.current = await NeteaseTrackCoverPreCacheFilter(
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
  // 获取最新的历史列表
  useEffect(() => {
    // 监听持久化列表变化
    void _historyList;
    setLoading(true);
    historyTracks.current = getHistoryListStatic();
  }, [_historyList, getHistoryListStatic]);
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
  }, [checkAndUpdateLastPreloadRange, historyTracks, loading, searchTrackInstance]);
  // 初始化搜索实例
  useEffect(() => {
    if (searchTrackInstance === null) {
      setSearchTrackInstance(new SearchTrack());
    }
  }, [searchTrackInstance]);
  return {
    filterTracks,
    onVirtualListRangeUpdate,
    searchTracks,
    loading
  };
}
