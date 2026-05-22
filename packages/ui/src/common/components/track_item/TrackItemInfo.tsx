import { type FC, memo } from "react";
import { Heart } from "lucide-react";
import { type ColorInstance } from "color";
import { PlaylistSource, TrackBitmark } from "../../enum";
import { NeteaseHistory, NeteaseTrackRecord } from "../../source/netease/models";
import { FormatNumber } from "../../lib/format";

import ListItemQuality from "./TrackItemQuality";
import Tag from "../../components/public/Tag";

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
  const hasExplicit = track.detail.checkBitmark(TrackBitmark.Explicit);
  return (
    <div className="flex gap-4 justify-end items-center">
      {hasExplicit && (
        <Tag backgroundColor={textColor.string()} textColor={mainColor.string()} text="E" />
      )}
      <ListItemQuality bgColor={textColor.string()} themeColor={mainColor.string()} track={track} />
      <Heart
        fill={liked ? textColor.string() : "transparent"}
        className="size-4 relative -top-px cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
        onClick={() => !disabled && onLikeChange?.()}
      />
      {type === "history" ? (
        <>
          <div className="text-[12px] font-medium">
            {FormatNumber.time((track as NeteaseHistory).time)}
          </div>
          <div className="text-[12px] font-medium">
            {FormatNumber.duration((track as NeteaseHistory).playDuration, "s")} /{" "}
            {track.detail.formatDuration()}
          </div>
        </>
      ) : (
        <div className="text-[12px] font-medium">{track.detail.formatDuration()}</div>
      )}
    </div>
  );
};

export default memo(TrackItemInfo);
