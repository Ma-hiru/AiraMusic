import { type FC, memo } from "react";
import { TrackQuality } from "@/common/enum";
import { NeteaseHistory, NeteaseTrackRecord } from "@/common/netease/models";

import Tag from "@/common/components/public/tag";

interface ListItemQualityProps {
  track?: NeteaseHistory | NeteaseTrackRecord;
  forceShow?: Optional<TrackQuality>;
}

const TrackItemQuality: FC<ListItemQualityProps> = ({ track, forceShow }) => {
  if (forceShow) return <Tag text={forceShow} />;
  if (!track) return null;
  const qualities = track.detail
    .qualities(undefined)
    .filter((q) => q.label === TrackQuality.hr || q.label === TrackQuality.sq);
  const quality = qualities[0];
  if (!quality) return null;
  return <Tag key={quality.label} text={quality.label} />;
};

export default memo(TrackItemQuality);
