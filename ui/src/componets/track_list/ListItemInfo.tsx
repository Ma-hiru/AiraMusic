import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { Heart } from "lucide-react";
import { useHeart } from "@mahiru/ui/hook/useHeart";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { Time } from "@mahiru/ui/utils/time";

interface ListItemAlbumProps {
  track: NeteaseTrack;
  active: boolean;
}

const ListItemInfo: FC<ListItemAlbumProps> = ({ track, active }) => {
  const { isLiked, likeChange } = useHeart(track);
  const { mainColor, textColorOnMain } = useThemeColor();
  return (
    <div className="flex gap-4 justify-between items-center">
      <Heart
        color={active ? textColorOnMain.string() : mainColor.string()}
        fill={isLiked ? (active ? textColorOnMain.string() : mainColor.string()) : "transparent"}
        className="size-4 relative -top-[1px] cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
        onClick={(e) => {
          e.stopPropagation();
          likeChange();
        }}
      />
      <div
        className={cx("text-[#7b8290]/80 text-[12px] font-medium select-none", {
          "text-white/90": active
        })}>
        {Time.formatTrackTime(track.dt, "ms")}
      </div>
    </div>
  );
};
export default memo(ListItemInfo);
