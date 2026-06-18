import { useCallback } from "react";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { useLocation, useNavigate } from "react-router-dom";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useSettings } from "@/common/store/settings";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";

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
    async (id: number) => {
      if (id === propsRef.current.currentAlbumID) return;

      if (settingsRef.current.preference.defaultUseDisplayWindow) {
        await RendererWindow.display.reactReadyAwait();
        return RendererIPCMessageBus.display.deliver({
          type: "album",
          id
        });
      }

      await navigate(RoutePath.withQuery(RoutePathMain.album, { id }));
    },
    [navigate, propsRef, settingsRef]
  );

  const jumpArtistPage = useCallback(
    async (id: number) => {
      if (id === propsRef.current.currentArtistID) return;

      if (settingsRef.current.preference.defaultUseDisplayWindow) {
        await RendererWindow.display.reactReadyAwait();
        return RendererIPCMessageBus.display.deliver({
          type: "artist",
          id
        });
      }

      await navigate(RoutePath.withQuery(RoutePathMain.artist, { id }));
    },
    [navigate, propsRef, settingsRef]
  );

  const isPlaylistPage = location.pathname.includes(RoutePathMain.playlist.base);
  const jumpPlaylistPage = useCallback(
    async (id: number, source: "normal" | "like") => {
      if (source !== "like" && id === Number(playlistRef.current.id) && isPlaylistPage) return;
      if (playlistRef.current.source === "like" && !id && isPlaylistPage) return;

      if (settingsRef.current.preference.defaultUseDisplayWindow) {
        await RendererWindow.display.reactReadyAwait();
        return RendererIPCMessageBus.display.deliver({
          type: "playlist",
          source,
          id
        });
      }

      await navigate(RoutePathMain.playlist.withQuery(id, source));
    },
    [isPlaylistPage, navigate, playlistRef, settingsRef]
  );

  const jumpHistoryPage = useCallback(async () => {
    if (settingsRef.current.preference.defaultUseDisplayWindow) {
      await RendererWindow.display.reactReadyAwait();
      return RendererIPCMessageBus.display.deliver({
        type: "history"
      });
    }
    await navigate(RoutePathMain.history);
  }, [navigate, settingsRef]);

  return {
    jumpArtistPage,
    jumpAlbumPage,
    jumpPlaylistPage,
    jumpHistoryPage
  };
}
