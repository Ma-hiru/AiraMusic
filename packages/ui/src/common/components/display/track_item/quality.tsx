import { type FC, memo } from "react";
import { TrackQuality } from "@/common/enum";
import { NeteaseHistoryRecord, NeteaseTrackRecord } from "@/common/netease/models";

import Tag from "@/common/components/display/tag";

interface ListItemQualityProps {
  track?: NeteaseHistoryRecord | NeteaseTrackRecord;
  forceShow?: Optional<TrackQuality>;
}

const TrackItemQuality: FC<ListItemQualityProps> = ({ track, forceShow }) => {
  const className = "text-[8px] leading-normal font-bold opacity-90";
  if (forceShow) return <Tag text={forceShow} className={className} />;
  if (!track) return null;

  const qualities = track.detail
    .qualities(undefined)
    .filter((q) => q.label === TrackQuality.hr || q.label === TrackQuality.sq);
  const quality = qualities[0];
  if (!quality) return null;

  return <Tag key={quality.label} text={quality.label} className={className} />;
};

export default memo(TrackItemQuality);
