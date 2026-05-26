import { type FC, memo, useRef } from "react";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/common/routes";
import { useLocation } from "react-router-dom";
import { useArtistOrAlbumDisplayJump } from "@mahiru/ui/windows/display/hooks/use-artist-or-album-display-jump";
import { usePlayerChangeActionFromDisplay } from "@mahiru/ui/windows/display/hooks/use-player-change-action-from-display";
import { useUserTrackManager } from "@mahiru/ui/common/hooks/use-user-track-manager";
import { useListenable } from "@mahiru/ui/common/hooks/use-listenable";
import { ElectronServicesBus } from "@mahiru/ui/common/source/electron/services";
import ImageConstants from "@mahiru/ui/common/constants/image";

import Search, { type SearchRef } from "@mahiru/ui/common/components/page/search";

const SearchDisplay: FC<object> = () => {
  const location = useLocation();
  const searchRef = useRef<SearchRef>(null);
  const playerBus = useListenable(ElectronServicesBus.player);
  const { heartManager, playableManager } = useUserTrackManager();
  const { keyword } = RoutePath.parseQuery<{ keyword?: string }>(location, RoutePathDisplay.search);
  const { jumpArtistDisplay, jumpAlbumDisplay, jumpPlaylistDisplay } =
    useArtistOrAlbumDisplayJump();
  const { addTrackToPlaylistLast, addTrackToPlaylistNext, onTrackPlay, openTrackComment } =
    usePlayerChangeActionFromDisplay({
      getTracks: () => searchRef.current?.tracks ?? [],
      sourceID: 0,
      sourceType: "other"
    });
  return (
    <Search
      className="display-container"
      ref={searchRef}
      onClickPlaylist={jumpPlaylistDisplay}
      onClickAlbum={jumpAlbumDisplay}
      onClickArtist={jumpArtistDisplay}
      addToPlaylistNext={addTrackToPlaylistNext}
      addToPlaylistLast={addTrackToPlaylistLast}
      openComment={openTrackComment}
      onClickTrack={onTrackPlay}
      heartManager={heartManager}
      playableManager={playableManager}
      activeTrackID={playerBus.data?.track?.id}
      coverSize={ImageConstants.PlaylistPageTrackCoverSize}
      defaultKeyword={keyword}
    />
  );
};

export default memo(SearchDisplay);
