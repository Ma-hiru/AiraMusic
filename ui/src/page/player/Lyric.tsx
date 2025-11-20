import { FC, memo, useEffect, useRef } from "react";
import { LyricPlayer, LyricPlayerRef } from "@mahiru/ui/componets/player/LyricPlayer";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { cx } from "@emotion/css";

const Lyric: FC<object> = () => {
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);
  const { lyricLines, audioRef } = usePlayer();
  console.log("lyricLines", lyricLines);
  useEffect(() => {
    if (audioRef.current) {
      let lastTime = -1;
      const onFrame = (time: number) => {
        if (audioRef.current && !audioRef.current.paused) {
          if (lastTime === -1) {
            lastTime = time;
          }
          lyricPlayerRef.current?.lyricPlayer?.update(time - lastTime);
          lastTime = time;
          lyricPlayerRef.current?.lyricPlayer?.setCurrentTime(
            (audioRef.current.currentTime * 1000) | 0
          );
          requestAnimationFrame(onFrame);
        }
      };
      const onPlay = () => onFrame(0);
      audioRef.current.addEventListener("play", onPlay);
      return () => {
        // oxlint-disable-next-line exhaustive-deps
        audioRef.current?.removeEventListener("play", onPlay);
      };
    }
  }, [audioRef]);
  return (
    <div
      className={cx(
        "absolute top-0 left-1/2 w-1/2 h-full overflow-hidden contain-[paint_layout] mix-blend-plus-lighter text-lg transition-normal ease-in-out"
      )}>
      <LyricPlayer
        className="w-full h-full"
        ref={lyricPlayerRef}
        alignAnchor="center"
        lyricLines={lyricLines}
      />
    </div>
  );
};
export default memo(Lyric);
