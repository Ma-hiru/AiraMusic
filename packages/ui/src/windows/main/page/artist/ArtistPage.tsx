import { FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@mahiru/ui/public/routes";
import { useArtistOrAlbumPageJump } from "@mahiru/ui/windows/main/hooks/useArtistOrAlbumPageJump";
import { usePageAction } from "@mahiru/ui/windows/main/hooks/usePageAction";
import { usePlayerChangeAction } from "@mahiru/ui/windows/main/hooks/usePlayerChangeAction";
import { useCoverLoadedAndSetTheme } from "@mahiru/ui/windows/main/hooks/useCoverLoadedAndSetTheme";
import { useUserTrackManager } from "@mahiru/ui/public/hooks/useUserTrackManager";

import Artist, { ArtistRef } from "@mahiru/ui/public/components/page/artist/Artist";

const ArtistPage: FC<object> = () => {
  const location = useLocation();
  const artistRef = useRef<ArtistRef>(null);
  const { id } = RoutePath.parseQuery<{ id: number }>(location, RoutePathMain.artist);
  const { onCoverLoaded } = useCoverLoadedAndSetTheme();
  const { onTrackPlay, addTrackToPlaylistNext, addTrackToPlaylistLast, openTrackComment, player } =
    usePlayerChangeAction(() => artistRef.current?.artist?.hotTracks ?? []);
  const { jumpAlbumPage, jumpArtistPage } = useArtistOrAlbumPageJump({
    currentArtistID: artistRef.current?.artist?.id
  });
  const { playableManager, heartManager } = useUserTrackManager();
  const { onPageAction } = usePageAction({
    id,
    type: "artist"
  });

  return (
    <Artist
      ref={artistRef}
      activeTrackID={player.current.track?.id}
      className="router-container"
      id={id}
      onAvatarLoaded={onCoverLoaded}
      onClick={onTrackPlay}
      onClickAlbum={jumpAlbumPage}
      onClickArtist={jumpArtistPage}
      heartManager={heartManager}
      playableManager={playableManager}
      pageActionType="out"
      onPageAction={onPageAction}
      addToPlaylistNext={addTrackToPlaylistNext}
      addToPlaylistLast={addTrackToPlaylistLast}
      openComment={openTrackComment}
    />
  );
};

export default memo(ArtistPage);
