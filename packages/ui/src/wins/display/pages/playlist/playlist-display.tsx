import { useLocation } from "react-router-dom";
import { memo, useRef, type FC, useEffect } from "react";
import { useUser } from "@/common/store/user";
import { RoutePathDisplay } from "@/common/routes";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { RendererModified } from "@/common/lib/modified";
import { useListenable } from "@/common/hooks/use-listenable";
import { scrollActionsAtom } from "@/wins/display/atoms/layout";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { usePlaylistModifySync } from "@/common/hooks/use-playlist-modify-sync";
import { useTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { useDisplayTitleRegister } from "@/wins/display/hooks/use-display-title";
import { useDisplayPageAction } from "@/wins/display/hooks/use-display-page-action";
import { useScrollActionsRegister } from "@/common/hooks/use-scroll-actions-register";
import { useArtistOrAlbumDisplayJump } from "@/wins/display/hooks/use-artist-or-album-display-jump";
import { usePlayerChangeActionFromDisplay } from "@/wins/display/hooks/use-player-change-action-from-display";
import Playlist, { type PlaylistRef } from "@/common/components/page/playlist";

const PlaylistDisplay: FC<object> = () => {
  const user = useUser();
  const playlistRef = useRef<Nullable<PlaylistRef>>(null);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const { heartManager, playableManager } = useUserTrackManager();
  const { id, source } = RoutePathDisplay.playlist.parseQuery(useLocation());

  const {
    addTrackToPlaylistLast,
    addTrackToPlaylistNext,
    openTrackComment,
    onAddList,
    onReplace,
    onTrackPlay
  } = usePlayerChangeActionFromDisplay({
    getTracks: () => playlistRef.current?.totalTracks.current ?? [],
    sourceID: Number(id),
    sourceType: "playlist"
  });
  const { jumpAlbumDisplay, jumpArtistDisplay } = useArtistOrAlbumDisplayJump();
  const { onPageAction } = useDisplayPageAction(() => {
    if (source !== "normal" && source !== "like") return null;
    return {
      type: "playlist",
      id: Number(id),
      source
    };
  });
  const { setTitle } = useDisplayTitleRegister("playlist", "歌单");
  // 当前歌单不应出现
  const { addTrackToPlaylist, addTracksToPlaylist } = useTrackAddToPlaylist(
    source === "normal" && id ? Number(id) : undefined
  );

  // 注册滚动和定位回调（display 窗口）
  const active = useRouterActive(RoutePathDisplay, "playlist");
  const { canScrollTop, canFastLocate } = useScrollActionsRegister({
    active,
    atom: scrollActionsAtom,
    getScrollTopFunc: () => playlistRef.current?.scrollTop,
    getFastLocateFunc: () => playlistRef.current?.fastLocator
  });
  const { onEdited, onDeleted } = usePlaylistModifySync(id, source);

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
      className="display-container pb-0!"
      user={user}
      source={source}
      routerActive={active}
      pageActionType="enter"
      canScrollTop={canScrollTop}
      heartManager={heartManager}
      canFastLocate={canFastLocate}
      openComment={openTrackComment}
      playableManager={playableManager}
      addTrackToPlaylist={addTrackToPlaylist}
      addTracksToPlaylist={addTracksToPlaylist}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      activeTrackID={trackMetaBus.data?.track?.id}
      onEdited={onEdited}
      onPlay={onTrackPlay}
      onAddList={onAddList}
      onDeleted={onDeleted}
      onReplace={onReplace}
      onPageAction={onPageAction}
      onClickAlbum={jumpAlbumDisplay}
      onClickArtist={jumpArtistDisplay}
      onDataLoaded={(p) => p.name && setTitle(p.name)}
    />
  );
};

export default memo(PlaylistDisplay);
