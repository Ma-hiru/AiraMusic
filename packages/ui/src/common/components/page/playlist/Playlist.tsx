import { cx } from "@emotion/css";
import {
  FC,
  memo,
  Ref,
  RefObject,
  startTransition,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import {
  NeteaseHistory,
  NeteaseNetworkImage,
  NeteasePlaylist,
  NeteaseTrack,
  NeteaseTrackRecord,
  NeteaseUser
} from "../../../source/netease/models";
import {
  TrackListClickFunc,
  TrackListContextMenuFunc,
  TrackListPlayableManager,
  TrackListRef
} from "../../../components/track_list";
import { SearchTrack } from "@mahiru/wasm";
import { ElectronServicesNet } from "../../../source/electron/services";
import { NeteaseImageSize, PlaylistSource } from "../../../enum";
import { NeteaseServicesImage, NeteaseServicesPlaylist } from "../../../source/netease/services";
import { useUpdate } from "../../../hooks/useUpdate";
import { Log } from "@mahiru/ui/common/constants/dev";
import { RequestStatus } from "../../../hooks/useRequestWrap";
import { HeartManager } from "../../../hooks/useHeart";
import AppContextMenu from "../../../components/menu";
import AppToast from "../../../components/toast";
import ImageConstants from "@mahiru/ui/common/constants/image";
import AppHistory from "../../../player/history";

import Top from "./top";
import Divider from "./Divider";
import AppErrorBoundary from "../../../components/fallback/AppErrorBoundary";
import ThrowIf from "../../../components/fallback/ThrowIf";
import AppLoading from "../../../components/fallback/AppLoading";
import TrackList from "../../../components/track_list/TrackList";

export type PlaylistRef = {
  tracks: NeteaseTrackRecord[] | NeteaseHistory[];
  totalTracks: RefObject<NeteaseTrackRecord[] | NeteaseHistory[]>;
  trackListRef: RefObject<Nullable<TrackListRef>>;
  currentVisibleItemIndex: RefObject<number>;
  scrollTop: NormalFunc;
  fastLocator: NormalFunc;
};

interface PlaylistProps {
  ref?: Ref<PlaylistRef>;
  id: Nullable<string>;
  source: Nullable<PlaylistSource>;
  className?: string;
  onPlay: TrackListClickFunc;
  heartManager: Optional<HeartManager>;
  playableManager: Optional<TrackListPlayableManager>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  onReplace: NormalFunc;
  onAddList: NormalFunc;
  onClickAlbum: NormalFunc<[id: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  canScrollTop: Optional<NormalFunc<[enable: boolean]>>;
  canFastLocate: Optional<NormalFunc<[enable: boolean]>>;
  activeTrackID?: number;
  historyList: Undefinable<NeteaseHistory[]>;
  user: Nullable<NeteaseUser>;
  pageActionType?: "enter" | "out" | "none";
  onPageAction?: NormalFunc;
  onCoverLoaded?: NormalFunc<[src: string]>;
  setIsTyping?: NormalFunc<[tying: boolean]>;
}

const Playlist: FC<PlaylistProps> = ({
  ref,
  className,
  id,
  source,
  heartManager,
  playableManager,
  user,
  onPlay,
  addToPlaylistNext,
  addToPlaylistLast,
  openComment,
  onReplace,
  onAddList,
  canScrollTop,
  canFastLocate,
  onClickAlbum,
  onClickArtist,
  activeTrackID,
  historyList = [],
  pageActionType,
  onPageAction,
  onCoverLoaded,
  setIsTyping
}) => {
  const [status, setStatus] = useState<RequestStatus>("loading");
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
  // 回到顶部
  const scrollTop = useRef(() => trackListRef.current?.scrollToItem(0)).current;
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
        void NeteaseServicesImage.download(image);
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
      currentVisibleItemIndex.current = start;
      canScrollTop?.(start >= 10);
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
    [canScrollTop, checkAndUpdateLastPreloadRange, tracks.length]
  );
  // 快速定位到当前播放歌曲
  const fastLocator = useCallback(() => {
    if (!activeTrackID) return;
    const exits = tracks.findIndex((t) => t.id === activeTrackID);
    if (exits === -1) return;
    trackListRef.current?.scrollToItem(exits);
  }, [activeTrackID, tracks]);
  useEffect(() => {
    if (!activeTrackID) return;
    const exits = tracks.findIndex((track) => track.id === activeTrackID);
    canFastLocate?.(exits !== -1);
  }, [canFastLocate, activeTrackID, tracks]);
  // 右键菜单
  const { create, createTrackContextMenu } = AppContextMenu.useMenu();
  const onContextMenu = useCallback<TrackListContextMenuFunc>(
    (e, track) => {
      create(createTrackContextMenu, {
        track,
        clientX: e.clientX,
        clientY: e.clientY,
        onClick: (type, track) => {
          switch (type) {
            case "play":
              onPlay(track, /** unused */ 0);
              break;
            case "album":
              onClickAlbum(track.detail.al.id);
              break;
            case "nextPlay":
              addToPlaylistNext(track);
              break;
            case "addPlayList":
              addToPlaylistLast(track);
              break;
            case "comment":
              void openComment(track);
              break;
          }
        }
      });
    },
    [
      addToPlaylistLast,
      addToPlaylistNext,
      create,
      createTrackContextMenu,
      onClickAlbum,
      onPlay,
      openComment
    ]
  );
  // 切换歌单时重置状态
  const update = useUpdate();
  const reload = useCallback(() => {
    startTransition(() => {
      setStatus("loading");
      update();
    });
  }, [update]);
  useEffect(() => {
    startTransition(() => {
      totalTracks.current = [];
      searcher.update("[]");
      setPlaylist(null);
      setTracks([]);
      setStatus("loading");
    });
  }, [id, source, searcher]);
  // 数据加载
  useEffect(() => {
    Log.debug("PlaylistPage", `params: id=${id}, source=${source}`);

    let cancel = false;
    if (source === "normal" || source === "like") {
      const playlistID = source === "like" ? user?.likedPlaylist.id : Number(id);
      if (playlistID) {
        NeteaseServicesPlaylist.id(playlistID)
          .then((list) => {
            startTransition(() => {
              if (cancel) return;
              const tracks = NeteaseTrackRecord.fromPlaylist(list);
              searcher.update(NeteaseTrack.toSearchStructString(list.tracks));
              totalTracks.current = tracks;
              setPlaylist(list);
              setTracks(tracks);
              setStatus("success");
            });
          })
          .catch((err) => {
            if (cancel) return;
            startTransition(() => setStatus("error"));
            Log.error(err);
            AppToast.show({
              type: "error",
              text: "请求错误"
            });
          });
      }
    }
    if (source === "history") {
      totalTracks.current = historyList;
      startTransition(() => {
        if (cancel) return;
        setPlaylist(null);
        setTracks(historyList);
        setStatus("success");
        searcher.update(AppHistory.toSearchStruct(historyList));
      });
    }

    return () => {
      cancel = true;
    };
  }, [
    id,
    historyList,
    searcher,
    source,
    user?.likedPlaylist.id,
    // 手动添加reload依赖
    update.count
  ]);
  useEffect(() => {
    return ElectronServicesNet.onOnlineChange(() => {
      ElectronServicesNet.isOnline && reload();
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
      fastLocator
    }),
    [fastLocator, scrollTop, tracks]
  );

  return (
    <div className={className}>
      <AppErrorBoundary
        className="w-full h-full"
        showError
        canReset
        name="PlaylistPage"
        onReset={reload}>
        <ThrowIf when={status === "error"} message="歌曲加载失败" />
        <AppLoading loading={status === "loading"} className="w-full h-full">
          <Top
            type={source!}
            loading={false}
            summary={playlist}
            onPlayAll={onReplace}
            onAddList={onAddList}
            searchTracks={searchTracks}
            setIsTyping={setIsTyping}
            onCoverLoaded={onCoverLoaded}
            historyCount={historyList.length}
            onPageAction={onPageAction}
            pageActionType={pageActionType}
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
              activeID={activeTrackID}
              onClick={onPlay}
              onContext={onContextMenu}
              onRangeUpdate={onRangeUpdate}
              onClickAlbum={onClickAlbum}
              onClickArtist={onClickArtist}
              heartManager={heartManager}
              playableManager={playableManager}
              trackCoverSize={ImageConstants.PlaylistPageTrackCoverSize}
            />
          </div>
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};

export default memo(Playlist);
