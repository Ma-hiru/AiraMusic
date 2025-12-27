import { useCallback } from "react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { PlaylistManager } from "@mahiru/ui/utils/playlist";
import { API } from "@mahiru/ui/api";

export const useHeart = () => {
  const { updateUserLikedTrackIDs, userLikedTrackIDs } = usePersistZustandShallowStore([
    "userLikedTrackIDs",
    "updateUserLikedTrackIDs"
  ]);

  const isTrackLiked = useCallback(
    (track?: NeteaseTrackBase) => {
      return Boolean(track && userLikedTrackIDs.ids[track.id]);
    },
    [userLikedTrackIDs.ids]
  );

  const likeChange = useCallback(
    (track?: NeteaseTrack) => {
      if (!track || !track.id) return;
      const newSet = structuredClone(userLikedTrackIDs.ids);
      const isLiked = isTrackLiked(track);
      if (isLiked) {
        delete newSet[track.id];
      } else {
        newSet[track.id] = true;
      }
      updateUserLikedTrackIDs({ ids: newSet, checkPoint: userLikedTrackIDs.checkPoint });
      void API.Track.likeATrack({
        id: track.id,
        like: !isLiked
      });
      void PlaylistManager.updateTrackLikedStatus({
        track,
        nextStatus: !isLiked
      });
    },
    [isTrackLiked, updateUserLikedTrackIDs, userLikedTrackIDs.checkPoint, userLikedTrackIDs.ids]
  );

  return { isTrackLiked, likeChange };
};
