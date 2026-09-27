import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { RoutePath, RoutePathDisplay } from "@/common/routes";
import AppToast from "@/common/components/display/toast";

/** 跳转歌手和专辑页 */
export function useArtistOrAlbumDisplayJump(
  props: {
    currentAlbumID?: number;
    currentArtistID?: number;
  } = {}
) {
  const navigate = useNavigate();
  const propsRef = useLatestRef(props);
  const jumpAlbumDisplay = useCallback(
    (id: number) => {
      if (id === 0) return AppToast.show({ type: "warn", text: "专辑不存在" });
      if (id === propsRef.current.currentAlbumID) return;
      navigate(RoutePath.withQuery(RoutePathDisplay.album, { id }));
    },
    [navigate, propsRef]
  );

  const jumpArtistDisplay = useCallback(
    (id: number) => {
      if (id === 0) return AppToast.show({ type: "warn", text: "艺术家不存在" });
      if (id === propsRef.current.currentArtistID) return;
      navigate(RoutePath.withQuery(RoutePathDisplay.artist, { id }));
    },
    [navigate, propsRef]
  );

  const jumpPlaylistDisplay = useCallback(
    (id: number) => {
      if (id == null) return AppToast.show({ type: "warn", text: "歌单不存在" });
      navigate(RoutePathDisplay.playlist.withQuery(id, "normal"));
    },
    [navigate]
  );

  return {
    jumpAlbumDisplay,
    jumpArtistDisplay,
    jumpPlaylistDisplay
  };
}
