import { FC, memo, useCallback, useEffect, useRef } from "react";
import { LyricPlayer, LyricPlayerRef } from "@mahiru/ui/componets/player/LyricPlayer";
import { cx } from "@emotion/css";
import { useGPU } from "@mahiru/ui/hook/useGPU";
import { LyricLineMouseEvent } from "@applemusic-like-lyrics/core";
import { LyricManager as LyricUtils } from "@mahiru/ui/utils/lyricManager";
import { usePlayerStatus } from "@mahiru/ui/store";

const Lyric: FC<object> = () => {
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);
  const { trackStatus, playerStatus, playerProgress, audioRef, playerModalVisible } =
    usePlayerStatus([
      "trackStatus",
      "playerStatus",
      "playerProgress",
      "audioControl",
      "audioRef",
      "playerModalVisible"
    ]);

  const { hasDedicatedGPU } = useGPU();
  const firstRender = useRef(true);

  const onLyricLineClick = useCallback(
    (e: LyricLineMouseEvent) => {
      const ms = e.line.getLine().startTime || 0;
      const nextTime = ms / 1000;
      const { duration } = playerProgress.current();
      const audio = audioRef.current();
      if (audio) {
        audio.currentTime = Math.min(nextTime, duration);
        audio.paused && audio.play();
        lyricPlayerRef.current?.lyricPlayer?.resetScroll();
        lyricPlayerRef.current?.lyricPlayer?.calcLayout();
      }
    },
    [audioRef, playerProgress]
  );

  useEffect(() => {
    const audio = audioRef.current();
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
          firstRender.current = false;
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
  }, [audioRef]);

  useEffect(() => {
    if (!firstRender.current) return;
    const audio = audioRef.current();
    if (audio && trackStatus?.lyric.raw.length && lyricPlayerRef.current?.lyricPlayer) {
      lyricPlayerRef.current?.lyricPlayer?.resetScroll();
      lyricPlayerRef.current?.lyricPlayer?.calcLayout();
      firstRender.current = false;
    }
  }, [audioRef, trackStatus?.lyric.raw.length]);
  return (
    <div
      className={cx(
        "absolute top-0 left-[48%] w-1/2 h-full overflow-hidden contain-[paint_layout] mix-blend-plus-lighter text-lg transition-normal ease-in-out"
      )}>
      <LyricPlayer
        disabled
        playing={playerStatus.playing && playerModalVisible}
        className="w-full h-full"
        ref={lyricPlayerRef}
        alignAnchor="center"
        lyricLines={LyricUtils.chooseLyric(trackStatus?.lyric, playerStatus.lyricVersion)}
        enableScale={hasDedicatedGPU}
        enableSpring={hasDedicatedGPU}
        onLyricLineClick={onLyricLineClick}
      />
    </div>
  );
};
export default memo(Lyric);
