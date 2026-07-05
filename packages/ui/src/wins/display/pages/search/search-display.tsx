import { memo, useRef, type FC } from "react";
import { useLocation } from "react-router-dom";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { RoutePath, RoutePathDisplay } from "@/common/routes";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { useArtistOrAlbumDisplayJump } from "@/wins/display/hooks/use-artist-or-album-display-jump";
import { usePlayerChangeActionFromDisplay } from "@/wins/display/hooks/use-player-change-action-from-display";
import RendererImageConstants from "@/common/constants/image";
import Search, { type SearchRef } from "@/common/components/page/search";

const SearchDisplay: FC<object> = () => {
  const location = useLocation();
  const searchRef = useRef<SearchRef>(null);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const routerActive = useRouterActive(RoutePathDisplay, "search");
  const { heartManager, playableManager } = useUserTrackManager();
  const { keyword } = RoutePath.parseQuery<{ keyword?: string }>(location, RoutePathDisplay.search);
  const { jumpAlbumDisplay, jumpArtistDisplay, jumpPlaylistDisplay } =
    useArtistOrAlbumDisplayJump();
  const { addTrackToPlaylistLast, addTrackToPlaylistNext, openTrackComment, onTrackPlay } =
    usePlayerChangeActionFromDisplay({
      getTracks: () => searchRef.current?.tracks ?? [],
      sourceID: 0,
      sourceType: "other"
    });
  const { addTrackToPlaylist } = useTrackAddToPlaylist();

  return (
    <Search
      ref={searchRef}
      className="display-container"
      defaultKeyword={keyword}
      heartManager={heartManager}
      routerActive={routerActive}
      openComment={openTrackComment}
      playableManager={playableManager}
      addTrackToPlaylist={addTrackToPlaylist}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      activeTrackID={trackMetaBus.data?.track?.id}
      coverSize={RendererImageConstants.PlaylistPageTrackCoverSize}
      onClickTrack={onTrackPlay}
      onClickAlbum={jumpAlbumDisplay}
      onClickArtist={jumpArtistDisplay}
      onClickPlaylist={jumpPlaylistDisplay}
    />
  );
};

export default memo(SearchDisplay);
