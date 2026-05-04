import { useCallback, useRef } from "react";
import { NeteaseTrack, NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";

type TrackLikeSource = {
  ids: Record<number, boolean>;
  checkPoint: number;
};

export interface HeartManager {
  get TrackLikedSource(): Optional<TrackLikeSource>;
  set TrackLikedSource(source: Optional<TrackLikeSource>);
}

export function useHeart(manager: Optional<HeartManager>) {
  const managerRef = useRef(manager);
  managerRef.current = manager;

  const checkLiked = useCallback((track?: NeteaseTrack) => {
    if (!track) return false;
    const manager = managerRef.current;
    if (!manager) return false;
    const source = manager.TrackLikedSource;
    if (!source) return false;
    return Boolean(source.ids[track.id]);
  }, []);

  const likedChange = useCallback(
    (track?: NeteaseTrack | NeteaseTrackRecord) => {
      if (!track) return;
      const manager = managerRef.current;
      if (!manager) return;
      const source = manager.TrackLikedSource;
      if (!source) return;

      const isLiked = checkLiked("detail" in track ? track.detail : track);
      manager.TrackLikedSource = {
        ids: {
          ...source.ids,
          [track.id]: !isLiked
        },
        checkPoint: Date.now()
      };
      void NeteaseAPI.Track.star({
        id: track.id,
        like: !isLiked
      });
    },
    [checkLiked]
  );

  return {
    checkLiked,
    likedChange
  };
}
