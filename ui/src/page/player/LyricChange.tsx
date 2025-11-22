import { FC, memo, useCallback } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { cx } from "@emotion/css";

const LyricChange: FC<object> = () => {
  const { lyricVersion, setLyricVersion, lyricLines } = usePlayer();
  const hasRm = lyricLines.rm.length > 0;
  const hasTl = lyricLines.tl.length > 0;
  const rmActive = lyricVersion === "rm" || lyricVersion === "full";
  const tlActive = lyricVersion === "tl" || lyricVersion === "full";
  const setRm = useCallback(() => {
    switch (lyricVersion) {
      case "full":
        setLyricVersion("tl");
        break;
      case "rm":
        setLyricVersion("raw");
        break;
      case "raw":
        setLyricVersion("rm");
        break;
      case "tl":
        setLyricVersion("full");
        break;
    }
  }, [lyricVersion, setLyricVersion]);
  const setTl = useCallback(() => {
    switch (lyricVersion) {
      case "full":
        setLyricVersion("rm");
        break;
      case "tl":
        setLyricVersion("raw");
        break;
      case "raw":
        setLyricVersion("tl");
        break;
      case "rm":
        setLyricVersion("full");
        break;
    }
  }, [lyricVersion, setLyricVersion]);
  return (
    <div className="absolute right-8 bottom-10 text-white flex flex-col gap-2">
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
