import {
  type FC,
  type MouseEvent as ReactMouseEvent,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle
} from "react";
import { NeteaseAPISearch } from "@/common/netease/api";
import { NeteaseImageSize, PlaylistSource, SearchType } from "@/common/enum";
import { NeteaseServicesTrack } from "@/common/netease/services";
import { NeteaseHistoryRecord, NeteaseTrackRecord } from "@/common/netease/models";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { type HeartManager } from "@/common/hooks/use-heart";
import AppContextMenu from "@/common/components/display/menu";
import RendererImageConstants from "@/common/constants/image";
import AppLoading from "@/common/components/fallback/app-loading";
import TrackList, { type TrackListPlayableManager } from "@/common/components/display/track_list";
import AppError from "@/common/components/fallback/app-error";

export type TrackResultRef = {
  tracks: NeteaseTrackRecord[];
  count: number;
};

interface TrackResultProps {
  ref?: Ref<TrackResultRef>;
  className?: string;
  keywords?: string;
  activeTrackID: Undefinable<number>;
  onClick: Optional<NormalFunc<[track: NeteaseTrackRecord | NeteaseHistoryRecord, index: number]>>;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  coverSize: NeteaseImageSize;
  heartManager: HeartManager;
  playableManager: TrackListPlayableManager;
  active: boolean;
  setCount: NormalFunc<[count: number]>;
}

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
  openComment,
  active,
  setCount
}) => {
  const {
    status,
    data: tracks = [],
    fetchData
  } = useRequestStatusWrap(
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
      tracks,
      count: tracks.length
    }),
    [tracks]
  );

  useEffect(() => {
    active && setCount(tracks.length);
  }, [active, setCount, tracks.length]);

  return (
    <AppError reset={reload} when={status === "error" && active} message="歌曲加载失败">
      <AppLoading loading={status === "loading" && active}>
        <TrackList
          id={null}
          className={className}
          tracks={tracks}
          activeID={activeTrackID}
          trackCoverSize={RendererImageConstants.PlaylistPageTrackCoverSize}
          type={PlaylistSource.Search}
          playableManager={playableManager}
          heartManager={heartManager}
          onClick={onClick}
          onContext={onContextMenu}
          onClickAlbum={onClickAlbum}
          onClickArtist={onClickArtist}
          emptyTips="没有结果"
        />
      </AppLoading>
    </AppError>
  );
};

export default TrackResult;
