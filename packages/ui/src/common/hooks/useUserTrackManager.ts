import { useUser, useUserStore } from "../store/user";
import { useCallback, useMemo } from "react";
import { HeartManager } from "../hooks/useHeart";
import { TrackListPlayableManager } from "../components/track_list";
import { NeteaseTrack } from "../source/netease/models";

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
