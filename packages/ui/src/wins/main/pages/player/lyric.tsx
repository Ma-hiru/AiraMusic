import { memo, useRef, type FC, useMemo, useEffect, useCallback } from "react";
import { useTailwindMediaQuery } from "@/common/hooks/use-tailwind-media-query";
import { usePlayerViewVisible } from "@/wins/main/hooks/use-player-view-visible";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import LyricComponent, { type LyricRef } from "@/common/components/display/lyric";

const Lyric: FC<object> = () => {
  const player = RendererPlayerHandle.usePlayer();
  const lyricRef = useRef<Nullable<LyricRef>>(null);
  const visible = usePlayerViewVisible("player");

  const handleWordClick = useCallback(
    (timeMS: number) => {
      player.audio.currentTime = timeMS / 1000;
      player.paused && player.audio.play();
    },
    [player]
  );

  useEffect(() => {
    if (!visible) return;
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

    // 确保visible恢复时，时间同步，且loop开启
    lyricRef.current?.setCurrentTime(player.audio.instance.currentTime * 1000);
    lyricRef.current?.update(0);
    !player.audio.paused && startLoop();
    player.audio.addEventListener("play", startLoop, { passive: true });
    player.audio.addEventListener("pause", stopLoop, { passive: true });
    player.audio.addEventListener("loadstart", loadstart, { passive: true });
    return () => {
      stopLoop();
      player.audio.removeEventListener("play", startLoop);
      player.audio.removeEventListener("pause", stopLoop);
      player.audio.removeEventListener("loadstart", loadstart);
    };
  }, [player, visible]);

  const { lg, md, sm, xl, "2xl": xxl } = useTailwindMediaQuery();
  const fontSize = useMemo(() => {
    if (xxl) return 32;
    if (xl) return 30;
    if (lg) return 28;
    if (md) return 25;
    if (sm) return 23;
  }, [lg, md, sm, xl, xxl]);

  return (
    <div className="absolute top-0 left-[48%] w-1/2 h-full overflow-hidden contain-strict ">
      <LyricComponent
        ref={lyricRef}
        className="contain-strict"
        fontSize={fontSize}
        lyric={player.current.lyric}
        playing={visible && player.playing}
        rmActive={player.current?.rmActive}
        tlActive={player.current?.tlActive}
        noteActive={player.current?.noteActive}
        onWordClick={handleWordClick}
      />
    </div>
  );
};
export default memo(Lyric);
