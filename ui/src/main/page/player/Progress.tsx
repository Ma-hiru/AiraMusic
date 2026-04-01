import { FC, memo, useMemo } from "react";
import { motion } from "motion/react";
import { css } from "@emotion/css";
import { usePlayProgress } from "@mahiru/ui/main/hooks/usePlayProgress";
import { TrackQuality } from "@mahiru/ui/public/enum";

import ProgressRender from "@mahiru/ui/main/componets/Progress";
import Tag from "@mahiru/ui/public/components/public/Tag";
import AppInstance from "@mahiru/ui/main/entry/instance";
import { NeteaseTrack } from "@mahiru/ui/public/models/netease";
import AppAudio from "@mahiru/ui/public/entry/player/AppAudio";

const Progress: FC<object> = () => {
  const { barRef, bufferScope, percentScope, handleBarClick, handleBarMouseDown, chorusPercent } =
    usePlayProgress();
  const player = AppInstance.usePlayer();
  const quality = useMemo(() => {
    if (
      player.current.audio?.quality === TrackQuality.sq ||
      player.current.audio?.quality === TrackQuality.hr ||
      player.current.audio?.quality === TrackQuality.h
    ) {
      return NeteaseTrack.qualityText(player.current.audio?.quality);
    }
    return null;
  }, [player]);
  return (
    <div className="w-37.5 sm:w-50 md:w-62.5 lg:w-75">
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
        {quality && <Tag text={quality} textColor="#99a1af" backgroundColor="white" />}
        {quality ? (
          <ProgressRender render={progressRenderMini} />
        ) : (
          <ProgressRender render={progressRenderFull} />
        )}
      </div>
    </div>
  );
};
export default memo(Progress);

const progressRenderMini = (progress: InstanceType<typeof AppAudio>["progress"]) => {
  return (
    <div className="flex justify-end items-center gap-2">
      <span>{NeteaseTrack.formatTime(progress.currentTime, "s")}</span>
      <span className="opacity-50">/</span>
      <span>{NeteaseTrack.formatTime(progress.duration, "s")}</span>
    </div>
  );
};

const progressRenderFull = (progress: InstanceType<typeof AppAudio>["progress"]) => {
  return (
    <>
      <span>{NeteaseTrack.formatTime(progress.currentTime, "s")}</span>
      <span>{NeteaseTrack.formatTime(progress.duration, "s")}</span>
    </>
  );
};
