import { useUser, useUserStore } from "@/common/store/user";
import { useCallback, useMemo } from "react";
import { type HeartManager } from "./use-heart";
import { type TrackListPlayableManager } from "@/common/components/track_list";
import { NeteaseTrack } from "@/common/source/netease/models";

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
