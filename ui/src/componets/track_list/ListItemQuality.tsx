import { FC, memo } from "react";
import { Track, TrackQuality } from "@mahiru/ui/utils/track";

interface ListItemQualityProps {
  track?: NeteaseTrack;
  themeColor: string;
  bgColor: string;
  forceShow?: Optional<TrackQuality>;
  customText?: string;
}

const ListItemQuality: FC<ListItemQualityProps> = ({
  track,
  themeColor,
  bgColor,
  forceShow,
  customText
}) => {
  if (customText)
    return (
      <div
        className="text-[8px] h-3 text-center align-middle rounded-sm px-1 font-semibold opacity-80"
        style={{
          background: bgColor,
          color: themeColor
        }}>
        {customText}
      </div>
    );
  if (forceShow) {
    return (
      <div
        className="text-[8px] h-3 text-center align-middle rounded-sm px-1 font-semibold opacity-80"
        style={{
          background: bgColor,
          color: themeColor
        }}>
        {Track.mapTrackQualityToText(forceShow)}
      </div>
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
      <div
        key={quality.level}
        className="text-[8px] h-3 text-center align-middle rounded-sm px-1 font-semibold opacity-80"
        style={{
          background: bgColor,
          color: themeColor
        }}>
        {Track.mapTrackQualityToText(quality.level)}
      </div>
    );
  });
};
export default memo(ListItemQuality);
