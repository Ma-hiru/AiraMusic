import { FC, memo } from "react";
import { Track, TrackQuality } from "@mahiru/ui/utils/track";
import Tag from "@mahiru/ui/componets/public/Tag";

interface ListItemQualityProps {
  track?: NeteaseTrack;
  themeColor: string;
  bgColor: string;
  forceShow?: Optional<TrackQuality>;
}

const TrackItemQuality: FC<ListItemQualityProps> = ({ track, themeColor, bgColor, forceShow }) => {
  if (forceShow) {
    return (
      <Tag
        backgroundColor={bgColor}
        textColor={themeColor}
        text={Track.mapTrackQualityToText(forceShow)}
      />
    );
  }
  if (!track) return null;
  const qualities = Track.getTrackSourceQuality(track, undefined);
  return qualities.map((quality) => {
    // 小于SQ不显示
    if (quality.level < TrackQuality.sq) return null;
    const hasSQ = qualities.find((q) => q.level === TrackQuality.sq);
    const hasHiRes = qualities.find((q) => q.level === TrackQuality.hr);
    // 有HiRes时不显示SQ
    if (quality.level === TrackQuality.sq && hasSQ && hasHiRes) return null;
    return (
      <Tag
        key={quality.level}
        backgroundColor={bgColor}
        textColor={themeColor}
        text={Track.mapTrackQualityToText(quality.level)}
      />
    );
  });
};
export default memo(TrackItemQuality);
