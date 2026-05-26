import { type FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { useArtistOrAlbumPageJump } from "@/wins/main/hooks/use-artist-or-album-page-jump";
import { usePageAction } from "@/wins/main/hooks/use-page-action";
import { usePlayerChangeAction } from "@/wins/main/hooks/use-player-change-action";
import { useCoverLoadedAndSetTheme } from "@/wins/main/hooks/use-cover-loaded-and-set-theme";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";

import Artist, { type ArtistRef } from "@/common/components/page/artist";

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
