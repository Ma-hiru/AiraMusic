import { FC, memo, useCallback, useEffect, useRef } from "react";

import LyricComponent, { LyricRef } from "@mahiru/ui/public/components/lyric/LyricContainer";
import AppEntry from "@mahiru/ui/windows/main/entry";

const Lyric: FC<object> = () => {
  const player = AppEntry.usePlayer();
  const lyricRef = useRef<Nullable<LyricRef>>(null);

  const handleWordClick = useCallback(
    (timeMS: number) => {
      player.audio.currentTime = timeMS / 1000;
    },
    [player]
  );

  useEffect(() => {
    let lastTime = -1;
    let rafId: Nullable<number> = null;
    let isRunning = false;

    const onFrame = (time: number) => {
      if (!isRunning || player.audio.paused) {
        rafId = null;
        return;
      }
      // 如果lastTime === -1 说明是第一次记录时间
      if (lastTime === -1) lastTime = time;
      lyricRef.current?.update(time - lastTime);
      lyricRef.current?.setCurrentTime(player.audio.instance.currentTime * 1000);
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

    player.audio.addEventListener("play", startLoop, { passive: true });
    player.audio.addEventListener("pause", stopLoop, { passive: true });
    player.audio.addEventListener("loadstart", loadstart, { passive: true });
    return () => {
      stopLoop();
      player.audio.removeEventListener("play", startLoop);
      player.audio.removeEventListener("pause", stopLoop);
      player.audio.removeEventListener("loadstart", loadstart);
    };
  }, [player]);

  return (
    <div className="absolute top-0 left-[48%] w-1/2 h-full overflow-hidden">
      <LyricComponent
        ref={lyricRef}
        lyric={player.current.lyric}
        rmActive={player.current?.rmActive}
        tlActive={player.current?.tlActive}
        noteActive={player.current?.noteActive}
        onWordClick={handleWordClick}
      />
    </div>
  );
};
export default memo(Lyric);
