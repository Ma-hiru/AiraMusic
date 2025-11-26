import { NeteasePlaylistDetail, NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  NeteaseImageSizeFilter,
  NeteaseTrackFilter,
  NeteaseTrackIDsToTrackFilter
} from "@mahiru/ui/utils/filter";
import { useImmer } from "use-immer";
import { Store } from "@mahiru/ui/utils/cache";
import { RangeTree } from "@mahiru/wasm";

/** 范围： [start,end) */
type Range = [start: number, end: number];

export function usePlayListTrackPagination(playList: NeteasePlaylistDetail, defaultLimit = 20) {
  const [tracksMap, setTracksMap] = useImmer<Map<number, NeteaseTrack>>(() => new Map());
  const [currentTracks, setCurrentTracks] = useImmer<NeteaseTrack[]>([]);
  const [limit, setLimit] = useState(defaultLimit);
  const [currentPage, setCurrentPage] = useState(0);

  const loadedRanges = useRef<Nullable<RangeTree>>(null);
  useEffect(() => {
    if (loadedRanges.current === null) {
      loadedRanges.current = new RangeTree();
    }
  }, []);
  const total = playList.trackIds.length;
  const maxPage = Math.ceil(total / limit);

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8824/ws");
    ws.onmessage = (event) => {
      const { id, file } = JSON.parse(event.data);
      setTracksMap((draft) => {
        for (const [key, track] of draft) {
          if (NeteaseImageSizeFilter(track.al.picUrl, "xs") === id) {
            track.al.picUrl = file;
            break;
          }
        }
      });
      setCurrentTracks((draft) => draft.map((t) => t));
    };
    return () => {
      ws.close();
    };
  }, [setCurrentTracks, setTracksMap]);

  const loadRange = useCallback(
    async (range: Range) => {
      const [start, end] = range;

      const trackIds = playList.trackIds.slice(start, end);
      const rawDetails = await NeteaseTrackIDsToTrackFilter(trackIds);
      const mappedTracks = NeteaseTrackFilter(rawDetails);
      // 封面 URL 需要检查缓存
      const coverURLs = mappedTracks.map((track) => ({
        url: NeteaseImageSizeFilter(track.al.picUrl, "xs")!
      }));
      const cachedResult = await Store.checkOrStoreAsyncMutil(coverURLs, "GET");
      // 有缓存的直接替换
      if (cachedResult.ok) {
        cachedResult.results.forEach((cache, index) => {
          if (cache.ok) {
            mappedTracks[index]!.al.picUrl = cache.index.file;
          }
        });
      }

      setTracksMap((draft) => {
        mappedTracks.forEach((track) => {
          draft.set(track.id, track);
        });
      });
      loadedRanges.current?.add(start, end);
    },
    [playList.trackIds, setTracksMap]
  );

  const requestPage = useCallback(async (page: number) => {
    if (loadedRanges.current === null) return;
    if (page < 0 || page > maxPage) return;
    const start = page * limit;
    const end = Math.min(start + limit, total);
    const missing = loadedRanges.current.diff(start, end);

    for (const m of missing) {
      await loadRange(m);
    }
    const ids = playList.trackIds.slice(start, end);
    const pageTracks = ids.map(({ id }) => tracksMap.get(id)).filter(Boolean) as NeteaseTrack[];

    setCurrentTracks(pageTracks);
    setCurrentPage(page);
  }, [limit, loadRange, maxPage, playList.trackIds, setCurrentTracks, total, tracksMap]);

  return {
    total,
    limit,
    currentPage,
    requestPage,
    setLimit,
    currentTracks,
    loadedTracks: tracksMap
  };
}

function createPlayListTrackPagination(data: NeteasePlaylistDetail, defaultLimit = 20){}
