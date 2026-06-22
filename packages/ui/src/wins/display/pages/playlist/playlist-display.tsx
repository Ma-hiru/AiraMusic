import { type FC, memo, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@/common/store/user";
import { RoutePathDisplay } from "@/common/routes";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useListenable } from "@/common/hooks/use-listenable";
import { useArtistOrAlbumDisplayJump } from "@/wins/display/hooks/use-artist-or-album-display-jump";
import { usePlayerChangeActionFromDisplay } from "@/wins/display/hooks/use-player-change-action-from-display";
import { useDisplayPageAction } from "@/wins/display/hooks/use-display-page-action";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useDisplayTitleRegister } from "@/wins/display/hooks/use-display-title";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useScrollActionsRegister } from "@/common/hooks/use-scroll-actions-register";
import { scrollActionsAtom } from "@/wins/display/atoms/layout";
import { useTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { RendererModified } from "@/common/lib/modified";

import Playlist, { type PlaylistRef } from "@/common/components/page/playlist";

const PlaylistDisplay: FC<object> = () => {
  const user = useUser();
  const playlistRef = useRef<Nullable<PlaylistRef>>(null);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const { heartManager, playableManager } = useUserTrackManager();
  const { id, source } = RoutePathDisplay.playlist.parseQuery(useLocation());

  const {
    onReplace,
    onTrackPlay,
    onAddList,
    addTrackToPlaylistLast,
    addTrackToPlaylistNext,
    openTrackComment
  } = usePlayerChangeActionFromDisplay({
    getTracks: () => playlistRef.current?.totalTracks.current ?? [],
    sourceID: Number(id),
    sourceType: "playlist"
  });
  const { jumpArtistDisplay, jumpAlbumDisplay } = useArtistOrAlbumDisplayJump();
  const { onPageAction } = useDisplayPageAction(() => {
    if (source !== "normal" && source !== "like") return null;
    return {
      type: "playlist",
      id: Number(id),
      source
    };
  });
  const { registerTitle } = useDisplayTitleRegister();
  // 当前歌单不应出现
  const { addTrackToPlaylist, addTracksToPlaylist } = useTrackAddToPlaylist(
    source === "normal" && id ? Number(id) : undefined
  );

  // 注册滚动和定位回调（display 窗口）
  const active = useRouterActive(RoutePathDisplay, "playlist");
  const { canFastLocate, canScrollTop } = useScrollActionsRegister({
    active,
    atom: scrollActionsAtom,
    getScrollTopFunc: () => playlistRef.current?.scrollTop,
    getFastLocateFunc: () => playlistRef.current?.fastLocator
  });

  const onEdited = useCallback(() => {
    RendererIPCMessageBus.modified.twoWay({
      type: "playlist-update",
      id,
      source
    });
    RendererIPCMessageBus.modified.twoWay({
      type: "user-playlist"
    });
  }, [id, source]);

  const onDeleted = useCallback(() => {
    RendererIPCMessageBus.modified.twoWay({ type: "user-playlist" });
    RendererIPCMessageBus.modified.twoWay({ type: "remove-playlist", id });
  }, [id]);

  useEffect(() => {
    if (!id && !source) return;
    return RendererModified.listen(
      {
        type: "playlist",
        id,
        source
      },
      () => playlistRef.current?.reload()
    );
  }, [id, source]);

  return (
    <Playlist
      ref={playlistRef}
      id={id}
      source={source}
      user={user}
      className="display-container pb-0!"
      onClickAlbum={jumpAlbumDisplay}
      onClickArtist={jumpArtistDisplay}
      onAddList={onAddList}
      onPlay={onTrackPlay}
      onReplace={onReplace}
      onEdited={onEdited}
      onDeleted={onDeleted}
      openComment={openTrackComment}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      addTrackToPlaylist={addTrackToPlaylist}
      addTracksToPlaylist={addTracksToPlaylist}
      heartManager={heartManager}
      playableManager={playableManager}
      activeTrackID={trackMetaBus.data?.track?.id}
      canFastLocate={canFastLocate}
      canScrollTop={canScrollTop}
      pageActionType="enter"
      onPageAction={onPageAction}
      onDataLoaded={(p) => p.name && registerTitle(p.name)}
    />
  );
};

export default memo(PlaylistDisplay);
