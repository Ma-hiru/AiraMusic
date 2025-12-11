import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { cx } from "@emotion/css";
import { useLyric } from "@mahiru/ui/hook/useLyric";

const LyricChange: FC<object> = () => {
  const { setLyricVersion, playerStatus, trackStatus } = usePlayer();
  const { hasTl, hasRm, setRm, setTl, rmActive, tlActive } = useLyric(
    playerStatus.lyricVersion,
    setLyricVersion,
    trackStatus?.lyric
  );
  return (
    <div className="absolute right-8 bottom-10 text-white flex flex-col gap-2 select-none">
      <span
        onClick={setRm}
        className={cx(
          "size-5 text-[12px] font-semibold flex justify-center items-center overflow-hidden rounded-[2px] backdrop-blur-lg",
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
        onClick={setTl}
        className={cx(
          "size-5 text-[12px] font-semibold flex justify-center items-center overflow-hidden rounded-[2px] backdrop-blur-lg",
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
