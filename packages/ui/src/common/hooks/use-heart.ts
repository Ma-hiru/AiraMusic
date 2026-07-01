import { useRef, useCallback } from "react";
import { NeteaseAPITrack } from "@/common/netease/api";
import { NeteaseTrack, NeteaseTrackRecord } from "@/common/netease/models";

type TrackLikeSource = {
  checkPoint: number;
  ids: Record<number, boolean>;
};

export interface HeartManager {
  get TrackLikedSource(): Optional<TrackLikeSource>;
  set TrackLikedSource(source: Optional<TrackLikeSource>);
  onLikedSynced: NormalFunc;
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

      NeteaseAPITrack.star({
        id: track.id,
        like: !isLiked
      }).finally(() => {
        manager.onLikedSynced();
      });

      return isLiked;
    },
    [checkLiked]
  );

  return {
    checkLiked,
    likedChange
  };
}
