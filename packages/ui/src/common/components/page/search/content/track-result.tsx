import { type FC, type Ref, useEffect, useCallback, useImperativeHandle } from "react";
import { NeteaseAPISearch } from "@/common/netease/api";
import { SearchType, NeteaseImageSize } from "@/common/enum";
import { type HeartManager } from "@/common/hooks/use-heart";
import { NeteaseServicesTrack } from "@/common/netease/services";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import { NeteaseTrackRecord, NeteaseHistoryRecord } from "@/common/netease/models";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import AppError from "@/common/components/fallback/app-error";
import RendererImageConstants from "@/common/constants/image";
import AppLoading from "@/common/components/fallback/app-loading";
import TrackList, { type TrackListPlayableManager } from "@/common/components/display/track_list";

export type TrackResultRef = {
  count: number;
  tracks: NeteaseTrackRecord[];
};

interface TrackResultProps {
  ref?: Ref<TrackResultRef>;
  active: boolean;
  keywords?: string;
  className?: string;
  coverSize: NeteaseImageSize;
  activeTrackID: Undefinable<number>;
  heartManager: HeartManager;
  playableManager: TrackListPlayableManager;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylist: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  setCount: NormalFunc<[count: number]>;
  onClickAlbum: NormalFunc<[id: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  onClick: NormalFunc<[track: NeteaseTrackRecord | NeteaseHistoryRecord, index: number]>;
}

const TrackResult: FC<TrackResultProps> = ({
  ref,
  className,
  activeTrackID,
  heartManager,
  playableManager,
  addToPlaylistLast,
  addToPlaylistNext,
  addTrackToPlaylist,
  openComment,
  setCount,
  onClick,
  onClickAlbum,
  onClickArtist,
  active,
  keywords
}) => {
  const {
    status,
    fetchData,
    data: tracks = []
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
      const tracks = await NeteaseServicesTrack.ids(res.result.songs?.map((s) => s.id) ?? []);
      return (
        tracks?.map(
          (track) =>
            new NeteaseTrackRecord({
              detail: track,
              sourceName: "other",
              sourceID: 0
            })
        ) ?? []
      );
    }, [])
  );
  const { reload } = useRequestAutoRun(fetchData, [keywords]);

  // 右键菜单
  const { onContextMenu } = useTrackContextMenu({
    addToPlaylistLast,
    addToPlaylistNext,
    onClickAlbum,
    onPlay: onClick,
    openComment,
    addTrackToPlaylist
  });

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
    <AppError reset={reload} message="歌曲加载失败" when={status === "error" && active}>
      <AppLoading loading={status === "loading" && active}>
        <TrackList
          id={null}
          className={className}
          type="normal"
          tracks={tracks}
          emptyTips="没有结果"
          activeID={activeTrackID}
          heartManager={heartManager}
          playableManager={playableManager}
          trackCoverSize={RendererImageConstants.PlaylistPageTrackCoverSize}
          onClick={onClick}
          onContext={onContextMenu}
          onClickAlbum={onClickAlbum}
          onClickArtist={onClickArtist}
        />
      </AppLoading>
    </AppError>
  );
};

export default TrackResult;
