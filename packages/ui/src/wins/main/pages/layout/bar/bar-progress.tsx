import { motion } from "motion/react";
import { memo, type FC } from "react";
import { cx, css } from "@emotion/css";
import { usePlayProgress } from "@/wins/main/hooks/use-play-progress";

const BarProgress: FC<object> = () => {
  const { barRef, bufferScope, percentScope, chorusPercent, handleBarClick, handleBarMouseDown } =
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
        className="absolute left-0 top-0 block h-full bg-primary rounded-r-full"
        initial={{ width: 0 }}
      />
      {/*缓冲区*/}
      <motion.span
        ref={bufferScope}
        className="block h-full bg-(--text-color-on-main)/35 rounded-r-full"
        initial={{ width: 0 }}
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
