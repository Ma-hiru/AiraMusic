import {
  FC,
  memo,
  MouseEvent as ReactMouseEvent,
  Ref,
  useCallback,
  useImperativeHandle,
  useRef
} from "react";
import {
  NeteaseAlbum,
  NeteaseHistory,
  NeteaseTrackRecord
} from "@mahiru/ui/public/source/netease/models";
import { cx } from "@emotion/css";
import { NeteaseImageSize, PlaylistSource } from "@mahiru/ui/public/enum";
import { HeartManager } from "@mahiru/ui/public/hooks/useHeart";
import { NeteaseServicesAlbum } from "@mahiru/ui/public/source/netease/services";
import { useRequestAutoRun, useRequestStatusWrap } from "@mahiru/ui/public/hooks/useRequestWrap";
import AppContextMenu from "@mahiru/ui/public/components/menu";
import ImageConstants from "@mahiru/ui/public/constants/image";

import Top from "./top";
import Divider from "./Divider";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";
import TrackList, {
  TrackListPlayableManager,
  TrackListRef
} from "@mahiru/ui/public/components/track_list/TrackList";

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
  onPlayAll: NormalFunc;
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
  onPlayAll,
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
  const { status, data, fetchData } = useRequestStatusWrap(requestData);
  const { reload } = useRequestAutoRun(fetchData, [id]);
  const [album, dynamic] = data ?? [null, null];

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
      <AppErrorBoundary name="Album" canReset className="w-full h-full" toast onReset={reload}>
        <ThrowIf when={status === "error"} message="加载专辑失败" />
        <AppLoading loading={status === "loading"}>
          <Top
            coverSize={coverSize}
            album={album}
            dynamic={dynamic}
            onAddList={onAddList}
            onPlayAll={onPlayAll}
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
              trackCoverSize={ImageConstants.PlaylistPageTrackCoverSize}
            />
          )}
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};

export default memo(Album);
