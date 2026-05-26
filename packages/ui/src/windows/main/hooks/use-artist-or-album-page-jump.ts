import { useCallback } from "react";
import { RoutePath, RoutePathMain } from "@mahiru/ui/common/routes";
import { useLocation, useNavigate } from "react-router-dom";
import { useLatestRef } from "@mahiru/ui/common/hooks/use-latest-ref";
import { useSettings } from "@mahiru/ui/common/store/settings";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/common/source/electron/services";

/** 跳转歌手和专辑页 */
export function useArtistOrAlbumPageJump(
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
        return ElectronServicesWindow.display.openAwait().then(() => {
          ElectronServicesBus.display.send({
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
        return ElectronServicesWindow.display.openAwait().then(() => {
          ElectronServicesBus.display.send({
            type: "artist",
            id
          });
        });
      }
      navigate(RoutePath.withQuery(RoutePathMain.artist, { id }));
    },
    [navigate, propsRef, settingsRef]
  );

  const jumpPlaylistPage = useCallback(
    (id: number, source: "normal" | "like" | "history") => {
      if (source !== "like" && id === Number(playlistRef.current.id)) return;
      if (playlistRef.current.source === "like" && !id) return;
      if (settingsRef.current.preference.defaultUseDisplayWindow && source !== "history") {
        return ElectronServicesWindow.display.openAwait().then(() => {
          ElectronServicesBus.display.send({
            type: "playlist",
            source,
            id
          });
        });
      }
      navigate(RoutePathMain.playlist.withQuery(id, source));
    },
    [navigate, playlistRef, settingsRef]
  );

  return {
    jumpArtistPage,
    jumpAlbumPage,
    jumpPlaylistPage
  };
}
