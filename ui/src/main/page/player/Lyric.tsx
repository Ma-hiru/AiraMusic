import { FC, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { useDevice } from "@mahiru/ui/public/hooks/useDevice";
import { NeteaseLyric } from "@mahiru/ui/public/entry/lyric";
import { LyricLineMouseEvent } from "@applemusic-like-lyrics/core";
import { clamp } from "lodash-es";

import LyricPlayer, { LyricPlayerRef } from "@mahiru/ui/public/components/player/LyricPlayer";

const Lyric: FC<object> = () => {
  const {
    PlayerStatus,
    PlayerTrackStatus,
    PlayerProgressGetter,
    PlayerInitialized,
    PlayerCoreGetter
  } = usePlayerStore([
    "PlayerTrackStatus",
    "PlayerStatus",
    "PlayerProgressGetter",
    "PlayerInitialized",
    "PlayerCoreGetter"
  ]);
  const { gpu } = useDevice();
  const player = PlayerCoreGetter();
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);

  const lines = useMemo(
    () => NeteaseLyric.chooseLyric(PlayerTrackStatus?.lyric, PlayerStatus.lyricVersion, true),
    [PlayerStatus.lyricVersion, PlayerTrackStatus?.lyric]
  );

  const onLyricLineClick = useCallback(
    (e: LyricLineMouseEvent) => {
      const clickTimeMs = e.line.getLine().startTime;
      const duration = PlayerProgressGetter().duration;
      if (Number.isFinite(clickTimeMs) && Number.isFinite(duration)) {
        player.currentTime = clamp(clickTimeMs / 1000, 0, duration);
        lyricPlayerRef.current?.lyricPlayer?.resetScroll();
        lyricPlayerRef.current?.lyricPlayer?.calcLayout();
      }
    },
    [PlayerProgressGetter, player]
  );

  useEffect(() => {
    let lastTime = -1;
    let rafId: Nullable<number> = null;
    let isRunning = false;

    const onFrame = (time: number) => {
      if (!isRunning || player.paused) {
        rafId = null;
        return;
      }
      // 如果lastTime === -1 说明是第一次记录时间
      if (lastTime === -1) lastTime = time;
      lyricPlayerRef.current?.lyricPlayer?.update(time - lastTime);
      lyricPlayerRef.current?.lyricPlayer?.setCurrentTime(player.currentTime * 1000);

      lastTime = time;
      rafId = requestAnimationFrame(onFrame);
    };
    const startLoop = () => {
      if (isRunning) return;
      isRunning = true;
      lastTime = -1;
      rafId = requestAnimationFrame(onFrame);
    };
    const stopLoop = () => {
      isRunning = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
    const loadstart = () => {
      lyricPlayerRef.current?.lyricPlayer?.setCurrentTime(player.currentTime * 1000);
      lyricPlayerRef.current?.lyricPlayer?.resetScroll();
      lyricPlayerRef.current?.lyricPlayer?.calcLayout();
    };

    player.addEventListener("play", startLoop, { passive: true });
    player.addEventListener("pause", stopLoop, { passive: true });
    player.addEventListener("loadstart", loadstart, { passive: true });
    return () => {
      stopLoop();
      player.removeEventListener("play", startLoop);
      player.removeEventListener("pause", stopLoop);
      player.removeEventListener("loadstart", loadstart);
    };
  }, [player]);

  useLayoutEffect(() => {
    if (PlayerInitialized) {
      lyricPlayerRef.current?.lyricPlayer?.setCurrentTime(player.currentTime * 1000);
      lyricPlayerRef.current?.lyricPlayer?.resetScroll();
      lyricPlayerRef.current?.lyricPlayer?.calcLayout();
    }
  }, [PlayerInitialized, player]);

  return (
    <div className="absolute top-0 left-[48%] w-1/2 h-full overflow-hidden mix-blend-plus-lighter text-lg transition-normal ease-in-out">
      <LyricPlayer
        disabled
        className="w-full h-full"
        ref={lyricPlayerRef}
        alignPosition={0.5}
        alignAnchor="center"
        lyricLines={lines}
        enableScale={gpu.dedicated}
        enableSpring={gpu.dedicated}
        onLyricLineClick={onLyricLineClick}
      />
    </div>
  );
};
export default memo(Lyric);
