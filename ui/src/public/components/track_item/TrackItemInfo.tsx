import { FC, memo } from "react";
import { css, cx } from "@emotion/css";
import { Heart } from "lucide-react";
import { ColorInstance } from "color";
import { TrackBitmark } from "@mahiru/ui/public/enum";
import { NeteaseHistory, NeteaseTrack, NeteaseTrackRecord } from "@mahiru/ui/public/models/netease";

import ListItemQuality from "./TrackItemQuality";
import Tag from "@mahiru/ui/public/components/public/Tag";
import { PlaylistSource } from "@mahiru/ui/main/constants";

interface ListItemAlbumProps {
  track: NeteaseTrackRecord | NeteaseHistory;
  active: boolean;
  disabled: boolean;
  textColor: ColorInstance;
  mainColor: ColorInstance;
  liked: boolean;
  type: PlaylistSource;
  onLikeChange?: NormalFunc;
}

const TrackItemInfo: FC<ListItemAlbumProps> = ({
  track,
  active,
  disabled,
  textColor,
  mainColor,
  liked,
  onLikeChange,
  type
}) => {
  const hasExplicit = track.track.checkBitmark(TrackBitmark.Explicit);
  return (
    <div className="flex gap-4 justify-end items-center">
      {hasExplicit && (
        <Tag backgroundColor={textColor.string()} textColor={mainColor.string()} text="E" />
      )}
      <ListItemQuality bgColor={textColor.string()} themeColor={mainColor.string()} track={track} />
      <Heart
        color={textColor.string()}
        fill={liked ? textColor.string() : "transparent"}
        className="size-4 relative -top-px cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
        onClick={() => !disabled && onLikeChange?.()}
      />
      {type === "history" ? (
        <>
          <div
            className={cx(
              "text-[12px] font-medium select-none",
              css`
                color: ${active ? textColor.string() : "#7b8290cc"};
              `
            )}>
            {NeteaseTrack.formatDate((track as NeteaseHistory).time)}
          </div>
          <div
            className={cx(
              "text-[12px] font-medium select-none",
              css`
                color: ${active ? textColor.string() : "#7b8290cc"};
              `
            )}>
            {NeteaseTrack.formatTime((track as NeteaseHistory).playDuration, "s")} /{" "}
            {track.track.formatTime()}
          </div>
        </>
      ) : (
        <div
          className={cx(
            "text-[12px] font-medium select-none",
            css`
              color: ${active ? textColor.string() : "#7b8290cc"};
            `
          )}>
          {track.track.formatTime()}
        </div>
      )}
    </div>
  );
};
export default memo(TrackItemInfo);
