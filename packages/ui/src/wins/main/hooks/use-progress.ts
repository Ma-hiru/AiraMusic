import { useState, useEffect } from "react";
import { usePlayerViewVisible } from "@/wins/main/hooks/use-player-view-visible";
import RendererPlayerHandle from "@/wins/main/lib/handle";

export function useProgress(view: "bar" | "player") {
  const visible = usePlayerViewVisible(view);
  const player = RendererPlayerHandle.usePlayer();
  const [progress, setProgress] = useState(player.audio.progress);

  useEffect(() => {
    if (!visible) return;
    const update = () => setProgress({ ...player.audio.progress });
    update();
    player.audio.addEventListener("timeupdate", update, { passive: true });
    return () => {
      player.audio.removeEventListener("timeupdate", update);
    };
  }, [player.audio, visible]);

  return { progress };
}
