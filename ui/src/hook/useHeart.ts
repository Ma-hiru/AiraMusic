import { useCallback } from "react";
import { getDynamicSnapshot, useDynamicZustandShallowStore } from "@mahiru/ui/store";
import { likeATrack } from "@mahiru/ui/api/track";
import { updatePlaylistEntryTrackLikedStatus } from "@mahiru/ui/utils/playList";

export const useHeart = (track: NeteaseTrack) => {
  const { likedTrackIDs, updateLikedTrackIDs } = useDynamicZustandShallowStore([
    "likedTrackIDs",
    "updateLikedTrackIDs",
    "userLikedPlayList"
  ]);
  const isLiked = likedTrackIDs.ids.has(track.id);
  const likeChange = useCallback(() => {
    if (!track.id) return;
    const newSet = new Set(likedTrackIDs.ids);
    if (isLiked) {
      newSet.delete(track.id);
    } else {
      newSet.add(track.id);
    }
    updateLikedTrackIDs(newSet, likedTrackIDs.checkPoint);

    void likeATrack({
      id: track.id,
      like: !isLiked
    });

    const { staticUpdateTrigger } = getDynamicSnapshot();
    updatePlaylistEntryTrackLikedStatus({
      track,
      nextStatus: !isLiked
    }).finally(staticUpdateTrigger);
  }, [isLiked, likedTrackIDs.checkPoint, likedTrackIDs.ids, track, updateLikedTrackIDs]);
  return { isLiked, likeChange };
};
