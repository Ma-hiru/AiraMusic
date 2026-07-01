import { memo, useRef, type FC } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useDisplayAction } from "@/wins/main/hooks/use-display-action";
import { useSetBackground } from "@/wins/main/hooks/use-set-background";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";
import Artist, { type ArtistRef } from "@/common/components/page/artist";

const ArtistPage: FC<object> = () => {
  const location = useLocation();
  const artistRef = useRef<ArtistRef>(null);
  const { id } = RoutePath.parseQuery<{ id: number }>(location, RoutePathMain.artist);
  const { setBackground } = useSetBackground("artist");
  const { addTrackToPlaylistLast, addTrackToPlaylistNext, openTrackComment, onTrackPlay, player } =
    usePlayerActionInList(() => artistRef.current?.artist?.hotTracks ?? []);
  const { jumpAlbumPage, jumpArtistPage } = usePageJump({
    currentArtistID: artistRef.current?.artist?.id
  });
  const { heartManager, playableManager } = useUserTrackManager();
  const { onPageAction } = useDisplayAction({
    id: id!,
    type: "artist"
  });
  const { addTrackToPlaylist } = useTrackAddToPlaylist();

  return (
    <Artist
      ref={artistRef}
      id={id!}
      className="router-container"
      pageActionType="out"
      heartManager={heartManager}
      openComment={openTrackComment}
      playableManager={playableManager}
      addTrackToPlaylist={addTrackToPlaylist}
      activeTrackID={player.current.track?.id}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      onClick={onTrackPlay}
      onPageAction={onPageAction}
      onClickAlbum={jumpAlbumPage}
      onAvatarLoaded={setBackground}
      onClickArtist={jumpArtistPage}
    />
  );
};

export default memo(ArtistPage);
