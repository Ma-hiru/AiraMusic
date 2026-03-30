import { FC, memo } from "react";
import { cx } from "@emotion/css";
import AppInstance from "@mahiru/ui/main/entry/instance";

const LyricChange: FC<object> = () => {
  const player = AppInstance.usePlayer();
  const { rmActive, rmExisted, tlActive, tlExisted } = player.current.lyric?.info || {};

  return (
    <div className="absolute right-8 bottom-10 text-white flex flex-col gap-2 select-none">
      <span
        onClick={() => player.toggleLyric("rm")}
        className={cx(
          `
            size-5 text-[12px] font-semibold
            flex justify-center items-center overflow-hidden rounded-xs
            backdrop-blur-lg
        `,
          rmActive && rmExisted ? "bg-white text-black " : "bg-white/20 ",
          rmExisted ? "cursor-pointer" : "cursor-not-allowed"
        )}>
        音
      </span>
      <span
        onClick={() => player.toggleLyric("tl")}
        className={cx(
          `
            size-5 text-[12px] font-semibold
            flex justify-center items-center overflow-hidden rounded-xs
            backdrop-blur-lg
        `,
          tlActive && tlExisted ? "bg-white text-black " : "bg-white/20 ",
          tlExisted ? "cursor-pointer" : "cursor-not-allowed"
        )}>
        译
      </span>
    </div>
  );
};
export default memo(LyricChange);
