import { type FC, memo } from "react";
import { motion } from "motion/react";
import { css, cx } from "@emotion/css";
import { usePlayProgress } from "@/wins/main/hooks/use-play-progress";

const BarProgress: FC<object> = () => {
  const { barRef, handleBarClick, handleBarMouseDown, bufferScope, percentScope, chorusPercent } =
    usePlayProgress();

  return (
    <div
      ref={barRef}
      className={cx(
        `
          absolute w-screen h-1 bottom-(--playbar-height) overflow-hidden contain-strict
          shadow-[0_5px_10px_-5px_rgba(0,0,0,0.15)] backdrop-blur-lg
          cursor-pointer ease-in-out transition-all duration-300 hover:h-2
          bg-transparent
        `
      )}
      onClick={handleBarClick}
      onMouseDown={handleBarMouseDown}>
      {/*播放进度*/}
      <motion.span
        ref={percentScope}
        initial={{ width: 0 }}
        className="absolute left-0 top-0 block h-full bg-primary rounded-r-full"
      />
      {/*缓冲区*/}
      <motion.span
        ref={bufferScope}
        initial={{ width: 0 }}
        className="block h-full bg-(--text-color-on-main)/35 rounded-r-full"
      />
      {chorusPercent.map((percent, index) => {
        return (
          <span
            key={index}
            className={cx(
              "bg-(--text-color-on-main)",
              css`
                position: absolute;
                top: 0;
                left: ${percent}%;
                height: 100%;
                max-width: 4px;
                aspect-ratio: 1 / 1;
              `
            )}
          />
        );
      })}
    </div>
  );
};
export default memo(BarProgress);
