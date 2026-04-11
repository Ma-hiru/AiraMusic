import { useCallback, useMemo } from "react";
import { useUserStore } from "@mahiru/ui/public/store/user";
import { NeteaseTrack, NeteaseUser } from "@mahiru/ui/public/models/netease";
import NCM_API from "@mahiru/ui/public/api";

export const useHeart = () => {
  const { _user, updateUser } = useUserStore();
  const user = useMemo(() => NeteaseUser.fromObject(_user), [_user]);

  const isTrackLiked = useCallback(
    (track?: NeteaseTrack) => {
      return Boolean(track && user?.likedTrackIDs.ids[track.id]);
    },
    [user?.likedTrackIDs.ids]
  );

  const likeChange = useCallback(
    (track?: NeteaseTrack) => {
      if (!track || !user) return;
      const isLiked = isTrackLiked(track);
      updateUser(
        user.copyWith({
          likedTrackIDs: {
            ids: {
              ...user.likedTrackIDs.ids,
              [track.id]: !isLiked
            },
            checkPoint: Date.now()
          }
        })
      );
      void NCM_API.Track.star({
        id: track.id,
        like: !isLiked
      });
    },
    [isTrackLiked, updateUser, user]
  );

  return { isTrackLiked, likeChange };
};
