import { FC, memo } from "react";
import { usePlayProgress } from "@mahiru/ui/hook/usePlayProgress";
import { motion } from "motion/react";
import { Time } from "@mahiru/ui/utils/time";

const Progress: FC<object> = () => {
  const { barRef, bufferScope, percentScope, handleBarClick, handleBarMouseDown, progress } =
    usePlayProgress();
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
        <span>{Time.formatTrackTime(progress.currentTime, "s")}</span>
        <span>{Time.formatTrackTime(progress.duration, "s")}</span>
      </div>
    </div>
  );
};
export default memo(Progress);
