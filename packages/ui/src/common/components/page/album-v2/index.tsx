import { cx } from "@emotion/css";
import { GlobeOff } from "lucide-react";
import {
  memo,
  useId,
  useRef,
  type FC,
  useMemo,
  type Ref,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle
} from "react";
import { NeteaseImageSize } from "@/common/enum";
import { useOnline } from "@/common/hooks/use-online";
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
import AppError from "@/common/components/fallback/app-error";
import RendererImageConstants from "@/common/constants/image";
import AppLoading from "@/common/components/fallback/app-loading";
import TrackList, {
  type TrackListRef,
  type TrackListPlayableManager
} from "@/common/components/display/track_list";
import type { AlbumModifyType } from "@/common/hooks/use-album-modify-sync";

import Top from "./top";
import ArtistAlbums from "./artist-albums";
import ContentTabs, { type AlbumTab } from "./content-tabs";

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
  setIsTyping?: NormalFunc<[typing: boolean]>;
  onAddList: NormalFunc;
  onReplace?: NormalFunc;
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
  setIsTyping,
  onClick,
  onEdited,
  onAddList,
  onReplace,
  onClickAlbum,
  onDataLoaded,
  onPageAction,
  onClickArtist,
  onCoverLoaded,
  onRangeUpdate,
  coverSize,
  routerActive
}) => {
  const tabsID = useId();
  const [activeTab, setActiveTab] = useState<AlbumTab>("tracks");
  const [keyword, setKeyword] = useState("");
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

  const tracks = useMemo(() => {
    const allTracks = album?.tracks ?? [];
    const query = keyword.trim().toLowerCase();
    if (!query) return allTracks;
    return allTracks.filter(({ detail }) =>
      [
        detail.name,
        detail.al.name,
        ...detail.ar.map((artist) => artist.name),
        ...detail.alia,
        ...detail.tns
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [album, keyword]);

  useEffect(() => {
    setActiveTab("tracks");
    setKeyword("");
  }, [id]);

  const playAll = useCallback(() => {
    if (!album?.tracks.length) return;
    if (onReplace) onReplace();
    else onClick(album.tracks[0]!, 0);
  }, [album, onClick, onReplace]);

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
    onClickArtist,
    onPlay: onClick,
    openComment,
    addTrackToPlaylist
  });

  useEffect(() => {
    album && onDataLoaded?.(album);
  }, [album, onDataLoaded]);

  useAgentFocusCtx(
    { page: "album", name: album?.content.id === id ? album.content.name : "", id },
    routerActive
  );

  const { online } = useOnline();
  return (
    <div className={cx("flex h-full min-h-0 w-full flex-col overflow-hidden", className)}>
      <AppError
        reset={reload}
        when={status === "error"}
        tipsIcon={!online ? GlobeOff : undefined}
        tips={!online ? "网络连接中断，请检查网络后重试" : undefined}>
        <AppLoading loading={status === "loading"}>
          <Top
            user={user}
            album={album}
            reload={reload}
            dynamic={dynamic}
            coverSize={coverSize}
            pageActionType={pageActionType}
            onPlayAll={playAll}
            onAddList={onAddList}
            onPageAction={onPageAction}
            onCoverLoaded={onCoverLoaded}
            onEdited={() => onEdited?.(["star"])}>
            <ContentTabs
              id={tabsID}
              active={activeTab}
              searchTracks={setKeyword}
              setIsTyping={setIsTyping}
              trackCount={album?.tracks.length ?? 0}
              onChange={setActiveTab}
            />
            <div className="relative min-h-0 w-full flex-1">
              <div
                id={`${tabsID}-tracks-panel`}
                className={cx(
                  "absolute inset-0 pt-1",
                  activeTab !== "tracks" && "invisible pointer-events-none"
                )}
                role="tabpanel"
                inert={activeTab !== "tracks"}
                aria-hidden={activeTab !== "tracks"}
                aria-labelledby={`${tabsID}-tracks-tab`}>
                {album && (
                  <TrackList
                    ref={trackListRef}
                    id={album.content.id}
                    type="album"
                    tracks={tracks}
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
              </div>
              {activeTab === "albums" && album && (
                <div
                  id={`${tabsID}-albums-panel`}
                  className="absolute inset-0 pt-2"
                  role="tabpanel"
                  aria-labelledby={`${tabsID}-albums-tab`}>
                  <ArtistAlbums
                    currentAlbumID={album.content.id}
                    onClick={onClickAlbum}
                    artistID={
                      album.content.artist.id ||
                      album.content.artists.find((artist) => artist.id > 0)?.id ||
                      0
                    }
                  />
                </div>
              )}
            </div>
          </Top>
        </AppLoading>
      </AppError>
    </div>
  );
};

export default memo(Album);
