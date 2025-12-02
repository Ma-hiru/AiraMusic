import { FC, memo, useCallback, useEffect, useRef } from "react";
import { LyricPlayer, LyricPlayerRef } from "@mahiru/ui/componets/player/LyricPlayer";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { cx } from "@emotion/css";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { useGPU } from "@mahiru/ui/hook/useGPU";
import { LyricLineMouseEvent } from "@applemusic-like-lyrics/core";

const Lyric: FC<object> = () => {
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);
  const { lyricLines, audioRef, info, lyricVersion, isPlaying, getProgress } = usePlayer();
  const { PlayerModalVisible } = useLayout();
  const { hasDedicatedGPU } = useGPU();
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      let lastTime = -1;
      const onFrame = (time: number) => {
        if (audio && !audio.paused) {
          if (lastTime === -1) {
            lastTime = time;
          }
          lyricPlayerRef.current?.lyricPlayer?.update(time - lastTime);
          lastTime = time;
          lyricPlayerRef.current?.lyricPlayer?.setCurrentTime((audio.currentTime * 1000) | 0);
          requestAnimationFrame(onFrame);
        }
      };
      const onPlay = () => onFrame(0);
      const loadstart = () => {
        lyricPlayerRef.current?.lyricPlayer?.setCurrentTime((audio.currentTime * 1000) | 0);
      };
      audio.addEventListener("play", onPlay);
      audio.addEventListener("loadstart", loadstart);
      return () => {
        audio?.removeEventListener("play", onPlay);
        audio?.removeEventListener("loadstart", loadstart);
      };
    }
  }, [audioRef, info.audio]);
  const chooseVersion = () => {
    switch (lyricVersion) {
      case "full":
        return lyricLines.full;
      case "tl":
        return lyricLines.tl;
      case "rm":
        return lyricLines.rm;
      case "raw":
      default:
        return lyricLines.raw;
    }
  };
  const onLyricLineClick = useCallback(
    (e: LyricLineMouseEvent) => {
      const ms = e.line.getLine().startTime || 0;
      const nextTime = ms / 1000;
      const { duration } = getProgress();
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = Math.min(nextTime, duration);
        audio.paused && audio.play();
      }
    },
    [audioRef, getProgress]
  );
  return (
    <div
      className={cx(
        "absolute top-0 left-[48%] w-1/2 h-full overflow-hidden contain-[paint_layout] mix-blend-plus-lighter text-lg transition-normal ease-in-out"
      )}>
      <LyricPlayer
        disabled
        playing={isPlaying && PlayerModalVisible}
        className="w-full h-full"
        ref={lyricPlayerRef}
        alignAnchor="center"
        lyricLines={chooseVersion()}
        enableScale={hasDedicatedGPU}
        enableSpring={hasDedicatedGPU}
        onLyricLineClick={onLyricLineClick}
      />
    </div>
  );
};
export default memo(Lyric);
