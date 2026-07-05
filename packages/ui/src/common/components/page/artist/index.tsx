import { cx } from "@emotion/css";
import {
  memo,
  useRef,
  type FC,
  useMemo,
  type Ref,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle
} from "react";
import { type HeartManager } from "@/common/hooks/use-heart";
import { NeteaseServicesArtist } from "@/common/netease/services";
import { useAgentFocusCtx } from "@/common/hooks/use-agent-focus-ctx";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import { NeteaseArtist, NeteaseTrackRecord } from "@/common/netease/models";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import AppError from "@/common/components/fallback/app-error";
import RendererImageConstants from "@/common/constants/image";
import AppLoading from "@/common/components/fallback/app-loading";
import TrackList, {
  type TrackListRef,
  type TrackListClickFunc,
  type TrackListPlayableManager
} from "@/common/components/display/track_list";

import Header from "./header";
import AlbumList from "./album";

export type ArtistRef = {
  reload: NormalFunc;
  artist: Nullable<NeteaseArtist>;
  trackListRef: Nullable<TrackListRef>;
};

interface ArtistProps {
  ref?: Ref<ArtistRef>;
  id: number;
  className?: string;
  routerActive: boolean;
  activeTrackID?: number;
  pageActionType: "out" | "none" | "enter";
  heartManager: Optional<HeartManager>;
  playableManager: Optional<TrackListPlayableManager>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylist: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  onPageAction: NormalFunc;
  onClickAlbum: NormalFunc<[id: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  onAvatarLoaded?: NormalFunc<[avatar: string]>;
  onClick: TrackListClickFunc<NeteaseTrackRecord>;
  onDataLoaded?: NormalFunc<[artist: NeteaseArtist]>;
  onLoadedData?: NormalFunc<[artist: NeteaseArtist]>;
}

const Artist: FC<ArtistProps> = ({
  ref,
  id,
  className,
  activeTrackID,
  pageActionType,
  heartManager,
  playableManager,
  addToPlaylistLast,
  addToPlaylistNext,
  addTrackToPlaylist,
  openComment,
  onClick,
  onClickAlbum,
  onDataLoaded,
  onLoadedData,
  onPageAction,
  onClickArtist,
  onAvatarLoaded,
  routerActive
}) => {
  const requestData = useCallback((id: number) => {
    if (id <= 0 || !id) return Promise.resolve(null);
    return NeteaseServicesArtist.id(id);
  }, []);
  const { status, fetchData, data: artist = null } = useRequestStatusWrap(requestData);
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
  const { onContextMenu } = useTrackContextMenu({
    addToPlaylistLast,
    addToPlaylistNext,
    onClickAlbum,
    onPlay: onClick,
    openComment,
    addTrackToPlaylist
  });

  useEffect(() => {
    artist && onDataLoaded?.(artist);
  }, [artist, onDataLoaded]);

  useAgentFocusCtx({ page: "artist", id, name: artist?.detail.artist.name ?? "" }, routerActive);

  return (
    <div className={cx("flex flex-col", className)}>
      <AppError reset={reload} message="歌手加载失败" when={status === "error"}>
        <AppLoading loading={status === "loading"}>
          <Header
            className="shrink-0"
            artist={artist}
            tabsItem={tabsItems}
            activeIndex={activeTab}
            pageActionType={pageActionType}
            onChange={setActiveTab}
            onPageAction={onPageAction}
            onAvatarLoaded={onAvatarLoaded}
          />
          {trackListMounted && (
            <TrackList
              ref={trackListRef}
              id={id}
              className={cx("flex-1", activeTab !== 0 && "hidden")}
              type="normal"
              activeID={activeTrackID}
              heartManager={heartManager}
              tracks={artist?.hotTracks ?? []}
              playableManager={playableManager}
              trackCoverSize={RendererImageConstants.PlaylistPageTrackCoverSize}
              onClick={onClick}
              onContext={onContextMenu}
              onClickAlbum={onClickAlbum}
              onClickArtist={onClickArtist}
            />
          )}
          {albumListMounted && (
            <AlbumList
              id={id}
              className={cx("flex-1 pb-4 pt-2", activeTab !== 1 && "hidden")}
              onClick={onClickAlbum}
            />
          )}
        </AppLoading>
      </AppError>
    </div>
  );
};

export default memo(Artist);
