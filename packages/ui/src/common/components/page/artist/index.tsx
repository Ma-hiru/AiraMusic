import { cx } from "@emotion/css";
import { PlaylistSource } from "../../../enum";
import { type HeartManager } from "../../../hooks/use-heart";
import {
  type FC,
  memo,
  type MouseEvent as ReactMouseEvent,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { useRequestAutoRun, useRequestStatusWrap } from "../../../hooks/use-request-wrap";
import { NeteaseArtist, NeteaseTrackRecord } from "../../../source/netease/models";
import { NeteaseServicesArtist } from "../../../source/netease/services";
import AppContextMenu from "../../../components/menu";
import ImageConstants from "@mahiru/ui/common/constants/image";

import Header from "./header";
import AlbumList from "./album";
import AppErrorBoundary from "../../fallback/app-error-boundary";
import AppLoading from "../../fallback/app-loading";
import ThrowIf from "../../fallback/throw-if";
import TrackList, {
  type TrackListClickFunc,
  type TrackListPlayableManager,
  type TrackListRef
} from "../../../components/track_list";

export type ArtistRef = {
  reload: NormalFunc;
  artist: Nullable<NeteaseArtist>;
  trackListRef: Nullable<TrackListRef>;
};

interface ArtistProps {
  id: number;
  ref?: Ref<ArtistRef>;
  className?: string;
  onLoadedData?: NormalFunc<[artist: NeteaseArtist]>;
  onAvatarLoaded?: NormalFunc<[avatar: string]>;
  activeTrackID?: number;
  heartManager: Optional<HeartManager>;
  playableManager: Optional<TrackListPlayableManager>;
  onClick: Optional<TrackListClickFunc<NeteaseTrackRecord>>;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  pageActionType?: "enter" | "out" | "none";
  onPageAction?: NormalFunc;
}

const Artist: FC<ArtistProps> = ({
  id,
  ref,
  className,
  onLoadedData,
  onAvatarLoaded,
  activeTrackID,
  heartManager,
  playableManager,
  onClick,
  onClickArtist,
  onClickAlbum,
  pageActionType,
  onPageAction,
  addToPlaylistNext,
  addToPlaylistLast,
  openComment
}) => {
  const requestData = useCallback((id: number) => {
    if (id <= 0 || !id) return Promise.resolve(null);
    return NeteaseServicesArtist.id(id);
  }, []);
  const { status, data: artist = null, fetchData } = useRequestStatusWrap(requestData);
  const { reload } = useRequestAutoRun(fetchData, [id]);

  useEffect(() => {
    if (artist) onLoadedData?.(artist);
  }, [artist, onLoadedData]);

  const tabsItems = useMemo(() => {
    const tabs = ["热门歌曲", "专辑"];
    artist?.hotTracks.length && (tabs[0] += ` ${artist?.hotTracks.length}`);
    artist?.detail.artist.albumSize && (tabs[1] += ` ${artist?.detail.artist.albumSize}`);
    return tabs;
  }, [artist?.detail.artist.albumSize, artist?.hotTracks.length]);
  const [activeTab, setActiveTab] = useState(0);

  const trackListRef = useRef<Nullable<TrackListRef>>(null);
  useImperativeHandle(
    ref,
    () => ({
      reload,
      artist,
      trackListRef: trackListRef.current
    }),
    [artist, reload]
  );

  const [trackListMounted, setTrackListMounted] = useState(false);
  const [albumListMounted, setAlbumListMounted] = useState(false);
  useEffect(() => {
    if (activeTab === 0) setTrackListMounted(true);
    else setAlbumListMounted(true);
  }, [activeTab]);

  // 右键菜单
  const { create, createTrackContextMenu } = AppContextMenu.useMenu();
  const onContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement, MouseEvent>, track: NeteaseTrackRecord) => {
      create(createTrackContextMenu, {
        track,
        clientX: e.clientX,
        clientY: e.clientY,
        onClick: (type, track) => {
          switch (type) {
            case "play":
              onClick?.(track, /* unused */ 0);
              break;
            case "album":
              onClickAlbum?.(track.detail.al.id);
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
      onClick,
      onClickAlbum,
      openComment
    ]
  );

  return (
    <div className={cx("flex flex-col", className)}>
      <AppErrorBoundary name="Artist" canReset toast onReset={reload}>
        <ThrowIf when={status === "error"} message="歌手加载失败" />
        <AppLoading loading={status === "loading"}>
          <Header
            className="shrink-0"
            artist={artist}
            onAvatarLoaded={onAvatarLoaded}
            tabsItem={tabsItems}
            activeIndex={activeTab}
            onChange={setActiveTab}
            pageActionType={pageActionType}
            onPageAction={onPageAction}
          />
          {trackListMounted && (
            <TrackList
              ref={trackListRef}
              id={id}
              className={cx("flex-1", activeTab !== 0 && "hidden")}
              activeID={activeTrackID}
              tracks={artist?.hotTracks ?? []}
              type={PlaylistSource.Normal}
              heartManager={heartManager}
              playableManager={playableManager}
              onClickAlbum={onClickAlbum}
              onClickArtist={onClickArtist}
              onClick={onClick}
              onContext={onContextMenu}
              trackCoverSize={ImageConstants.PlaylistPageTrackCoverSize}
            />
          )}
          {albumListMounted && (
            <AlbumList
              className={cx("flex-1 pb-4 pt-2", activeTab !== 1 && "hidden")}
              id={id}
              onClick={onClickAlbum}
            />
          )}
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};

export default memo(Artist);
