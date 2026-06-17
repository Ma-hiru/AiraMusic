import { type FC, memo } from "react";
import { motion } from "motion/react";
import { css } from "@emotion/css";
import { usePlayProgress } from "@/wins/main/hooks/use-play-progress";
import { RendererFormat } from "@/common/lib/format";
import { useProgress } from "@/wins/main/hooks/use-progress";
import RendererPlayerHandle from "@/wins/main/lib/handle";

import Tag from "@/common/components/display/tag";

const Progress: FC<object> = () => {
  const { barRef, bufferScope, percentScope, handleBarClick, handleBarMouseDown, chorusPercent } =
    usePlayProgress();
  const { progress } = useProgress();
  const player = RendererPlayerHandle.usePlayer();
  const quality = player.current.audio?.quality;

  return (
    <div className="w-full">
      <div className="h-3 flex flex-col justify-center">
        <div
          ref={barRef}
          onClick={handleBarClick}
          onMouseDown={handleBarMouseDown}
          className="relative h-2 overflow-hidden cursor-pointer ease-in-out transition-all duration-300 rounded-full bg-white/10 backdrop-blur-lg hover:h-3 ">
          <motion.span
            ref={percentScope}
            initial={{ width: 0 }}
            className="absolute left-0 top-0 block h-full bg-white/50 backdrop-blur-lg rounded-full"
          />
          {/*缓冲区*/}
          <motion.span
            ref={bufferScope}
            initial={{ width: 0 }}
            className="block h-full bg-white/30 backdrop-blur-lg rounded-full"
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
      <div className="w-full flex justify-between items-center backdrop-blur-lg text-[12px] mt-1">
        {quality && <Tag text={quality} className="text-(--text-color)! bg-(--text-color)/15!" />}
        {quality ? (
          <div className="flex justify-end items-center">
            <span>{RendererFormat.duration(progress.currentTime, "s")}</span>
            <span className="opacity-50 mx-0.5">/</span>
            <span>{RendererFormat.duration(progress.duration, "s")}</span>
          </div>
        ) : (
          <>
            <span>{RendererFormat.duration(progress.currentTime, "s")}</span>
            <span>{RendererFormat.duration(progress.duration, "s")}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(Progress);
