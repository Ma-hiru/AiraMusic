import { useCallback } from "react";
import { Playlist } from "@mahiru/ui/utils/playlist";
import { API } from "@mahiru/ui/api";
import { useUserStore } from "@mahiru/ui/store/user";

export const useHeart = () => {
  const { UserLikedTrackIDs, UpdateUserLikedTrackIDs } = useUserStore([
    "UserLikedTrackIDs",
    "UpdateUserLikedTrackIDs"
  ]);
  const isTrackLiked = useCallback(
    (track?: NeteaseTrackBase) => {
      return Boolean(track && UserLikedTrackIDs.ids[track.id]);
    },
    [UserLikedTrackIDs.ids]
  );

  const likeChange = useCallback(
    (track?: NeteaseTrack) => {
      if (!track || !track.id) return;
      const newSet = structuredClone(UserLikedTrackIDs.ids);
      const isLiked = isTrackLiked(track);
      if (isLiked) {
        delete newSet[track.id];
      } else {
        newSet[track.id] = true;
      }
      UpdateUserLikedTrackIDs({ ids: newSet, checkPoint: UserLikedTrackIDs.checkPoint });
      void API.Track.likeATrack({
        id: track.id,
        like: !isLiked
      });
      void Playlist.updateTrackLikedStatus({
        track,
        nextStatus: !isLiked
      });
    },
    [UpdateUserLikedTrackIDs, UserLikedTrackIDs.checkPoint, UserLikedTrackIDs.ids, isTrackLiked]
  );

  return { isTrackLiked, likeChange };
};
