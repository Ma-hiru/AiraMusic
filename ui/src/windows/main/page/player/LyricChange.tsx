import { FC, memo } from "react";
import { cx } from "@emotion/css";
import AppEntry from "@mahiru/ui/windows/main/entry";

const LyricChange: FC<object> = () => {
  const player = AppEntry.usePlayer();
  const { rmExisted, tlExisted, noteExisted } = player.current.lyric?.info || {};

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
          player.current.rmActive && rmExisted ? "bg-white text-black " : "bg-white/20 ",
          rmExisted ? "cursor-pointer" : "cursor-not-allowed"
        )}>
        音
      </span>
      <span
        onClick={() => player.toggleLyric("note")}
        className={cx(
          `
            size-5 text-[12px] font-semibold
            flex justify-center items-center overflow-hidden rounded-xs
            backdrop-blur-lg
        `,
          player.current.noteActive && noteExisted ? "bg-white text-black " : "bg-white/20 ",
          noteExisted ? "cursor-pointer" : "cursor-not-allowed"
        )}>
        注
      </span>
      <span
        onClick={() => player.toggleLyric("tl")}
        className={cx(
          `
            size-5 text-[12px] font-semibold
            flex justify-center items-center overflow-hidden rounded-xs
            backdrop-blur-lg
        `,
          player.current.tlActive && tlExisted ? "bg-white text-black " : "bg-white/20 ",
          tlExisted ? "cursor-pointer" : "cursor-not-allowed"
        )}>
        译
      </span>
    </div>
  );
};
export default memo(LyricChange);
