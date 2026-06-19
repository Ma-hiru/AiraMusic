import { cx } from "@emotion/css";
import { PlaylistSource } from "@/common/enum";
import { type HeartManager } from "@/common/hooks/use-heart";
import {
  type FC,
  memo,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { NeteaseArtist, NeteaseTrackRecord } from "@/common/netease/models";
import { NeteaseServicesArtist } from "@/common/netease/services";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import RendererImageConstants from "@/common/constants/image";

import Header from "./header";
import AlbumList from "./album";
import AppLoading from "@/common/components/fallback/app-loading";
import TrackList, {
  type TrackListClickFunc,
  type TrackListPlayableManager,
  type TrackListRef
} from "@/common/components/display/track_list";
import AppError from "@/common/components/fallback/app-error";

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
  onClick: TrackListClickFunc<NeteaseTrackRecord>;
  onClickArtist: NormalFunc<[id: number]>;
  onClickAlbum: NormalFunc<[id: number]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  pageActionType: "enter" | "out" | "none";
  onPageAction: NormalFunc;
  onDataLoaded?: NormalFunc<[artist: NeteaseArtist]>;
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
  openComment,
  onDataLoaded
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
  const { onContextMenu } = useTrackContextMenu({
    addToPlaylistLast,
    addToPlaylistNext,
    onClickAlbum,
    onPlay: onClick,
    openComment
  });

  useEffect(() => {
    artist && onDataLoaded?.(artist);
  }, [artist, onDataLoaded]);

  return (
    <div className={cx("flex flex-col", className)}>
      <AppError reset={reload} message="歌手加载失败" when={status === "error"}>
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
              trackCoverSize={RendererImageConstants.PlaylistPageTrackCoverSize}
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
      </AppError>
    </div>
  );
};

export default memo(Artist);
