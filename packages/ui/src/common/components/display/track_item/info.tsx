import { Heart } from "lucide-react";
import { memo, type FC } from "react";
import { TrackBitmark } from "@/common/enum";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseTrackRecord, NeteaseHistoryRecord } from "@/common/netease/models";
import Tag from "@/common/components/display/tag";

import ListItemQuality from "./quality";

interface ListItemAlbumProps {
  liked: boolean;
  active: boolean;
  disabled: boolean;
  type: "like" | "album" | "normal" | "history";
  track: NeteaseTrackRecord | NeteaseHistoryRecord;
  onLikeChange?: NormalFunc;
}

const TrackItemInfo: FC<ListItemAlbumProps> = ({ onLikeChange, type, liked, track, disabled }) => {
  const hasExplicit = track.detail.checkBitmark(TrackBitmark.Explicit);
  const badgeClassName = "text-[8px] font-bold opacity-90";

  return (
    <div className="flex min-w-max items-center justify-end gap-3 text-[12px] leading-none">
      {hasExplicit && <Tag className={badgeClassName} text="E" />}
      <ListItemQuality track={track} />
      <Heart
        className="relative -top-px size-4 shrink-0 cursor-pointer transition-opacity duration-300 ease-in-out hover:opacity-60 active:scale-90"
        fill={liked ? "currentColor" : "transparent"}
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
