import { type FC, type Ref, useCallback, useEffect, useImperativeHandle } from "react";
import { NeteaseAPISearch } from "@/common/netease/api";
import { NeteaseImageSize, SearchType } from "@/common/enum";
import { NeteaseServicesTrack } from "@/common/netease/services";
import { NeteaseHistoryRecord, NeteaseTrackRecord } from "@/common/netease/models";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import { type HeartManager } from "@/common/hooks/use-heart";
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
  onClick: NormalFunc<[track: NeteaseTrackRecord | NeteaseHistoryRecord, index: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  onClickAlbum: NormalFunc<[id: number]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylist: NormalFunc<[track: NeteaseTrackRecord]>;
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
  addTrackToPlaylist,
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
    <AppError reset={reload} when={status === "error" && active} message="歌曲加载失败">
      <AppLoading loading={status === "loading" && active}>
        <TrackList
          id={null}
          className={className}
          tracks={tracks}
          activeID={activeTrackID}
          trackCoverSize={RendererImageConstants.PlaylistPageTrackCoverSize}
          type="normal"
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
