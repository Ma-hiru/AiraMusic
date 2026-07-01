import { useMemo, useCallback } from "react";
import { NeteaseTrack } from "@/common/netease/models";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useUser, useUserStore } from "@/common/store/user";

import { type HeartManager } from "./use-heart";
import { type TrackListPlayableManager } from "../components/display/track_list";

/** 基于userStore管理喜欢状态和播放状态 */
export function useUserTrackManager() {
  const user = useUser();
  const updateUser = useUserStore().updateUser;
  // 基于userStore管理喜欢状态
  const heartManager = useMemo<HeartManager>(
    () => ({
      get TrackLikedSource() {
        return user?.likedTrackIDs;
      },
      set TrackLikedSource(likedTrackIDs) {
        updateUser(user?.copyWith({ likedTrackIDs }));
      },
      onLikedSynced() {
        RendererIPCMessageBus.modified.twoWay({
          type: "playlist-update",
          id: null,
          source: "like"
        });
      }
    }),
    [updateUser, user]
  );
  // 基于userStore管理播放状态
  const playableManager = useCallback<TrackListPlayableManager>(
    (track) => NeteaseTrack.playable(track, user),
    [user]
  );
  return {
    heartManager,
    playableManager
  };
}
