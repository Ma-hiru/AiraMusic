import { FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/public/routes";
import { useUserTrackManager } from "@mahiru/ui/public/hooks/useUserTrackManager";
import { ElectronServicesBus } from "@mahiru/ui/public/source/electron/services";
import { useListenable } from "@mahiru/ui/public/hooks/useListenable";
import { useArtistOrAlbumDisplayJump } from "@mahiru/ui/windows/display/hooks/useArtistOrAlbumDisplayJump";
import { useDisplayPageAction } from "@mahiru/ui/windows/display/hooks/useDisplayPageAction";
import { usePlayerChangeActionFromDisplay } from "@mahiru/ui/windows/display/hooks/usePlayerChangeActionFromDisplay";

import Artist, { ArtistRef } from "@mahiru/ui/public/components/page/artist/Artist";

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
      ref={artistRef}
      activeTrackID={playerBus.data?.track?.id}
      className="w-full h-full"
      id={id}
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
