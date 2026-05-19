import { FC, memo, useRef } from "react";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/common/routes";
import { useLocation } from "react-router-dom";

import Search, { SearchRef } from "@mahiru/ui/common/components/page/search/Search";
import { useArtistOrAlbumDisplayJump } from "@mahiru/ui/windows/display/hooks/useArtistOrAlbumDisplayJump";
import { usePlayerChangeActionFromDisplay } from "@mahiru/ui/windows/display/hooks/usePlayerChangeActionFromDisplay";
import { useUserTrackManager } from "@mahiru/ui/common/hooks/useUserTrackManager";
import { useListenable } from "@mahiru/ui/common/hooks/useListenable";
import { ElectronServicesBus } from "@mahiru/ui/common/source/electron/services";
import ImageConstants from "@mahiru/ui/common/constants/image";

const SearchDisplay: FC<object> = () => {
  const location = useLocation();
  const searchRef = useRef<SearchRef>(null);
  const playerBus = useListenable(ElectronServicesBus.player);
  const { heartManager, playableManager } = useUserTrackManager();
  const { keyword } = RoutePath.parseQuery<{ keyword?: string }>(location, RoutePathDisplay.search);
  const { jumpArtistDisplay, jumpAlbumDisplay } = useArtistOrAlbumDisplayJump();
  const { addTrackToPlaylistLast, addTrackToPlaylistNext, onTrackPlay, openTrackComment } =
    usePlayerChangeActionFromDisplay({
      getTracks: () => searchRef.current?.tracks ?? [],
      sourceID: 0,
      sourceType: "other"
    });
  return (
    <Search
      className="w-full h-full text-(--text-color-on-main)"
      ref={searchRef}
      onJumpAlbum={null}
      onJumpArtist={null}
      onJumpPlaylist={null}
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
