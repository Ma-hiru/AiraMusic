import { useCallback } from "react";
import { getDynamicSnapshot, useDynamicZustandShallowStore } from "@mahiru/ui/store";
import { likeATrack } from "@mahiru/ui/api/track";

export const useHeart = (track: NeteaseTrack) => {
  const { likedTrackIDs, updateLikedTrackIDs, userLikedPlayList } = useDynamicZustandShallowStore([
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
    if (userLikedPlayList) {
      const { getPlayListStatic, staticUpdateTrigger } = getDynamicSnapshot();
      const playlists = getPlayListStatic();
      const likedPlayListCache = playlists.get(userLikedPlayList.id);
      if (likedPlayListCache) {
        const findTrackIndex = likedPlayListCache.playlist.tracks.findIndex(
          (t) => t.id === track.id
        );
        if (isLiked && findTrackIndex !== -1) {
          // 取消喜欢时，在喜欢的音乐列表中找到了该歌曲，需要移除
          likedPlayListCache.playlist.tracks.splice(findTrackIndex, 1);
          staticUpdateTrigger();
        } else if (!isLiked && findTrackIndex === -1) {
          // 新喜欢时，如果在喜欢的音乐列表中找不到该歌曲，需要添加进去
          likedPlayListCache.playlist.tracks.unshift(track);
          staticUpdateTrigger();
        }
      }
    }
    void likeATrack({
      id: track.id,
      like: !isLiked
    });
  }, [
    isLiked,
    likedTrackIDs.checkPoint,
    likedTrackIDs.ids,
    track,
    updateLikedTrackIDs,
    userLikedPlayList
  ]);
  return { isLiked, likeChange };
};
