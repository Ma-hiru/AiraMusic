import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RendererWindow } from "@/common/lib/window";
import { useSettings } from "@/common/store/settings";
import { userStoreSnapshot } from "@/common/store/user";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { NeteaseServicesAlbum, NeteaseServicesPlaylist } from "@/common/netease/services";
import AppToast from "@/common/components/display/toast";

/** 跳转歌手和专辑页 */
export function usePageJump(
  props: {
    currentAlbumID?: number;
    currentArtistID?: number;
  } = {}
) {
  const navigate = useNavigate();
  const location = useLocation();
  const playlistRef = useLatestRef(RoutePathMain.playlist.parseQuery(location));
  const settingsRef = useLatestRef(useSettings());
  const propsRef = useLatestRef(props);

  const jumpAlbumPage = useCallback(
    async (id: number) => {
      if (id === 0) return AppToast.show({ type: "warn", text: "专辑不存在" });
      if (id === propsRef.current.currentAlbumID) return;

      if (settingsRef.current.preference.defaultUseDisplayWindow) {
        NeteaseServicesAlbum.preload(id);
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
      if (id === 0) return AppToast.show({ type: "warn", text: "艺术家不存在" });
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
    async (id: number, source: "like" | "normal") => {
      if (id == null) return AppToast.show({ type: "error", text: "歌单参数错误" });
      if (id === 0 && source !== "like") return AppToast.show({ type: "info", text: "歌单不存在" });

      // 已在目标界面
      if (isPlaylistPage) {
        // normal
        if (source !== "like" && id === Number(playlistRef.current.id)) return;
        // like
        if (playlistRef.current.source === "like" && id === 0) return;
      }

      // 默认多窗口打开
      if (settingsRef.current.preference.defaultUseDisplayWindow) {
        // “我喜欢” 歌单这里，id为0，不合法，内部要重新获取id！
        const real_id = id || userStoreSnapshot()._user?.likedPlaylist.id;
        // 为可能的多窗口合并到主窗口的操作，预加载数据
        real_id && NeteaseServicesPlaylist.preload(id);

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
