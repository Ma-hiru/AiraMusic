import { type FC, memo } from "react";
import { TrackQuality } from "@/common/enum";
import { NeteaseHistory, NeteaseTrackRecord } from "@/common/netease/models";

import Tag from "@/common/components/public/tag";

interface ListItemQualityProps {
  track?: NeteaseHistory | NeteaseTrackRecord;
  themeColor: string;
  bgColor: string;
  forceShow?: Optional<TrackQuality>;
}

const TrackItemQuality: FC<ListItemQualityProps> = ({ track, themeColor, bgColor, forceShow }) => {
  if (forceShow) return <Tag backgroundColor={bgColor} textColor={themeColor} text={forceShow} />;
  if (!track) return null;
  const qualities = track.detail
    .qualities(undefined)
    .filter((q) => q.label === TrackQuality.hr || q.label === TrackQuality.sq);
  const quality = qualities[0];
  if (!quality) return null;
  return (
    <Tag
      key={quality.label}
      backgroundColor={bgColor}
      textColor={themeColor}
      text={quality.label}
    />
  );
};

export default memo(TrackItemQuality);
