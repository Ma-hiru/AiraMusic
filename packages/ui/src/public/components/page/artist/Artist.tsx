import { cx } from "@emotion/css";
import { PlaylistSource } from "@mahiru/ui/public/enum";
import { HeartManager } from "@mahiru/ui/public/hooks/useHeart";
import {
  FC,
  memo,
  Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { useRequestAutoRun, useRequestStatusWrap } from "@mahiru/ui/public/hooks/useRequestWrap";
import { NeteaseArtist, NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models";
import ImageConstants from "@mahiru/ui/windows/main/constants/image";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";

import Header from "./header";
import AlbumList from "./album";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";
import TrackList, {
  TrackListClickFunc,
  TrackListContextMenuFunc,
  TrackListPlayableManager,
  TrackListRef
} from "@mahiru/ui/public/components/track_list";

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
  onContext: Optional<TrackListContextMenuFunc<NeteaseTrackRecord>>;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
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
  onContext,
  onClickArtist,
  onClickAlbum
}) => {
  const requestData = useCallback((id: number) => {
    if (id <= 0 || !id) return Promise.resolve(null);
    return NeteaseServices.Artist.id(id);
  }, []);
  const { status, data: artist, fetchData } = useRequestStatusWrap(requestData);
  const { reload } = useRequestAutoRun(fetchData, [id]);

  useEffect(() => {
    if (artist) onLoadedData?.(artist);
  }, [artist, onLoadedData]);

  const tabsItems = ["歌曲", "专辑"];
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

  return (
    <div className={cx("overflow-hidden flex flex-col ", className)}>
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
          />
          {activeTab === 0 && (
            <TrackList
              ref={trackListRef}
              id={id}
              className="flex-1"
              activeID={activeTrackID}
              tracks={artist?.hotTracks ?? []}
              type={PlaylistSource.Normal}
              heartManager={heartManager}
              playableManager={playableManager}
              onClickAlbum={onClickAlbum}
              onClickArtist={onClickArtist}
              onClick={onClick}
              onContext={onContext}
              trackCoverSize={ImageConstants.PlaylistPageTrackCoverSize}
            />
          )}
          {activeTab === 1 && <AlbumList className="flex-1" id={id} />}
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};

export default memo(Artist);
