import { useUser } from "@/common/store/user";
import { useCallback } from "react";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { type NeteaseTrackRecord, NeteaseUser } from "@/common/netease/models";
import { createAddToPlaylistModal } from "@/common/components/display/modal/add-to-playlist-modal";
import AppModal from "@/common/components/display/modal";
import AppToast from "@/common/components/display/toast";

export function useTrackAddToPlaylist(excludeId?: number) {
  const user = useUser();
  const { create, createAddToPlaylistModal } = AppModal.useModal();
  const open = useCallback(
    async (tracks: NeteaseTrackRecord[]) => {
      if (!user?.isLoggedIn) {
        AppToast.show({
          type: "info",
          text: "请先登录"
        });
        return Promise.resolve(false);
      }
      if (tracks.length === 0) return Promise.resolve(false);
      const { promise, resolve } = Promise.withResolvers<boolean>();
      create(createAddToPlaylistModal, {
        tracks,
        excludeId,
        onClose: () => resolve(false),
        onCreated: async (pid) => {
          RendererIPCMessageBus.modified.twoWay({
            type: "playlist-update",
            source: "normal", // 不考虑添加到 like 应该直接点击红心
            id: pid
          });
          RendererIPCMessageBus.modified.twoWay({
            type: "user-playlist"
          });
          resolve(true);
        }
      });
      return promise;
    },
    [create, createAddToPlaylistModal, user, excludeId]
  );

  const addTrackToPlaylist = useCallback((track: NeteaseTrackRecord) => open([track]), [open]);
  const addTracksToPlaylist = useCallback((tracks: NeteaseTrackRecord[]) => open(tracks), [open]);

  return {
    addTrackToPlaylist,
    addTracksToPlaylist
  };
}

/**
 * 不使用 useModal（{@link useTrackAddToPlaylist}） 的版本，即不关闭上一个 modal，而是直接替换
 * 在嵌套 modal 中使用，比如播放列表
 * */
export function openTrackAddToPlaylist(
  tracks: NeteaseTrackRecord[] | NeteaseTrackRecord,
  excludeId?: number
) {
  if (!NeteaseUser.isLoggedIn) {
    return AppToast.show({
      type: "info",
      text: "请先登录"
    });
  }
  if (!Array.isArray(tracks)) tracks = [tracks];
  if (tracks.length === 0) return;
  AppModal._create(createAddToPlaylistModal, {
    tracks,
    excludeId,
    onCreated: async (pid) => {
      RendererIPCMessageBus.modified.twoWay({
        type: "playlist-update",
        source: "normal", // 不考虑添加到 like 应该直接点击红心
        id: pid
      });
      RendererIPCMessageBus.modified.twoWay({
        type: "user-playlist"
      });
    }
  });
}
