import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { useLyric } from "@mahiru/ui/public/hooks/useLyric";

const LyricChange: FC<object> = () => {
  const { PlayerTrackStatus, SetLyricVersion, PlayerStatus } = usePlayerStore([
    "PlayerTrackStatus",
    "SetLyricVersion",
    "PlayerStatus"
  ]);

  const { hasTl, hasRm, setRm, setTl, rmActive, tlActive } = useLyric(
    PlayerStatus.lyricVersion,
    SetLyricVersion,
    PlayerTrackStatus?.lyric
  );
  return (
    <div className="absolute right-8 bottom-10 text-white flex flex-col gap-2 select-none">
      <span
        onClick={setRm}
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
        onClick={setTl}
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
