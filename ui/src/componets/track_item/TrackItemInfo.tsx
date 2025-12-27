import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { Heart } from "lucide-react";
import { Time } from "@mahiru/ui/utils/time";
import { Track, TrackBitmark } from "@mahiru/ui/utils/track";
import { ColorInstance } from "color";
import ListItemQuality from "./TrackItemQuality";
import Tag from "@mahiru/ui/componets/public/Tag";

interface ListItemAlbumProps {
  track: NeteaseTrackBase;
  active: boolean;
  disabled: boolean;
  textColorOnMain: ColorInstance;
  mainColor: ColorInstance;
  showHeart?: boolean;
  isLiked?: NormalFunc<[track: NeteaseTrackBase], boolean>;
  likeChange?: NormalFunc<[track: NeteaseTrackBase]>;
}

const TrackItemInfo: FC<ListItemAlbumProps> = ({
  track,
  active,
  textColorOnMain,
  mainColor,
  isLiked,
  likeChange,
  showHeart,
  disabled
}) => {
  const hasExplicit = Track.parseTrackBitmark(track, TrackBitmark.Explicit);
  return (
    <div className="flex gap-4 justify-end items-center">
      {hasExplicit && (
        <Tag backgroundColor={textColorOnMain.string()} textColor={mainColor.string()} text="E" />
      )}
      <ListItemQuality
        bgColor={textColorOnMain.string()}
        themeColor={mainColor.string()}
        track={track}
      />
      {showHeart && (
        <Heart
          color={textColorOnMain.string()}
          fill={isLiked?.(track) ? textColorOnMain.string() : "transparent"}
          className="size-4 relative -top-px cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
          onClick={() => {
            if (disabled) return;
            likeChange?.(track);
          }}
        />
      )}
      <div
        className={cx("text-[#7b8290]/80 text-[12px] font-medium select-none", {
          "text-white/90": active
        })}>
        {Time.formatTrackTime(track.dt, "ms")}
      </div>
    </div>
  );
};
export default memo(TrackItemInfo);
