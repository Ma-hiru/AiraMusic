import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { formatDurationToMMSS } from "@mahiru/ui/utils/time";
import { Heart } from "lucide-react";
import { getDynamicSnapshot, useDynamicZustandShallowStore } from "@mahiru/ui/store";
import { likeATrack } from "@mahiru/ui/api/track";
import { useTextColorOnThemeColor } from "@mahiru/ui/hook/useTextColorOnThemeColor";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

interface ListItemAlbumProps {
  track: NeteaseTrack;
  active: boolean;
}

const ListItemInfo: FC<ListItemAlbumProps> = ({ track, active }) => {
  const { likedTrackIDs, updateLikedTrackIDs, userLikedPlayList } = useDynamicZustandShallowStore([
    "likedTrackIDs",
    "updateLikedTrackIDs",
    "userLikedPlayList"
  ]);
  const isLiked = likedTrackIDs.ids.has(track.id);
  const textColor = useTextColorOnThemeColor();
  const { mainColor } = useThemeColor();
  return (
    <div className="flex gap-4 justify-between items-center">
      <Heart
        color={active ? textColor : mainColor}
        fill={isLiked ? (active ? textColor : mainColor) : "transparent"}
        className="size-4 relative -top-[1px] cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
        onClick={(e) => {
          e.stopPropagation();
          const newSet = new Set(likedTrackIDs.ids);
          if (isLiked) {
            newSet.delete(track.id);
          } else {
            newSet.add(track.id);
          }
          updateLikedTrackIDs(newSet, likedTrackIDs.checkPoint);
          if (userLikedPlayList) {
            const { getPlayListStatic } = getDynamicSnapshot();
            const playlists = getPlayListStatic();
            const likedPlayListCache = playlists.get(userLikedPlayList.id);
            if (likedPlayListCache) {
              const findTrack = likedPlayListCache.playlist.tracks.find((t) => t.id === track.id);
              if (findTrack) {
                findTrack.isLiked = !isLiked;
              }
            }
          }
          void likeATrack({
            id: track.id,
            like: !isLiked
          });
        }}
      />
      <div
        className={cx("text-[#7b8290]/80 text-[12px] font-medium select-none", {
          "text-white/90": active
        })}>
        {formatDurationToMMSS(track.dt)}
      </div>
    </div>
  );
};
export default memo(ListItemInfo);
