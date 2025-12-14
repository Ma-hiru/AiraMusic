import { FC, memo } from "react";
import { usePlayProgress } from "@mahiru/ui/hook/usePlayProgress";
import { motion } from "motion/react";
import { Time } from "@mahiru/ui/utils/time";
import { Heart, MessageSquareText } from "lucide-react";
import { useHeart } from "@mahiru/ui/hook/useHeart";
import { usePlayerStatus } from "@mahiru/ui/store";
import { Track, TrackQuality } from "@mahiru/ui/utils/track";
import { useInfoWindow } from "@mahiru/ui/hook/useInfoWindow";
import { CommentType } from "@mahiru/ui/api/comment";

const Progress: FC<object> = () => {
  const { barRef, bufferScope, percentScope, handleBarClick, handleBarMouseDown, progress } =
    usePlayProgress();
  const { openInfoWindow } = useInfoWindow();
  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  const track = trackStatus?.track;
  const { likeChange, isLiked } = useHeart(track);
  const quality = () => {
    if (
      trackStatus?.quality?.level === TrackQuality.sq ||
      trackStatus?.quality?.level === TrackQuality.hr
    ) {
      return Track.mapTrackQualityToText(trackStatus.quality.level);
    }
    return null;
  };
  return (
    <div className="w-[150px] sm:w-[200px] md:w-[250px] lg:w-[300px]">
      <div className="h-3 flex flex-col justify-center">
        <div
          ref={barRef}
          onClick={handleBarClick}
          onMouseDown={handleBarMouseDown}
          className="relative h-2 overflow-hidden cursor-pointer ease-in-out transition-all duration-300 rounded-full bg-white/10 backdrop-blur-lg hover:h-3 ">
          <motion.span
            ref={percentScope}
            initial={{ width: 0 }}
            className="absolute left-0 top-0 block h-full bg-white/50 backdrop-blur-lg"
          />
          {/*缓冲区*/}
          <motion.span
            ref={bufferScope}
            initial={{ width: 0 }}
            className="block h-full bg-white/30 backdrop-blur-lg"
          />
        </div>
      </div>
      <div className="w-full flex justify-between items-center text-white/50 backdrop-blur-lg text-[12px] mt-1 select-none">
        <div className="flex justify-start items-center gap-2">
          <Heart
            color={isLiked ? "white" : undefined}
            fill={isLiked ? "white" : "transparent"}
            className="size-4 text-white/50  hover:opacity-50 active:scale-90 cursor-pointer select-none shadow-lg ease-in-out duration-300 transition-all opacity-80"
            onClick={likeChange}
          />
          <MessageSquareText
            onClick={() => {
              track?.id &&
                openInfoWindow("comments", {
                  id: track.id,
                  type: CommentType.Song
                });
            }}
            className="size-4 text-white/50  hover:opacity-50 active:scale-90 active:text-white cursor-pointer select-none shadow-lg ease-in-out duration-300 transition-all opacity-80"
          />
          {quality() && (
            <span className="px-1.5 py-0.5 text-[10px] border border-white/30 rounded-md select-none">
              {quality()}
            </span>
          )}
        </div>
        <div className="flex justify-end items-center gap-2">
          <span>{Time.formatTrackTime(progress.currentTime, "s")}</span>
          <span className="opacity-50">/</span>
          <span>{Time.formatTrackTime(progress.duration, "s")}</span>
        </div>
      </div>
    </div>
  );
};
export default memo(Progress);
