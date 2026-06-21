import { type FC, memo } from "react";
import { Heart } from "lucide-react";
import { TrackBitmark } from "@/common/enum";
import { NeteaseHistoryRecord, NeteaseTrackRecord } from "@/common/netease/models";
import { RendererFormat } from "@/common/lib/format";

import ListItemQuality from "./quality";
import Tag from "@/common/components/display/tag";

interface ListItemAlbumProps {
  track: NeteaseTrackRecord | NeteaseHistoryRecord;
  active: boolean;
  disabled: boolean;
  liked: boolean;
  onLikeChange?: NormalFunc;
  type: "album" | "history" | "like" | "normal";
}

const TrackItemInfo: FC<ListItemAlbumProps> = ({ track, disabled, liked, onLikeChange, type }) => {
  const hasExplicit = track.detail.checkBitmark(TrackBitmark.Explicit);
  return (
    <div className="flex gap-4 justify-end items-center">
      {hasExplicit && <Tag text="E" />}
      <ListItemQuality track={track} />
      <Heart
        fill={liked ? "currentColor" : "transparent"}
        className="size-4 relative -top-px cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
        onClick={() => !disabled && onLikeChange?.()}
      />
      {type === "history" ? (
        <>
          <div className="text-[12px] font-medium">
            {RendererFormat.time((track as NeteaseHistoryRecord).time)}
          </div>
          <div className="text-[12px] font-medium">
            {RendererFormat.duration((track as NeteaseHistoryRecord).playDuration, "s")} /{" "}
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
