import { useCallback, useMemo } from "react";
import { useUserStore } from "@mahiru/ui/public/store/user";
import { NeteaseTrack, NeteaseUser } from "@mahiru/ui/public/source/netease/models";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";

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
      void NeteaseAPI.Track.star({
        id: track.id,
        like: !isLiked
      });
    },
    [isTrackLiked, updateUser, user]
  );

  return { isTrackLiked, likeChange };
};
