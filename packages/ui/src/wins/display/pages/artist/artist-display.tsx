import { memo, useRef, type FC } from "react";
import { useLocation } from "react-router-dom";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { RoutePath, RoutePathDisplay } from "@/common/routes";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { useDisplayTitleRegister } from "@/wins/display/hooks/use-display-title";
import { useDisplayPageAction } from "@/wins/display/hooks/use-display-page-action";
import { useArtistOrAlbumDisplayJump } from "@/wins/display/hooks/use-artist-or-album-display-jump";
import { usePlayerChangeActionFromDisplay } from "@/wins/display/hooks/use-player-change-action-from-display";
import Artist, { type ArtistRef } from "@/common/components/page/artist";

const ArtistDisplay: FC<object> = () => {
  const location = useLocation();
  const artistRef = useRef<ArtistRef>(null);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const { heartManager, playableManager } = useUserTrackManager();
  const { id } = RoutePath.parseQuery<{ id: number }>(location, RoutePathDisplay.artist);
  const { addTrackToPlaylistLast, addTrackToPlaylistNext, openTrackComment, onTrackPlay } =
    usePlayerChangeActionFromDisplay({
      getTracks: () => artistRef.current?.artist?.hotTracks ?? [],
      sourceID: id!,
      sourceType: "other"
    });
  const { jumpAlbumDisplay, jumpArtistDisplay } = useArtistOrAlbumDisplayJump({
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
      ref={artistRef}
      id={id!}
      className="display-container pb-0!"
      pageActionType="enter"
      heartManager={heartManager}
      openComment={openTrackComment}
      playableManager={playableManager}
      addTrackToPlaylist={addTrackToPlaylist}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      activeTrackID={trackMetaBus.data?.track?.id}
      onClick={onTrackPlay}
      onPageAction={onPageAction}
      onClickAlbum={jumpAlbumDisplay}
      onClickArtist={jumpArtistDisplay}
      onDataLoaded={(artist) => {
        if (!artist) return;
        setTitle(artist.name);
      }}
    />
  );
};

export default memo(ArtistDisplay);
