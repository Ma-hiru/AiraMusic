import { useCallback } from "react";
import { API } from "@mahiru/ui/public/api";
import { Playlist } from "@mahiru/ui/public/entry/playlist";
import { useLocalStore, useLocalStoreProxy } from "@mahiru/ui/public/store/local";

export const useHeart = () => {
  const { User } = useLocalStore(["User"]);
  const localStoreProxy = useLocalStoreProxy();

  const isTrackLiked = useCallback(
    (track?: NeteaseTrackBase) => {
      return Boolean(track && User.UserLikedTrackIDs.ids[track.id]);
    },
    [User.UserLikedTrackIDs.ids]
  );

  const likeChange = useCallback(
    (track?: NeteaseTrack) => {
      if (!track || !track.id) return;
      const isLiked = isTrackLiked(track);
      if (isLiked) {
        delete localStoreProxy.User.UserLikedTrackIDs.ids[track.id];
      } else {
        localStoreProxy.User.UserLikedTrackIDs.ids[track.id] = true;
      }
      void API.Track.likeATrack({
        id: track.id,
        like: !isLiked
      });
      void Playlist.updateTrackLikedStatus({
        track,
        nextStatus: !isLiked
      });
    },
    [isTrackLiked, localStoreProxy.User.UserLikedTrackIDs.ids]
  );

  return { isTrackLiked, likeChange };
};
