import { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { RoutePathConstants } from "@mahiru/ui/main/constants";
import {
  NeteaseNetworkImage,
  NeteasePlaylist,
  NeteaseTrackRecord
} from "@mahiru/ui/public/models/netease";
import { Log } from "@mahiru/ui/public/utils/dev";
import { useToast } from "@mahiru/ui/public/hooks/useToast";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import { SearchTrack } from "@mahiru/wasm";
import NeteaseSource from "@mahiru/ui/public/entry/source";
import AppInstance from "@mahiru/ui/main/entry/instance";

import Top from "./top";
import Divider from "./Divider";
import TrackList from "@mahiru/ui/public/components/track_list";
import { useUser } from "@mahiru/ui/public/store/user";

const PlaylistPage: FC<object> = () => {
  const user = useUser();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { id, source } = RoutePathConstants.playlistParse(location, searchParams);

  const { requestToast } = useToast();
  const [playlist, setPlaylist] = useState<Nullable<NeteasePlaylist>>(null);
  const [tracks, setTracks] = useState<NeteaseTrackRecord[]>([]);
  const totalTracks = useRef<NeteaseTrackRecord[]>([]);
  const searcher = useMemo(() => new SearchTrack(), []);
  const player = AppInstance.usePlayer();

  // 历史最大滚动范围
  const maxRange = useRef<IndexRange>([0, 0]);
  // 检查并更新前一段预缓存范围
  const checkAndUpdateLastPreloadRange = useCallback(
    async (range: IndexRange, signal?: AbortSignal) => {
      if (signal?.aborted) return;
      const [start, end] = range;
      const images = totalTracks.current.slice(start, end).map((track) => {
        return NeteaseNetworkImage.fromTrackCover(track.track)
          .setSize(NeteaseImageSize.xs)
          .setAlt(track.track.name);
      });
      for (const image of images) {
        if (signal?.aborted) return;
        void NeteaseSource.Image.download(image);
      }
    },
    []
  );
  // 虚拟列表范围更新回调
  const coverCacheController = useRef<Nullable<AbortController>>(null);
  const onRangeUpdate = useCallback(
    async (range: IndexRange) => {
      const controller = new AbortController();
      coverCacheController.current?.abort();
      coverCacheController.current = controller;
      // 搜索状态不处理预缓存
      if (tracks.length !== totalTracks.current.length) return;
      // 50 70 75 95
      const [start, end] = range;
      // 向上滚动不处理
      if (start < maxRange.current[0]) return;
      // 向下滚动，更新最大范围
      maxRange.current = range;
      // 如果开始位置是25的倍数再进行预缓存，减少调用次数
      if (start % 25 === 0 && start !== 0) {
        // 检查前一段范围，写入预缓存
        if (start - 50 > 0) {
          return checkAndUpdateLastPreloadRange([end - 25, end], controller.signal);
        }
      }
    },
    [checkAndUpdateLastPreloadRange, tracks.length]
  );
  // 搜索曲目
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
  const onPlay = useCallback(
    (track: NeteaseTrackRecord) => {
      player.audio.pause();
      player.playlist.add(track, "next");
      player.playlist.next(true);
    },
    [player.audio, player.playlist]
  );
  const onReplace = useCallback(() => {
    player.playlist.replace(tracks, 0);
  }, [player.playlist, tracks]);

  const onAddList = useCallback(() => {
    player.playlist.addList(tracks);
  }, [player.playlist, tracks]);

  // // 定位当前播放歌曲
  // useEffect(() => {
  //   if (!routerActive) return;
  //   const currentTrackIndex = filterTracks.tracks.findIndex(
  //     (track) => track.id === PlayerTrackStatus?.track?.id
  //   );
  //   const scrollTo = () => {
  //     const currentItemIndex = currentVisibleItemIndex.current;
  //     if (Math.abs(currentItemIndex - currentTrackIndex) > 50) {
  //       const timeout = clamp(
  //         Math.floor((Math.abs(currentItemIndex - currentTrackIndex) / 10) * 100),
  //         0,
  //         3000
  //       );
  //       setFastLocation(true);
  //       setTimeout(async () => {
  //         await nextIdle(500);
  //         setFastLocation(false);
  //       }, timeout);
  //     }
  //     requestAnimationFrame(() => {
  //       listRef.current?.scrollToItem(currentTrackIndex);
  //     });
  //   };
  //   if (currentTrackIndex !== -1) {
  //     SetTrackListFastLocater(() => scrollTo);
  //   }
  //   return () => {
  //     SetTrackListFastLocater(() => null);
  //   };
  // }, [
  //   PlayerTrackStatus?.track?.id,
  //   SetTrackListFastLocater,
  //   filterTracks.tracks,
  //   listRef,
  //   routerActive
  // ]);
  // const onListScroll = useCallback(() => {
  //   if (contextMenuVisible) {
  //     setContextMenuVisible?.(false);
  //   }
  // }, [contextMenuVisible, setContextMenuVisible]);
  // // 右键菜单
  // const onContextMenu = useCallback<OnContextMenuFunc>(
  //   (e, trackBase) => {
  //     const track = tracks.find((t) => t.id === trackBase.id);
  //     track &&
  //       setContextMenuData?.(
  //         createContextMenu({
  //           track,
  //           clientX: e.clientX,
  //           clientY: e.clientY,
  //           source: source,
  //           openInfoWindow
  //         })
  //       );
  //     setContextMenuVisible?.(true);
  //   },
  //   [openInfoWindow, setContextMenuData, setContextMenuVisible, source, tracks]
  // );
  // // 回到顶部
  // const scrollTop = useCallback(() => {
  //   const currentItemIndex = currentVisibleItemIndex.current;
  //   if (currentItemIndex > 200) {
  //     const timeout = clamp(Math.floor((currentItemIndex / 10) * 100), 0, 3000);
  //     setFastLocation(true);
  //     setTimeout(async () => {
  //       await nextIdle(500);
  //       setFastLocation(false);
  //     }, timeout);
  //   }
  //   requestAnimationFrame(() => {
  //     listRef.current?.containerRef.current?.scrollTo({
  //       top: 0,
  //       behavior: "smooth"
  //     });
  //   });
  // }, [listRef]);
  // useEffect(() => {
  //   return () => {
  //     UpdateScrollTop({
  //       type: "none",
  //       callback: null
  //     });
  //   };
  // }, [UpdateScrollTop]);
  // // 包装范围更新，处理回到顶部请求
  // const wrapRangeUpdate = useCallback(
  //   (range: IndexRange) => {
  //     if (range[0] > 5) UpdateScrollTop({ type: "playlist", callback: scrollTop });
  //     else UpdateScrollTop({ type: "none", callback: null });
  //     if (fastLocation) return;
  //     currentVisibleItemIndex.current = range[0];
  //     return onVirtualListRangeUpdate(range);
  //   },
  //   [UpdateScrollTop, fastLocation, onVirtualListRangeUpdate, scrollTop]
  // );

  const onContext = useCallback((track: NeteaseTrackRecord) => {}, []);

  useEffect(() => {
    if (!id && source !== "like") return;
    const playlistID = source === "like" ? user?.likedPlaylist.id : Number(id);
    if (!playlistID) return;

    let cancel = false;
    NeteaseSource.Playlist.fromID(playlistID)
      .then((list) => {
        if (cancel) return;
        console.log(list);
        setPlaylist(list);

        const tracks = NeteaseTrackRecord.fromPlaylist(list);
        totalTracks.current = tracks;
        setTracks(tracks);

        searcher.update(JSON.stringify(list.tracks));
      })
      .catch((err) => {
        Log.error(err);
        requestToast({
          type: "error",
          text: "请求错误"
        });
      });
    return () => {
      cancel = true;
    };
  }, [id, requestToast, searcher, source, user?.likedPlaylist.id]);

  return (
    <div className="w-full h-full px-12 pt-20 contain-style contain-size contain-layout">
      <Top
        type={source!}
        loading={playlist === null}
        summary={playlist}
        onPlayAll={onReplace}
        onAddList={onAddList}
        searchTracks={searchTracks}
      />
      <Divider />
      <div className="w-full h-[calc(100%-210px)] relative">
        <TrackList
          tracks={tracks}
          id={playlist?.id}
          type={source!}
          loading={playlist === null}
          activeID={player.current.track?.id}
          onClick={onPlay}
          onContext={onContext}
          onRangeUpdate={onRangeUpdate}
        />
      </div>
    </div>
  );
};
export default memo(PlaylistPage);
