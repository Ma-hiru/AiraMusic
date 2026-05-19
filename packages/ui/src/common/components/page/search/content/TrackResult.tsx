import { FC, MouseEvent as ReactMouseEvent, Ref, useCallback, useImperativeHandle } from "react";
import { NeteaseAPISearch } from "@mahiru/ui/common/source/netease/api";
import { NeteaseImageSize, PlaylistSource, SearchType } from "@mahiru/ui/common/enum";
import { NeteaseServicesTrack } from "@mahiru/ui/common/source/netease/services";
import { NeteaseHistory, NeteaseTrackRecord } from "@mahiru/ui/common/source/netease/models";
import { useRequestAutoRun, useRequestStatusWrap } from "@mahiru/ui/common/hooks/useRequestWrap";
import AppErrorBoundary from "@mahiru/ui/common/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/common/components/fallback/ThrowIf";
import AppLoading from "@mahiru/ui/common/components/fallback/AppLoading";
import TrackList, { TrackListPlayableManager } from "@mahiru/ui/common/components/track_list";
import ImageConstants from "@mahiru/ui/common/constants/image";
import { HeartManager } from "@mahiru/ui/common/hooks/useHeart";
import AppContextMenu from "@mahiru/ui/common/components/menu";

export type TrackResultRef = {
  tracks: NeteaseTrackRecord[];
};

interface TrackResultProps {
  ref?: Ref<TrackResultRef>;
  className?: string;
  keywords?: string;
  activeTrackID: Undefinable<number>;
  onClick: Optional<NormalFunc<[track: NeteaseTrackRecord | NeteaseHistory, index: number]>>;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  coverSize: NeteaseImageSize;
  heartManager: HeartManager;
  playableManager: TrackListPlayableManager;
}

const blankTracks: NeteaseTrackRecord[] = [];

const TrackResult: FC<TrackResultProps> = ({
  ref,
  className,
  keywords,
  onClick,
  onClickArtist,
  onClickAlbum,
  heartManager,
  playableManager,
  activeTrackID,
  addToPlaylistLast,
  addToPlaylistNext,
  openComment
}) => {
  const { status, data, fetchData } = useRequestStatusWrap(
    useCallback(async (keywords?: string) => {
      if (!keywords) return [];
      const res = await NeteaseAPISearch.search<"song">({
        keywords,
        type: SearchType.SONG,
        searchType: "NORMAL",
        limit: 100,
        offset: 0
      });
      const tracks = await NeteaseServicesTrack.ids(res.result.songs.map((s) => s.id));
      return tracks.map(
        (track) =>
          new NeteaseTrackRecord({
            detail: track,
            sourceName: "other",
            sourceID: 0
          })
      );
    }, [])
  );
  const { reload } = useRequestAutoRun(fetchData, [keywords]);
  const tracks = data ?? blankTracks;

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

  useImperativeHandle(
    ref,
    () => ({
      tracks
    }),
    [tracks]
  );
  return (
    <AppErrorBoundary name="TrackSearchResult" canReset toast onReset={reload}>
      <ThrowIf when={status === "error"} message="歌曲加载失败" />
      <AppLoading loading={status === "loading"}>
        <TrackList
          id={null}
          className={className}
          tracks={tracks}
          activeID={activeTrackID}
          trackCoverSize={ImageConstants.PlaylistPageTrackCoverSize}
          type={PlaylistSource.Search}
          playableManager={playableManager}
          heartManager={heartManager}
          onClick={onClick}
          onContext={onContextMenu}
          onClickAlbum={onClickAlbum}
          onClickArtist={onClickArtist}
        />
      </AppLoading>
    </AppErrorBoundary>
  );
};

export default TrackResult;
