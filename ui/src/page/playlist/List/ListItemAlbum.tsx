import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { formatDurationToMMSS } from "@mahiru/ui/utils/time";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { Heart } from "lucide-react";
import { getLikedSongsSearcher } from "@mahiru/ui/utils/song";

interface ListItemAlbumProps {
  track: NeteaseTrack;
  active: boolean;
}

const ListItemAlbum: FC<ListItemAlbumProps> = ({ track, active }) => {
  const likedSearcher = getLikedSongsSearcher();
  return (
    <div className="flex gap-4 justify-between items-center h-full">
      {likedSearcher?.isLiked(track.id) && (
        <Heart
          className={cx("size-4 relative -top-[1px]", {
            "text-[#fc3d49]": !active,
            "text-white": active
          })}
          fill={active ? "#ffffff" : "#fc3d49"}
        />
      )}
      <div
        className={cx("text-[#7b8290]/80 text-[12px] font-medium select-none", {
          "text-white/90": active
        })}>
        {formatDurationToMMSS(track.dt)}
      </div>
    </div>
  );
};
export default memo(ListItemAlbum);
