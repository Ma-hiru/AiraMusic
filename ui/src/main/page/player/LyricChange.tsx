import { FC, memo } from "react";
import { cx } from "@emotion/css";
import AppInstance from "@mahiru/ui/main/entry/instance";

const LyricChange: FC<object> = () => {
  const player = AppInstance.usePlayer();
  const { hasTl, hasRm, rmActive, tlActive } = player.current.lyric?.versionInfo() || {};

  return (
    <div className="absolute right-8 bottom-10 text-white flex flex-col gap-2 select-none">
      <span
        onClick={() => player.toggleLyricVersion("rm")}
        className={cx(
          `
            size-5 text-[12px] font-semibold
            flex justify-center items-center overflow-hidden rounded-xs
            backdrop-blur-lg
        `,
          rmActive ? "bg-white text-black " : "bg-white/20 ",
          hasRm ? "cursor-pointer" : "cursor-not-allowed"
        )}>
        音
      </span>
      <span
        onClick={() => player.toggleLyricVersion("tl")}
        className={cx(
          `
            size-5 text-[12px] font-semibold
            flex justify-center items-center overflow-hidden rounded-xs
            backdrop-blur-lg
        `,
          tlActive ? "bg-white text-black " : "bg-white/20 ",
          hasTl ? "cursor-pointer" : "cursor-not-allowed"
        )}>
        译
      </span>
    </div>
  );
};
export default memo(LyricChange);
