import { useState, useEffect } from "react";
import RendererPlayerHandle from "@/wins/main/lib/handle";

export function useProgress() {
  const player = RendererPlayerHandle.usePlayer();
  const [progress, setProgress] = useState(player.audio.progress);

  useEffect(() => {
    const update = () => setProgress({ ...player.audio.progress });
    player.audio.addEventListener("timeupdate", update, { passive: true });
    return () => {
      player.audio.removeEventListener("timeupdate", update);
    };
  }, [player.audio]);

  return { progress };
}
