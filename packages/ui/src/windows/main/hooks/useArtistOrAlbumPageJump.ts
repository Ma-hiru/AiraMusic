import { useCallback } from "react";
import { RoutePath, RoutePathMain } from "@mahiru/ui/public/routes";
import { useNavigate } from "react-router-dom";
import { useLatestRef } from "@mahiru/ui/public/hooks/useLatestRef";

/** 跳转歌手和专辑页 */
export function useArtistOrAlbumPageJump(
  props: {
    currentArtistID?: number;
    currentAlbumID?: number;
  } = {}
) {
  const navigate = useNavigate();
  const propsRef = useLatestRef(props);

  const jumpAlbumPage = useCallback(
    (id: number) => {
      if (id === propsRef.current.currentAlbumID) return;
      navigate(RoutePath.withQuery(RoutePathMain.album, { id }));
    },
    [navigate, propsRef]
  );

  const jumpArtistPage = useCallback(
    (id: number) => {
      if (id === propsRef.current.currentArtistID) return;
      navigate(RoutePath.withQuery(RoutePathMain.artist, { id }));
    },
    [navigate, propsRef]
  );

  return {
    jumpArtistPage,
    jumpAlbumPage
  };
}
