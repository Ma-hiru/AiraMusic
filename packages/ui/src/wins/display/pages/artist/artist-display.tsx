import { type FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathDisplay } from "@/common/routes";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useListenable } from "@/common/hooks/use-listenable";
import { useArtistOrAlbumDisplayJump } from "@/wins/display/hooks/use-artist-or-album-display-jump";
import { useDisplayPageAction } from "@/wins/display/hooks/use-display-page-action";
import { usePlayerChangeActionFromDisplay } from "@/wins/display/hooks/use-player-change-action-from-display";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useDisplayTitleRegister } from "@/wins/display/hooks/use-display-title";
import { useTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";

import Artist, { type ArtistRef } from "@/common/components/page/artist";

const ArtistDisplay: FC<object> = () => {
  const location = useLocation();
  const artistRef = useRef<ArtistRef>(null);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const { playableManager, heartManager } = useUserTrackManager();
  const { id } = RoutePath.parseQuery<{ id: number }>(location, RoutePathDisplay.artist);
  const { addTrackToPlaylistLast, addTrackToPlaylistNext, onTrackPlay, openTrackComment } =
    usePlayerChangeActionFromDisplay({
      getTracks: () => artistRef.current?.artist?.hotTracks ?? [],
      sourceID: id!,
      sourceType: "other"
    });
  const { jumpArtistDisplay, jumpAlbumDisplay } = useArtistOrAlbumDisplayJump({
    currentArtistID: artistRef.current?.artist?.id
  });
  const { onPageAction } = useDisplayPageAction({
    type: "artist",
    id: id!
  });
  const { setTitle } = useDisplayTitleRegister("artist", "创作者");
  const { addTrackToPlaylist } = useTrackAddToPlaylist();

  return (
    <Artist
      id={id!}
      ref={artistRef}
      activeTrackID={trackMetaBus.data?.track?.id}
      className="display-container pb-0!"
      onClick={onTrackPlay}
      onClickAlbum={jumpAlbumDisplay}
      onClickArtist={jumpArtistDisplay}
      heartManager={heartManager}
      playableManager={playableManager}
      pageActionType="enter"
      onPageAction={onPageAction}
      addToPlaylistNext={addTrackToPlaylistNext}
      addToPlaylistLast={addTrackToPlaylistLast}
      addTrackToPlaylist={addTrackToPlaylist}
      openComment={openTrackComment}
      onDataLoaded={(artist) => {
        if (!artist) return;
        setTitle(artist.name);
      }}
    />
  );
};

export default memo(ArtistDisplay);
