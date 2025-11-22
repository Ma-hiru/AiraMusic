import { FC, useCallback } from "react";
import "@applemusic-like-lyrics/core/style.css";
import Cover from "@mahiru/ui/page/player/Cover";
import Control from "@mahiru/ui/page/player/Control";
import Background from "@mahiru/ui/page/player/Background";
import Lyric from "@mahiru/ui/page/player/Lyric";
import { cx } from "@emotion/css";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

export const PlayerPage: FC = () => {
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
    <div className="w-screen h-screen relative">
      <div className="absolute w-1/2 h-screen flex items-center justify-center z-10 flex-col gap-8">
        <Cover />
        <Control />
      </div>
      <Background />
      <Lyric />
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
    </div>
  );
};
export default PlayerPage;
