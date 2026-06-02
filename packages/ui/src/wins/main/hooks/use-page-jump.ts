import { useCallback } from "react";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { useLocation, useNavigate } from "react-router-dom";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useSettings } from "@/common/store/settings";
import { RendererWindow } from "@/common/lib/window";
import { RendererEventBus } from "@/common/lib/bus";

/** 跳转歌手和专辑页 */
export function usePageJump(
  props: {
    currentArtistID?: number;
    currentAlbumID?: number;
  } = {}
) {
  const navigate = useNavigate();
  const location = useLocation();
  const playlistRef = useLatestRef(RoutePathMain.playlist.parseQuery(location));
  const settingsRef = useLatestRef(useSettings());
  const propsRef = useLatestRef(props);

  const jumpAlbumPage = useCallback(
    (id: number) => {
      if (id === propsRef.current.currentAlbumID) return;
      if (settingsRef.current.preference.defaultUseDisplayWindow) {
        return RendererWindow.display.openAwait().then(() => {
          RendererEventBus.display.send({
            type: "album",
            id
          });
        });
      }
      navigate(RoutePath.withQuery(RoutePathMain.album, { id }));
    },
    [navigate, propsRef, settingsRef]
  );

  const jumpArtistPage = useCallback(
    (id: number) => {
      if (id === propsRef.current.currentArtistID) return;
      if (settingsRef.current.preference.defaultUseDisplayWindow) {
        return RendererWindow.display.openAwait().then(() => {
          RendererEventBus.display.send({
            type: "artist",
            id
          });
        });
      }
      navigate(RoutePath.withQuery(RoutePathMain.artist, { id }));
    },
    [navigate, propsRef, settingsRef]
  );

  const isPlaylistPage = location.pathname.includes(RoutePathMain.playlist.base);
  const jumpPlaylistPage = useCallback(
    (id: number, source: "normal" | "like" | "history") => {
      if (source !== "like" && id === Number(playlistRef.current.id) && isPlaylistPage) return;
      if (playlistRef.current.source === "like" && !id && isPlaylistPage) return;
      if (settingsRef.current.preference.defaultUseDisplayWindow && source !== "history") {
        return RendererWindow.display.openAwait().then(() => {
          RendererEventBus.display.send({
            type: "playlist",
            source,
            id
          });
        });
      }
      navigate(RoutePathMain.playlist.withQuery(id, source));
    },
    [isPlaylistPage, navigate, playlistRef, settingsRef]
  );

  return {
    jumpArtistPage,
    jumpAlbumPage,
    jumpPlaylistPage
  };
}
