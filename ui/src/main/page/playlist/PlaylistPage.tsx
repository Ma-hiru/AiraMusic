import {
  FC,
  memo,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { RoutePathConstants } from "@mahiru/ui/main/constants";
import {
  NeteaseHistory,
  NeteaseNetworkImage,
  NeteasePlaylist,
  NeteaseTrack,
  NeteaseTrackRecord
} from "@mahiru/ui/public/models/netease";
import { Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import { SearchTrack } from "@mahiru/wasm";
import { cx } from "@emotion/css";
import TrackList, { TrackListRef } from "@mahiru/ui/public/components/track_list";
import { useUser } from "@mahiru/ui/public/store/user";
import { TrackContextMenuOnClick } from "@mahiru/ui/public/components/menu/TrackMenu";
import { getLayoutStoreSnapshot, useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import AppInstance from "@mahiru/ui/main/entry/instance";
import AppContextMenu from "@mahiru/ui/public/hooks/useContextMenu";
import AppToast from "@mahiru/ui/public/entry/toast";
import NeteaseSource from "@mahiru/ui/public/entry/source";
import ImageConstants from "@mahiru/ui/main/constants/image";
import Top from "./top";
import Divider from "./Divider";

const PlaylistPage: FC<object> = () => {
  const user = useUser();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { id, source } = RoutePathConstants.playlistParse(location, searchParams);
  const [isPending, startTransition] = useTransition();

  Log.debug(`PlaylistPage params: id=${id}, source=${source}`);

  const [playlist, setPlaylist] = useState<Nullable<NeteasePlaylist>>(null);
  const [tracks, setTracks] = useState<NeteaseTrackRecord[] | NeteaseHistory[]>([]);
  const totalTracks = useRef<NeteaseTrackRecord[] | NeteaseHistory[]>([]);
  const trackListRef = useRef<Nullable<TrackListRef>>(null);
  const currentVisibleItemIndex = useRef(0);

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

  // 播放曲目
  const player = AppInstance.usePlayer();
  const onPlay = useCallback(
    (track: NeteaseTrackRecord) => {
      if (player.current.track?.id === track.id) return;
      if (player.playlist.same(totalTracks.current)) {
        player.playlist.jump(track);
      } else {
        player.playlist.replace(totalTracks.current, track);
      }
    },
    [player]
  );

  const onReplace = useCallback(() => {
    player.playlist.replace(tracks, 0);
  }, [player.playlist, tracks]);

  const onAddList = useCallback(() => {
    player.playlist.addList(tracks);
  }, [player.playlist, tracks]);

  // 回到顶部
  const scrollTop = useCallback(() => {
    trackListRef.current?.scrollToItem(0);
  }, []);

  const { updateLayout } = useLayoutStore(["updateLayout"]);
  // 历史最大滚动范围
  const maxRange = useRef<IndexRange>([0, 0]);
  // 检查并更新前一段预缓存范围
  const checkAndUpdateLastPreloadRange = useCallback(
    async (range: IndexRange, signal?: AbortSignal) => {
      if (signal?.aborted) return;
      const [start, end] = range;
      const images = totalTracks.current.slice(start, end).map((track) => {
        return NeteaseNetworkImage.fromTrackCover(track.detail)
          .setSize(NeteaseImageSize.xs)
          .setAlt(track.detail.name);
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
      const [start, end] = range;
      const controller = new AbortController();
      coverCacheController.current?.abort();
      coverCacheController.current = controller;
      const layout = getLayoutStoreSnapshot().layout;
      if (layout.scrollTop() !== scrollTop && start >= 10) {
        updateLayout(layout.copy().setScrollTop(scrollTop));
      } else if (layout.scrollTop() !== undefined && start < 10) {
        updateLayout(layout.copy().setScrollTop(undefined));
      }
      currentVisibleItemIndex.current = start;
      // 搜索状态不处理预缓存
      if (tracks.length !== totalTracks.current.length) return;
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
    [checkAndUpdateLastPreloadRange, scrollTop, tracks.length, updateLayout]
  );

  // 快速定位到当前播放歌曲
  const fastLocator = useCallback(() => {
    const track = player.current.track;
    if (!track) return;
    const exits = tracks.findIndex((t) => t.id === track.id);
    if (exits === -1) return;
    trackListRef.current?.scrollToItem(exits);
  }, [player, tracks]);

  useEffect(() => {
    const currentTrack = player.current.track;
    if (!currentTrack) return;
    const layout = getLayoutStoreSnapshot().layout;
    const exits = tracks.findIndex((track) => track.id === currentTrack.id);
    if (layout.fastLocator() !== fastLocator && exits !== -1) {
      updateLayout(layout.copy().setFastLocator(fastLocator));
    } else if (layout.fastLocator() !== undefined && exits === -1) {
      updateLayout(layout.copy().setFastLocator(undefined));
    }
  }, [fastLocator, player, tracks, updateLayout]);

  // 右键菜单
  const { setContextMenuData, setContextMenuVisible, createTrackContextMenu } =
    AppContextMenu.useContextMenu();
  const contextMenuAction = useCallback<TrackContextMenuOnClick>(
    (type, track) => {
      switch (type) {
        case "play":
          onPlay(track);
      }
    },
    [onPlay]
  );
  const onContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement, MouseEvent>, track: NeteaseTrackRecord) => {
      setContextMenuData?.(
        createTrackContextMenu({
          track,
          clientX: e.clientX,
          clientY: e.clientY,
          onClick: contextMenuAction
        })
      );
      setContextMenuVisible?.(true);
    },
    [contextMenuAction, createTrackContextMenu, setContextMenuData, setContextMenuVisible]
  );

  // likedPlaylistID 和 likedTrackIDs.checkPoint
  // 变化时获取歌单数据，更新喜欢状态
  const update = useUpdate();
  const likedStatusCheckPoint = useRef(user?.likedTrackIDs.checkPoint ?? 0);
  useEffect(() => {
    if (source !== "like") return;
    if (likedStatusCheckPoint.current === user?.likedTrackIDs.checkPoint) return;
    update();
    likedStatusCheckPoint.current = user?.likedTrackIDs.checkPoint ?? 0;
  }, [source, update, user?.likedTrackIDs.checkPoint]);

  // 数据加载
  const [firstRender, setFirstRender] = useState(true);
  useEffect(() => {
    let cancel = false;
    if (source === "normal" || source === "like") {
      const playlistID = source === "like" ? user?.likedPlaylist.id : Number(id);
      playlistID &&
        NeteaseSource.Playlist.fromID(playlistID)
          .then((list) => {
            startTransition(() => {
              if (cancel) return;
              const tracks = NeteaseTrackRecord.fromPlaylist(list);
              searcher.update(NeteaseTrack.toSearchStructString(list.tracks));
              totalTracks.current = tracks;
              setPlaylist(list);
              setTracks(tracks);
            });
          })
          .catch((err) => {
            Log.error(err);
            AppToast.request({
              type: "error",
              text: "请求错误"
            });
          })
          .finally(() => {
            setFirstRender(false);
          });
    }
    if (source === "history") {
      totalTracks.current = player.history.list;
      startTransition(() => {
        setPlaylist(null);
        setTracks(player.history.list);
        searcher.update(player.history.toSearchStruct());
        setFirstRender(false);
      });
    }
    return () => {
      cancel = true;
      totalTracks.current = [];
      searcher.update("[]");
      setPlaylist(null);
      setTracks([]);
    };
  }, [
    id,
    player.history,
    searcher,
    source,
    user?.likedPlaylist.id,
    // likedTrackIDs 的变化会导致喜欢状态变化，喜欢状态变化时需要重新获取歌单数据，更新喜欢状态
    update.count
  ]);

  return (
    <div className="w-full h-full px-12 pt-5 contain-style contain-size contain-layout">
      <Top
        type={source!}
        loading={isPending || firstRender}
        summary={playlist}
        onPlayAll={onReplace}
        onAddList={onAddList}
        searchTracks={searchTracks}
        historyCount={player.history.count}
        coverCacheKey={source === "like" ? String(user?.likedTrackIDs.checkPoint) : undefined}
      />
      {source !== "history" && playlist !== null && <Divider />}
      <div
        className={cx(
          `
            w-full h-[calc(100%-210px)] relative
          `,
          source === "history" && "h-full pb-18"
        )}>
        <TrackList
          ref={trackListRef}
          tracks={tracks}
          id={playlist?.id}
          type={source!}
          loading={isPending || firstRender}
          activeID={player.current.track?.id}
          onClick={onPlay}
          onContext={onContextMenu}
          onRangeUpdate={onRangeUpdate}
          trackCoverSize={ImageConstants.PlaylistPageTrackCoverSize}
        />
      </div>
    </div>
  );
};
export default memo(PlaylistPage);
