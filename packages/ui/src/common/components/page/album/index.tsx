import {
  type FC,
  memo,
  type MouseEvent as ReactMouseEvent,
  type Ref,
  useCallback,
  useImperativeHandle,
  useRef
} from "react";
import { NeteaseAlbum, NeteaseHistory, NeteaseTrackRecord } from "@/common/netease/models";
import { cx } from "@emotion/css";
import { NeteaseImageSize, PlaylistSource } from "@/common/enum";
import { type HeartManager } from "@/common/hooks/use-heart";
import { NeteaseServicesAlbum } from "@/common/netease/services";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import AppContextMenu from "@/common/components/menu";
import RendererImageConstants from "@/common/constants/image";

import Top from "./top";
import Divider from "./divider";
import AppLoading from "@/common/components/fallback/app-loading";
import TrackList, {
  type TrackListPlayableManager,
  type TrackListRef
} from "@/common/components/track_list";
import AppError from "@/common/components/fallback/app-error";

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
  onClick: Optional<NormalFunc<[track: NeteaseTrackRecord | NeteaseHistory, index: number]>>;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
  onRangeUpdate?: NormalFunc<[range: IndexRange]>;
  onCoverLoaded?: NormalFunc<[cover: string]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  className?: string;
  coverSize: NeteaseImageSize;
  onAddList: NormalFunc;
  heartManager: HeartManager;
  playableManager: TrackListPlayableManager;
  pageActionType?: "enter" | "out" | "none";
  onPageAction?: NormalFunc;
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
  openComment
}) => {
  const requestData = useCallback(
    (
      id: number
    ): Promise<
      [Nullable<NeteaseAlbum>, Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>]
    > => {
      if (!id) return Promise.resolve([null, null]);
      return Promise.all([NeteaseServicesAlbum.id(id), NeteaseServicesAlbum.dynamic(id)] as const);
    },
    []
  );
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
          <Divider />
          {album && (
            <TrackList
              className="flex-1"
              heartManager={heartManager}
              playableManager={playableManager}
              ref={trackListRef}
              tracks={album.tracks}
              id={album.content.id}
              type={PlaylistSource.Album}
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
