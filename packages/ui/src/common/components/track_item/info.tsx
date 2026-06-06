import { type FC, memo } from "react";
import { Heart } from "lucide-react";
import { PlaylistSource, TrackBitmark } from "@/common/enum";
import { NeteaseHistory, NeteaseTrackRecord } from "@/common/netease/models";
import { RendererFormat } from "@/common/lib/format";

import ListItemQuality from "./quality";
import Tag from "@/common/components/public/tag";

interface ListItemAlbumProps {
  track: NeteaseTrackRecord | NeteaseHistory;
  active: boolean;
  disabled: boolean;
  liked: boolean;
  type: PlaylistSource;
  onLikeChange?: NormalFunc;
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
            {RendererFormat.time((track as NeteaseHistory).time)}
          </div>
          <div className="text-[12px] font-medium">
            {RendererFormat.duration((track as NeteaseHistory).playDuration, "s")} /{" "}
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
