import { type FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/common/routes";
import { useUserTrackManager } from "@mahiru/ui/common/hooks/use-user-track-manager";
import { ElectronServicesBus } from "@mahiru/ui/common/source/electron/services";
import { useListenable } from "@mahiru/ui/common/hooks/use-listenable";
import { useArtistOrAlbumDisplayJump } from "@mahiru/ui/windows/display/hooks/use-artist-or-album-display-jump";
import { useDisplayPageAction } from "@mahiru/ui/windows/display/hooks/use-display-page-action";
import { usePlayerChangeActionFromDisplay } from "@mahiru/ui/windows/display/hooks/use-player-change-action-from-display";

import Artist, { type ArtistRef } from "@mahiru/ui/common/components/page/artist";

const ArtistDisplay: FC<object> = () => {
  const location = useLocation();
  const artistRef = useRef<ArtistRef>(null);
  const playerBus = useListenable(ElectronServicesBus.player);
  const { playableManager, heartManager } = useUserTrackManager();
  const { id } = RoutePath.parseQuery<{ id: number }>(location, RoutePathDisplay.artist);
  const { addTrackToPlaylistLast, addTrackToPlaylistNext, onTrackPlay, openTrackComment } =
    usePlayerChangeActionFromDisplay({
      getTracks: () => artistRef.current?.artist?.hotTracks ?? [],
      sourceID: id,
      sourceType: "other"
    });
  const { jumpArtistDisplay, jumpAlbumDisplay } = useArtistOrAlbumDisplayJump({
    currentArtistID: artistRef.current?.artist?.id
  });
  const { onPageAction } = useDisplayPageAction({
    type: "artist",
    id
  });

  return (
    <Artist
      id={id}
      ref={artistRef}
      activeTrackID={playerBus.data?.track?.id}
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
      openComment={openTrackComment}
    />
  );
};

export default memo(ArtistDisplay);
