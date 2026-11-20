import { motion } from "motion/react";
import { cx, css } from "@emotion/css";
import { memo, type FC, type RefObject, useImperativeHandle } from "react";
import { useProgressMotionSync } from "@/common/hooks/use-progress-motion-sync";
import type { PlayerProgressRef } from "@/common/hooks/use-progress-sync";

export type NormalPlayerProgressRef = PlayerProgressRef;

interface NormalPlayerProgressProps {
  ref?: RefObject<Nullable<NormalPlayerProgressRef>>;
  bufferClassName?: string;
  chorusClassName?: string;
  percentClassName?: string;
  containerClassName?: string;
  track: Optional<NeteaseTrackModel>;
  onUpdate: NormalFunc<[percent: number]>;
}

const NormalPlayerProgress: FC<NormalPlayerProgressProps> = ({
  ref,
  onUpdate,
  track,
  bufferClassName,
  chorusClassName,
  percentClassName,
  containerClassName
}) => {
  const { tick, barRef, chorus, handlers, bufferScope, percentScope } = useProgressMotionSync({
    onUpdate,
    track
  });
  useImperativeHandle(ref, () => ({ tick }), [tick]);
  return (
    <div
      ref={barRef}
      className={cx(
        `
        relative h-2 overflow-hidden cursor-pointer
        ease-in-out transition-all duration-300
        rounded-full bg-white/10 backdrop-blur-lg hover:h-3`,
        containerClassName
      )}
      tabIndex={0}
      role="slider"
      aria-label="播放进度"
      aria-valuemin={0}
      aria-valuenow={0}
      aria-valuemax={100}
      {...handlers}>
      <motion.span
        ref={percentScope}
        className={cx(
          `
          absolute left-0 top-0 block h-full
          bg-white/50 backdrop-blur-lg rounded-full`,
          percentClassName
        )}
        initial={{ width: 0 }}
      />
      {/*缓冲区*/}
      <motion.span
        ref={bufferScope}
        className={cx(
          `
          block h-full bg-white/30 backdrop-blur-lg rounded-full`,
          bufferClassName
        )}
        initial={{ width: 0 }}
      />
      {chorus?.map((percent, index) => {
        return (
          <span
            key={index}
            className={cx(
              "absolute h-full top-0 bg-white w-[3px]",
              css`
                left: ${percent}%;
              `,
              chorusClassName
            )}
          />
        );
      })}
    </div>
  );
};

export default memo(NormalPlayerProgress);
