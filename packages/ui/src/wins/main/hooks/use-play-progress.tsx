import { useRef, useEffect, useCallback } from "react";
import { usePlayerViewVisible } from "@/wins/main/hooks/use-player-view-visible";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import type { PlayerProgressRef } from "@/common/hooks/use-progress-sync";

export function usePlayProgress(view: "bar" | "player", variant: "wave" | "normal" = "normal") {
  const progressRef = useRef<PlayerProgressRef>(null);
  const visible = usePlayerViewVisible(view);
  const player = RendererPlayerHandle.usePlayer();
  const track = player.current.track?.detail;
  const { audio } = player;
  const onUpdate = useCallback((percent: number) => (audio.currentTime = `${percent}%`), [audio]);
  useEffect(() => {
    if (!visible) return;
    const tick = progressRef.current?.tick;
    if (!tick) return;

    const update = (force = false) => {
      const { buffered, duration } = audio.progress;
      const percent = !duration ? 0 : (audio.currentTime / duration) * 100;
      const buffer = !duration ? 0 : (buffered / duration) * 100;
      tick(force, { percent, buffer });
    };
    const handleTimeUpdate = () => update(false);
    const handleSeeked = () => update(true);
    const handleLoad = () => tick(true, { percent: 0, buffer: 0 });

    // 切换组件后立即同步当前值，也覆盖暂停时切换进度条的场景。
    update(true);

    audio.addEventListener("timeupdate", handleTimeUpdate, { passive: true });
    audio.addEventListener("progress", handleTimeUpdate, { passive: true });
    audio.addEventListener("loadstart", handleLoad, { passive: true });
    audio.addEventListener("seeked", handleSeeked, { passive: true });
    return () => {
      tick.cancel();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("progress", handleTimeUpdate);
      audio.removeEventListener("loadstart", handleLoad);
      audio.removeEventListener("seeked", handleSeeked);
    };
  }, [audio, visible, variant]);
  return {
    progressRef,
    track,
    visible,
    onUpdate
  };
}
