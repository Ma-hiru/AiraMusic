import { useUser } from "@/common/store/user";
import { useCallback } from "react";
import { type NeteaseTrackRecord } from "@/common/netease/models";
import AppModal from "@/common/components/display/modal";
import AppToast from "@/common/components/display/toast";
import { RendererIPCMessageBus } from "@/common/lib/bus";

export function useTrackAddToPlaylist(excludeId?: number) {
  const user = useUser();
  const { create, createAddToPlaylistModal } = AppModal.useModal();
  const open = useCallback(
    (tracks: NeteaseTrackRecord[]) => {
      if (!user?.isLoggedIn) {
        return AppToast.show({
          type: "info",
          text: "请先登录"
        });
      }
      if (tracks.length === 0) return;
      create(createAddToPlaylistModal, {
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
