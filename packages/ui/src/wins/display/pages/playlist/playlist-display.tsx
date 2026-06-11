import { type FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@/common/store/user";
import { RoutePathDisplay } from "@/common/routes";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useListenable } from "@/common/hooks/use-listenable";
import { PlaylistSource } from "@/common/enum";
import { useArtistOrAlbumDisplayJump } from "@/wins/display/hooks/use-artist-or-album-display-jump";
import { usePlayerChangeActionFromDisplay } from "@/wins/display/hooks/use-player-change-action-from-display";
import { useDisplayPageAction } from "@/wins/display/hooks/use-display-page-action";
import { RendererEventBus } from "@/common/lib/bus";
import { useDisplayTitle } from "@/wins/display/hooks/use-display-title";

import Playlist, { type PlaylistRef } from "@/common/components/page/playlist";

const PlaylistDisplay: FC<object> = () => {
  const user = useUser();
  const playlistRef = useRef<Nullable<PlaylistRef>>(null);
  const playerBus = useListenable(RendererEventBus.player);
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
    if (source !== PlaylistSource.Normal && source !== PlaylistSource.Like) return null;
    return {
      type: "playlist",
      id: Number(id),
      source
    };
  });
  const { updateTitle } = useDisplayTitle("playlist");

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
      openComment={openTrackComment}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      heartManager={heartManager}
      playableManager={playableManager}
      activeTrackID={playerBus.data?.track?.id}
      canFastLocate={null}
      canScrollTop={null}
      pageActionType="enter"
      onPageAction={onPageAction}
      onDataLoaded={(p) => p.name && updateTitle(p.name)}
    />
  );
};

export default memo(PlaylistDisplay);
