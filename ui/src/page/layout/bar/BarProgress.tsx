import { FC, memo } from "react";
import { motion } from "motion/react";
import { cx } from "@emotion/css";
import { usePlayProgress } from "@mahiru/ui/hook/usePlayProgress";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

const BarProgress: FC<object> = () => {
  const { barRef, handleBarClick, handleBarMouseDown, bufferScope, percentScope, isPlaying } =
    usePlayProgress();
  const { background } = useLayout();
  return (
    <div
      ref={barRef}
      className={cx(
        "fixed w-screen backdrop-blur-lg bottom-18 shadow-[0_5px_10px_-5px_rgba(0,0,0,0.15)] h-1 overflow-hidden cursor-pointer ease-in-out transition-all duration-300",
        background ? "bg-transparent" : "bg-white",
        {
          "hover:h-2": isPlaying
        }
      )}
      onClick={handleBarClick}
      onMouseDown={handleBarMouseDown}>
      {/*播放进度*/}
      <motion.span
        ref={percentScope}
        initial={{ width: 0 }}
        className="absolute left-0 top-0 block h-full bg-[#fc3d49]"
      />
      {/*缓冲区*/}
      <motion.span
        ref={bufferScope}
        initial={{ width: 0 }}
        className="block h-full bg-gray-500/20"
      />
    </div>
  );
};
export default memo(BarProgress);
