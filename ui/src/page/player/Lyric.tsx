import { FC, memo, useCallback, useEffect, useRef } from "react";
import { LyricPlayer, LyricPlayerRef } from "@mahiru/ui/componets/player/LyricPlayer";
import { cx } from "@emotion/css";
import { useGPU } from "@mahiru/ui/hook/useGPU";
import { LyricLineMouseEvent } from "@applemusic-like-lyrics/core";
import { NeteaseLyric as LyricUtils } from "@mahiru/ui/utils/lyric";
import { PlayerFSMStatusEnum, usePlayerStore } from "@mahiru/ui/store/player";
import { useLayoutStore } from "@mahiru/ui/store/layout";

const Lyric: FC<object> = () => {
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);
  const { PlayerStatus, PlayerFSMStatus, PlayerTrackStatus, PlayerProgressGetter, AudioRefGetter } =
    usePlayerStore([
      "PlayerTrackStatus",
      "PlayerStatus",
      "PlayerProgressGetter",
      "AudioRefGetter",
      "PlayerFSMStatus"
    ]);
  const { PlayerVisible } = useLayoutStore(["PlayerVisible"]);
  const { hasDedicatedGPU } = useGPU();
  const firstRender = useRef(true);
  const audio = AudioRefGetter();

  const onLyricLineClick = useCallback(
    (e: LyricLineMouseEvent) => {
      const ms = e.line.getLine().startTime || 0;
      const nextTime = ms / 1000;
      const { duration } = PlayerProgressGetter();
      if (audio) {
        audio.currentTime = Math.min(nextTime, duration);
        audio.paused && audio.play();
        lyricPlayerRef.current?.lyricPlayer?.resetScroll();
        lyricPlayerRef.current?.lyricPlayer?.calcLayout();
      }
    },
    [PlayerProgressGetter, audio]
  );

  useEffect(() => {
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
  }, [audio]);

  useEffect(() => {
    if (!firstRender.current) return;
    if (audio && PlayerTrackStatus?.lyric.raw.length && lyricPlayerRef.current?.lyricPlayer) {
      lyricPlayerRef.current?.lyricPlayer?.resetScroll();
      lyricPlayerRef.current?.lyricPlayer?.calcLayout();
      firstRender.current = false;
    }
  }, [PlayerTrackStatus?.lyric.raw.length, audio]);

  useEffect(() => {
    lyricPlayerRef.current?.lyricPlayer?.resetScroll();
    lyricPlayerRef.current?.lyricPlayer?.calcLayout();
  }, [PlayerTrackStatus?.lyric]);
  return (
    <div
      className={cx(
        "absolute top-0 left-[48%] w-1/2 h-full overflow-hidden contain-[paint_layout] mix-blend-plus-lighter text-lg transition-normal ease-in-out"
      )}>
      <LyricPlayer
        disabled
        playing={PlayerFSMStatus === PlayerFSMStatusEnum.playing && PlayerVisible}
        className="w-full h-full"
        ref={lyricPlayerRef}
        alignAnchor="center"
        lyricLines={LyricUtils.chooseLyric(PlayerTrackStatus?.lyric, PlayerStatus.lyricVersion)}
        enableScale={hasDedicatedGPU}
        enableSpring={hasDedicatedGPU}
        onLyricLineClick={onLyricLineClick}
      />
    </div>
  );
};
export default memo(Lyric);
