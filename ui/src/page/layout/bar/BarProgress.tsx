import { FC, memo } from "react";
import { motion } from "motion/react";
import { css, cx } from "@emotion/css";
import { usePlayProgress } from "@mahiru/ui/hook/usePlayProgress";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { useLayoutStatus } from "@mahiru/ui/store";

const BarProgress: FC<object> = () => {
  const { background } = useLayoutStatus(["background"]);
  const { mainColor, textColorOnMain } = useThemeColor();
  const { barRef, handleBarClick, handleBarMouseDown, bufferScope, percentScope, chorusPercent } =
    usePlayProgress();

  return (
    <div
      ref={barRef}
      className={cx(
        `
          fixed w-screen h-1 bottom-18 overflow-hidden
          shadow-[0_5px_10px_-5px_rgba(0,0,0,0.15)] backdrop-blur-lg
          cursor-pointer ease-in-out transition-all duration-300 hover:h-2
        `,
        background ? "bg-transparent" : "bg-white"
      )}
      onClick={handleBarClick}
      onMouseDown={handleBarMouseDown}>
      {/*播放进度*/}
      <motion.span
        ref={percentScope}
        initial={{ width: 0 }}
        style={{ background: mainColor.hex() }}
        className="absolute left-0 top-0 block h-full"
      />
      {/*缓冲区*/}
      <motion.span
        ref={bufferScope}
        initial={{ width: 0 }}
        className="block h-full bg-gray-500/20"
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
              max-width: 5px;
              aspect-ratio: 1 / 1;
            `}
            style={{ background: textColorOnMain.string() }}
          />
        );
      })}
    </div>
  );
};
export default memo(BarProgress);
