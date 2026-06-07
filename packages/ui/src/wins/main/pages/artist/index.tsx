import { type FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useDisplayAction } from "@/wins/main/hooks/use-display-action";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";
import { useSetBackground } from "@/wins/main/hooks/use-set-background";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";

import Artist, { type ArtistRef } from "@/common/components/page/artist";

const ArtistPage: FC<object> = () => {
  const location = useLocation();
  const artistRef = useRef<ArtistRef>(null);
  const { id } = RoutePath.parseQuery<{ id: number }>(location, RoutePathMain.artist);
  const { setBackground } = useSetBackground("artist");
  const { onTrackPlay, addTrackToPlaylistNext, addTrackToPlaylistLast, openTrackComment, player } =
    usePlayerActionInList(() => artistRef.current?.artist?.hotTracks ?? []);
  const { jumpAlbumPage, jumpArtistPage } = usePageJump({
    currentArtistID: artistRef.current?.artist?.id
  });
  const { playableManager, heartManager } = useUserTrackManager();
  const { onPageAction } = useDisplayAction({
    id: id!,
    type: "artist"
  });

  return (
    <Artist
      id={id!}
      ref={artistRef}
      activeTrackID={player.current.track?.id}
      className="router-container"
      onAvatarLoaded={setBackground}
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
