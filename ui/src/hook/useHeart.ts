import { useCallback } from "react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { likeATrack } from "@mahiru/ui/api/track";
import { PlaylistManager } from "@mahiru/ui/utils/playlist";

export const useHeart = (track?: NeteaseTrack) => {
  const { updateUserLikedTrackIDs, userLikedTrackIDs } = usePersistZustandShallowStore([
    "userLikedTrackIDs",
    "updateUserLikedTrackIDs"
  ]);
  const isLiked = !!track && userLikedTrackIDs.ids[track.id];
  const likeChange = useCallback(() => {
    if (!track || !track.id) return;
    const newSet = structuredClone(userLikedTrackIDs.ids);
    if (isLiked) {
       delete newSet[track.id];
    } else {
      newSet[track.id] = true;
    }
    updateUserLikedTrackIDs({ ids: newSet, checkPoint: userLikedTrackIDs.checkPoint });
    void likeATrack({
      id: track.id,
      like: !isLiked
    });
    void PlaylistManager.updateTrackLikedStatus({
      track,
      nextStatus: !isLiked
    });
  }, [
    isLiked,
    track,
    updateUserLikedTrackIDs,
    userLikedTrackIDs.checkPoint,
    userLikedTrackIDs.ids
  ]);
  return { isLiked, likeChange };
};
