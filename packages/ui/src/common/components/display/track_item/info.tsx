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
  const badgeClassName = "text-[8px] font-bold opacity-90";

  return (
    <div className="flex min-w-max items-center justify-end gap-3 text-[12px] leading-none">
      {hasExplicit && <Tag text="E" className={badgeClassName} />}
      <ListItemQuality track={track} />
      <Heart
        fill={liked ? "currentColor" : "transparent"}
        className="relative -top-px size-4 shrink-0 cursor-pointer transition-opacity duration-300 ease-in-out hover:opacity-60 active:scale-90"
        onClick={(e) => {
          e.stopPropagation();
          (!disabled || liked) && onLikeChange?.();
        }}
      />
      {type === "history" ? (
        <>
          <div className="w-16 text-right font-semibold tabular-nums opacity-75">
            {RendererFormat.time((track as NeteaseHistoryRecord).time)}
          </div>
          <div className="w-24 text-right font-semibold tabular-nums opacity-75">
            {RendererFormat.duration((track as NeteaseHistoryRecord).playDuration, "s")} /{" "}
            {track.detail.formatDuration()}
          </div>
        </>
      ) : (
        <div className="min-w-10 text-right font-semibold tabular-nums opacity-75">
          {track.detail.formatDuration()}
        </div>
      )}
    </div>
  );
};

export default memo(TrackItemInfo);
