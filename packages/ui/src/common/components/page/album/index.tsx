import { cx } from "@emotion/css";
import {
  memo,
  useRef,
  type FC,
  type Ref,
  useEffect,
  useCallback,
  useImperativeHandle
} from "react";
import { NeteaseImageSize } from "@/common/enum";
import { type HeartManager } from "@/common/hooks/use-heart";
import { NeteaseServicesAlbum } from "@/common/netease/services";
import { useAgentFocusCtx } from "@/common/hooks/use-agent-focus-ctx";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import {
  NeteaseUser,
  NeteaseAlbum,
  NeteaseTrackRecord,
  NeteaseHistoryRecord
} from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";
import Divider from "@/common/components/layout/divider";
import AppError from "@/common/components/fallback/app-error";
import RendererImageConstants from "@/common/constants/image";
import AppLoading from "@/common/components/fallback/app-loading";
import TrackList, {
  type TrackListRef,
  type TrackListPlayableManager
} from "@/common/components/display/track_list";
import type { AlbumModifyType } from "@/common/hooks/use-album-modify-sync";

import Top from "./top";

export type AlbumPageRef = {
  reload: NormalFunc;
  album: Nullable<NeteaseAlbum>;
  trackListRef: Nullable<TrackListRef>;
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
};

interface AlbumPageProps {
  ref?: Ref<AlbumPageRef>;
  id: number;
  className?: string;
  routerActive: boolean;
  coverSize: NeteaseImageSize;
  user: Nullable<NeteaseUser>;
  activeTrackID: Undefinable<number>;
  pageActionType: "out" | "none" | "enter";
  heartManager: HeartManager;
  playableManager: TrackListPlayableManager;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylist: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  onAddList: NormalFunc;
  onPageAction: NormalFunc;
  onClickAlbum: NormalFunc<[id: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  onCoverLoaded?: NormalFunc<[cover: string]>;
  onRangeUpdate?: NormalFunc<[range: IndexRange]>;
  onDataLoaded?: NormalFunc<[album: NeteaseAlbum]>;
  onEdited?: NormalFunc<[modifies: AlbumModifyType[]]>;
  onClick: NormalFunc<[track: NeteaseTrackRecord | NeteaseHistoryRecord, index: number]>;
}

const Album: FC<AlbumPageProps> = ({
  ref,
  id,
  user,
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
  onEdited,
  onAddList,
  onClickAlbum,
  onDataLoaded,
  onPageAction,
  onClickArtist,
  onCoverLoaded,
  onRangeUpdate,
  coverSize,
  routerActive
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
    fetchData,
    data: [album, dynamic] = [null, null]
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

  useAgentFocusCtx({ page: "album", name: album?.content.name ?? "", id }, routerActive);

  return (
    <div className={cx("w-full h-full flex flex-col", className)}>
      <AppError reset={reload} message="加载专辑失败" when={status === "error"}>
        <AppLoading loading={status === "loading"}>
          <Top
            user={user}
            album={album}
            reload={reload}
            dynamic={dynamic}
            coverSize={coverSize}
            pageActionType={pageActionType}
            onAddList={onAddList}
            onPageAction={onPageAction}
            onCoverLoaded={onCoverLoaded}
            onEdited={() => onEdited?.(["star"])}
          />
          <Divider className="my-3" />
          {album && (
            <TrackList
              ref={trackListRef}
              id={album.content.id}
              className="flex-1"
              type="album"
              tracks={album.tracks}
              activeID={activeTrackID}
              heartManager={heartManager}
              playableManager={playableManager}
              trackCoverSize={RendererImageConstants.PlaylistPageTrackCoverSize}
              onClick={onClick}
              onContext={onContextMenu}
              onClickAlbum={onClickAlbum}
              onClickArtist={onClickArtist}
              onRangeUpdate={onRangeUpdate}
            />
          )}
        </AppLoading>
      </AppError>
    </div>
  );
};

export default memo(Album);
