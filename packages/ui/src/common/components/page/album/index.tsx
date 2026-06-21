import {
  type FC,
  memo,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef
} from "react";
import { NeteaseAlbum, NeteaseHistoryRecord, NeteaseTrackRecord } from "@/common/netease/models";
import { cx } from "@emotion/css";
import { NeteaseImageSize } from "@/common/enum";
import { type HeartManager } from "@/common/hooks/use-heart";
import { NeteaseServicesAlbum } from "@/common/netease/services";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import RendererImageConstants from "@/common/constants/image";

import Top from "./top";
import AppLoading from "@/common/components/fallback/app-loading";
import TrackList, {
  type TrackListPlayableManager,
  type TrackListRef
} from "@/common/components/display/track_list";
import AppError from "@/common/components/fallback/app-error";
import Divider from "@/common/components/layout/divider";
import AppToast from "@/common/components/display/toast";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";

export type AlbumPageRef = {
  trackListRef: Nullable<TrackListRef>;
  album: Nullable<NeteaseAlbum>;
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  reload: NormalFunc;
};

interface AlbumPageProps {
  ref?: Ref<AlbumPageRef>;
  id: number;
  activeTrackID: Undefinable<number>;
  onClick: NormalFunc<[track: NeteaseTrackRecord | NeteaseHistoryRecord, index: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  onClickAlbum: NormalFunc<[id: number]>;
  onRangeUpdate?: NormalFunc<[range: IndexRange]>;
  onCoverLoaded?: NormalFunc<[cover: string]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylist: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  className?: string;
  coverSize: NeteaseImageSize;
  onAddList: NormalFunc;
  heartManager: HeartManager;
  playableManager: TrackListPlayableManager;
  pageActionType: "enter" | "out" | "none";
  onPageAction: NormalFunc;
  onDataLoaded?: NormalFunc<[album: NeteaseAlbum]>;
}

const Album: FC<AlbumPageProps> = ({
  ref,
  id,
  activeTrackID,
  onClick,
  onClickArtist,
  onClickAlbum,
  onRangeUpdate,
  onCoverLoaded,
  className,
  coverSize,
  onAddList,
  heartManager,
  playableManager,
  pageActionType,
  onPageAction,
  addToPlaylistNext,
  addToPlaylistLast,
  openComment,
  onDataLoaded,
  addTrackToPlaylist
}) => {
  const requestData = useCallback(async (id: number) => {
    if (!id) return Promise.resolve([null, null]);

    const [album, dynamic] = await Promise.all([
      NeteaseServicesAlbum.id(id),
      NeteaseServicesAlbum.dynamic(id)
    ]);
    if (album.tracks.length === 0) {
      AppToast.show({
        type: "error",
        text: "获取专辑歌曲失败，请稍后重试"
      });
    }

    return [album, dynamic] as [
      Nullable<NeteaseAlbum>,
      Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>
    ];
  }, []);
  const {
    status,
    data: [album, dynamic] = [null, null],
    fetchData
  } = useRequestStatusWrap(requestData);
  const { reload } = useRequestAutoRun(fetchData, [id]);

  const trackListRef = useRef<Nullable<TrackListRef>>(null);
  useImperativeHandle(
    ref,
    () => ({
      trackListRef: trackListRef.current,
      album,
      dynamic,
      reload
    }),
    [album, dynamic, reload]
  );

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
    album && onDataLoaded?.(album);
  }, [album, onDataLoaded]);

  return (
    <div className={cx("w-full h-full flex flex-col", className)}>
      <AppError reset={reload} message="加载专辑失败" when={status === "error"}>
        <AppLoading loading={status === "loading"}>
          <Top
            coverSize={coverSize}
            album={album}
            dynamic={dynamic}
            onAddList={onAddList}
            onCoverLoaded={onCoverLoaded}
            pageActionType={pageActionType}
            onPageAction={onPageAction}
          />
          <Divider className="my-3" />
          {album && (
            <TrackList
              className="flex-1"
              heartManager={heartManager}
              playableManager={playableManager}
              ref={trackListRef}
              tracks={album.tracks}
              id={album.content.id}
              type="album"
              activeID={activeTrackID}
              onClick={onClick}
              onContext={onContextMenu}
              onRangeUpdate={onRangeUpdate}
              onClickAlbum={onClickAlbum}
              onClickArtist={onClickArtist}
              trackCoverSize={RendererImageConstants.PlaylistPageTrackCoverSize}
            />
          )}
        </AppLoading>
      </AppError>
    </div>
  );
};

export default memo(Album);
