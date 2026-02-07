import { FC, memo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { usePlayerStore } from "@mahiru/ui/main/store/player";

import LyricComponent, { LyricRef } from "@mahiru/ui/public/components/lyric/LyricContainer";

const Lyric: FC<object> = () => {
  const { PlayerStatus, PlayerTrackStatus, PlayerInitialized, PlayerCoreGetter } = usePlayerStore([
    "PlayerTrackStatus",
    "PlayerStatus",
    "PlayerInitialized",
    "PlayerCoreGetter"
  ]);
  const player = PlayerCoreGetter();
  const lyricRef = useRef<Nullable<LyricRef>>(null);

  const handleWordClick = useCallback(
    (timeMS: number) => {
      player.changeCurrentTime(timeMS / 1000);
    },
    [player]
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
      lyricRef.current?.update(time - lastTime);
      lyricRef.current?.setCurrentTime(player.currentTime * 1000);
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
      lyricRef.current?.calcLayout();
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
      lyricRef.current?.setCurrentTime(player.currentTime * 1000);
      lyricRef.current?.update(0);
      lyricRef.current?.calcLayout();
    }
  }, [PlayerInitialized, player]);

  return (
    <div className="absolute top-0 left-[48%] w-1/2 h-full overflow-hidden mix-blend-plus-lighter">
      <LyricComponent
        ref={lyricRef}
        lyric={PlayerTrackStatus?.lyric}
        version={PlayerStatus.lyricVersion || []}
        onWordClick={handleWordClick}
      />
    </div>
  );
};
export default memo(Lyric);
