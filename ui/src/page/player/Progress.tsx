import { FC, memo } from "react";
import { usePlayProgress } from "@mahiru/ui/hook/usePlayProgress";
import { motion } from "motion/react";
import { Time } from "@mahiru/ui/utils/time";
import { usePlayerStatus } from "@mahiru/ui/store";
import { Track, TrackQuality } from "@mahiru/ui/utils/track";
import { css } from "@emotion/css";
import Tag from "@mahiru/ui/componets/public/Tag";

const Progress: FC<object> = () => {
  const {
    barRef,
    bufferScope,
    percentScope,
    handleBarClick,
    handleBarMouseDown,
    progress,
    chorusPercent
  } = usePlayProgress();

  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  const quality = () => {
    if (
      trackStatus?.quality?.level === TrackQuality.sq ||
      trackStatus?.quality?.level === TrackQuality.hr ||
      trackStatus?.quality?.level === TrackQuality.h
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
          {chorusPercent.map((percent, index) => {
            return (
              <span
                key={index}
                className={css`
                  position: absolute;
                  top: 0;
                  left: ${percent}%;
                  height: 100%;
                  width: 3px;
                `}
                style={{ background: "white" }}
              />
            );
          })}
        </div>
      </div>
      <div className="w-full flex justify-between items-center text-white/50 backdrop-blur-lg text-[12px] mt-1 select-none">
        <Tag text={quality()} textColor="#99a1af" backgroundColor="white" />
        {quality() ? (
          <div className="flex justify-end items-center gap-2">
            <span>{Time.formatTrackTime(progress.currentTime, "s")}</span>
            <span className="opacity-50">/</span>
            <span>{Time.formatTrackTime(progress.duration, "s")}</span>
          </div>
        ) : (
          <>
            <span>{Time.formatTrackTime(progress.currentTime, "s")}</span>
            <span>{Time.formatTrackTime(progress.duration, "s")}</span>
          </>
        )}
      </div>
    </div>
  );
};
export default memo(Progress);
