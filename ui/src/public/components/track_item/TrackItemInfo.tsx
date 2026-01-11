import { FC, memo } from "react";
import { css, cx } from "@emotion/css";
import { Heart } from "lucide-react";
import { ColorInstance } from "color";
import { TrackBitmark } from "@mahiru/ui/public/enum";
import { Time } from "@mahiru/ui/public/entry/time";
import { NeteaseTrack } from "@mahiru/ui/public/entry/track";

import ListItemQuality from "./TrackItemQuality";
import Tag from "@mahiru/ui/public/components/public/Tag";

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
  const hasExplicit = NeteaseTrack.parseTrackBitmark(track, TrackBitmark.Explicit);
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
      {Number.isFinite(track.playDuration) && Number.isFinite(track.recordTime) ? (
        <>
          <div
            className={cx(
              "text-[12px] font-medium select-none",
              css`
                color: ${active ? textColorOnMain.string() : "#7b8290cc"};
              `
            )}>
            {Time.formatTrackDate(track.recordTime)}
          </div>
          <div
            className={cx(
              "text-[12px] font-medium select-none",
              css`
                color: ${active ? textColorOnMain.string() : "#7b8290cc"};
              `
            )}>
            {Time.formatTrackTime(track.playDuration, "s")} / {Time.formatTrackTime(track.dt, "ms")}
          </div>
        </>
      ) : (
        <div
          className={cx(
            "text-[12px] font-medium select-none",
            css`
              color: ${active ? textColorOnMain.string() : "#7b8290cc"};
            `
          )}>
          {Time.formatTrackTime(track.dt, "ms")}
        </div>
      )}
    </div>
  );
};
export default memo(TrackItemInfo);
