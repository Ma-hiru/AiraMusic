import { memo, type FC } from "react";
import { TrackQuality } from "@/common/enum";
import { NeteaseTrackRecord, NeteaseHistoryRecord } from "@/common/netease/models";
import Tag from "@/common/components/display/tag";

interface ListItemQualityProps {
  forceShow?: Optional<TrackQuality>;
  track?: NeteaseTrackRecord | NeteaseHistoryRecord;
}

const TrackItemQuality: FC<ListItemQualityProps> = ({ track, forceShow }) => {
  const className = "text-[8px] leading-normal font-bold opacity-90";
  if (forceShow) return <Tag className={className} text={forceShow} />;
  if (!track) return null;

  const qualities = track.detail
    .qualities(undefined)
    .filter((q) => q.label === TrackQuality.hr || q.label === TrackQuality.sq);
  const quality = qualities[0];
  if (!quality) return null;

  return <Tag key={quality.label} className={className} text={quality.label} />;
};

export default memo(TrackItemQuality);
