import { useEffect, type RefObject } from "react";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useListenable } from "@/common/hooks/use-listenable";
import { useWindowVisible } from "@/common/hooks/use-window-visible";
import type { LyricRef } from "@/common/components/display/lyric";

export function useLyricSyncFromBus(lyricRef: RefObject<Nullable<LyricRef>>) {
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const progressBus = useListenable(RendererIPCMessageBus.progress);
  const trackMetaBusRef = useLatestRef({ trackMetaBus });
  const visible = useWindowVisible();

  useEffect(() => {
    let lastTime = 0;
    let isRunning = trackMetaBus.data?.status === "playing";
    if (!isRunning || !visible) return;

    const onFrame = (time: number) => {
      if (!isRunning) return;

      const { trackMetaBus } = trackMetaBusRef.current;
      if (trackMetaBus.data?.status !== "playing") {
        isRunning = false;
        return;
      }

      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      // 自己更新时间
      lyricRef.current?.update(delta);

      requestAnimationFrame(onFrame);
    };

    requestAnimationFrame(onFrame);
    return () => {
      isRunning = false;
    };
  }, [trackMetaBusRef, trackMetaBus.data?.status, lyricRef, visible]);

  // 关键时间点同步
  useEffect(() => {
    lyricRef.current?.setCurrentTime((progressBus.data?.currentTime || 0) * 1000);
    visible && lyricRef.current?.update(0);
  }, [lyricRef, progressBus.data?.currentTime, visible]);
}
