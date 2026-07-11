import { memo, useRef, type FC } from "react";
import { useLocation } from "react-router-dom";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { RoutePath, RoutePathMain, RoutePathDisplay } from "@/common/routes";
import { useTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { useDisplayTitleRegister } from "@/wins/display/hooks/use-display-title";
import { useDisplayPageAction } from "@/wins/display/hooks/use-display-page-action";
import { useArtistOrAlbumDisplayJump } from "@/wins/display/hooks/use-artist-or-album-display-jump";
import { usePlayerChangeActionFromDisplay } from "@/wins/display/hooks/use-player-change-action-from-display";
import RendererImageConstants from "@/common/constants/image";
import Album, { type AlbumPageRef } from "@/common/components/page/album";

const AlbumDisplay: FC<object> = () => {
  const location = useLocation();
  const albumRef = useRef<Nullable<AlbumPageRef>>(null);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const routerActive = useRouterActive(RoutePathDisplay, "album");
  const { id } = RoutePath.parseQuery<{ id: number }>(location, RoutePathMain.album);
  const { heartManager, playableManager } = useUserTrackManager();

  const {
    addTrackToPlaylistLast,
    addTrackToPlaylistNext,
    openTrackComment,
    onAddList,
    onTrackPlay
  } = usePlayerChangeActionFromDisplay({
    getTracks: () => albumRef.current?.album?.tracks ?? [],
    sourceID: id!,
    sourceType: "album"
  });
  const { jumpAlbumDisplay, jumpArtistDisplay } = useArtistOrAlbumDisplayJump({
    currentAlbumID: albumRef.current?.album?.content.id
  });
  const { onPageAction } = useDisplayPageAction({
    type: "album",
    id: id!
  });
  const { setTitle } = useDisplayTitleRegister("album", "专辑");
  const { addTrackToPlaylist } = useTrackAddToPlaylist();

  return (
    <Album
      ref={albumRef}
      id={id!}
      className="display-container pb-0!"
      pageActionType="out"
      heartManager={heartManager}
      routerActive={routerActive}
      openComment={openTrackComment}
      playableManager={playableManager}
      addTrackToPlaylist={addTrackToPlaylist}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      activeTrackID={trackMetaBus.data?.track?.id}
      coverSize={RendererImageConstants.AlbumPageCoverSize}
      onAddList={onAddList}
      onClick={onTrackPlay}
      onPageAction={onPageAction}
      onClickAlbum={jumpAlbumDisplay}
      onClickArtist={jumpArtistDisplay}
      onDataLoaded={(album) => {
        if (!album) return;
        const name = album.content.name;
        const artist = album.content.artists.map((a) => a.name).join("&");
        return setTitle(`${name} - ${artist}`);
      }}
    />
  );
};

export default memo(AlbumDisplay);
