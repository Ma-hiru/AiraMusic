import { FC, memo } from "react";
import { cx } from "@emotion/css";
import AppInstance from "@mahiru/ui/main/entry/instance";

const LyricChange: FC<object> = () => {
  const player = AppInstance.usePlayer();
  const { hasTl, hasRm, rmActive, tlActive } = player.current.lyric?.versionInfo() || {};
  return (
    <div className="absolute right-8 bottom-10 text-white flex flex-col gap-2 select-none">
      <span
        onClick={() => player.setLyricVersion("rm")}
        className={cx(
          "size-5 text-[12px] font-semibold flex justify-center items-center overflow-hidden rounded-xs backdrop-blur-lg",
          {
            "bg-white text-black ": rmActive && hasRm,
            "bg-white/20 ": !rmActive || !hasRm,
            "cursor-not-allowed": !hasRm,
            "cursor-pointer": hasRm
          }
        )}>
        音
      </span>
      <span
        onClick={() => player.setLyricVersion("tl")}
        className={cx(
          "size-5 text-[12px] font-semibold flex justify-center items-center overflow-hidden rounded-xs backdrop-blur-lg",
          {
            "bg-white text-black ": tlActive && hasTl,
            "bg-white/20": !tlActive || !hasTl,
            "cursor-not-allowed": !hasTl,
            "cursor-pointer": hasTl
          }
        )}>
        译
      </span>
    </div>
  );
};
export default memo(LyricChange);
