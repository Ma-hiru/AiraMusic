import { useCallback } from "react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { likeATrack } from "@mahiru/ui/api/track";
import { PlaylistManager } from "@mahiru/ui/utils/playlist";

export const useHeart = (track?: NeteaseTrack) => {
  const { updateUserLikedTrackIDs, userLikedTrackIDs } = usePersistZustandShallowStore([
    "userLikedTrackIDs",
    "updateUserLikedTrackIDs"
  ]);
  const isLiked = !!track && userLikedTrackIDs.ids.has(track.id);
  const likeChange = useCallback(() => {
    if (!track || !track.id) return;
    const newSet = new Set(userLikedTrackIDs.ids);
    if (isLiked) {
      newSet.delete(track.id);
    } else {
      newSet.add(track.id);
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
