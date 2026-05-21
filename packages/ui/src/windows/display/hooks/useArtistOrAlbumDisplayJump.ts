import { useCallback } from "react";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/common/routes";
import { useNavigate } from "react-router-dom";
import { useLatestRef } from "@mahiru/ui/common/hooks/useLatestRef";
import { PlaylistSource } from "@mahiru/ui/common/enum";

/** 跳转歌手和专辑页 */
export function useArtistOrAlbumDisplayJump(
  props: {
    currentArtistID?: number;
    currentAlbumID?: number;
  } = {}
) {
  const navigate = useNavigate();
  const propsRef = useLatestRef(props);
  const jumpAlbumDisplay = useCallback(
    (id: number) => {
      if (id === propsRef.current.currentAlbumID) return;
      navigate(RoutePath.withQuery(RoutePathDisplay.album, { id }));
    },
    [navigate, propsRef]
  );
  const jumpArtistDisplay = useCallback(
    (id: number) => {
      if (id === propsRef.current.currentArtistID) return;
      navigate(RoutePath.withQuery(RoutePathDisplay.artist, { id }));
    },
    [navigate, propsRef]
  );
  const jumpPlaylistDisplay = useCallback(
    (id: number) => {
      navigate(RoutePathDisplay.playlist.withQuery(id, PlaylistSource.Normal));
    },
    [navigate]
  );
  return {
    jumpAlbumDisplay,
    jumpArtistDisplay,
    jumpPlaylistDisplay
  };
}
