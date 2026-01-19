import { useLayoutEffect, useState } from "react";
import { debounce } from "lodash-es";
import { Renderer } from "@mahiru/ui/public/entry/renderer";

export function usePlayerProgressSyncReceive() {
  const [progressSync, setProgressSync] = useState<PlayerProgress>({
    currentTime: 0,
    duration: 0,
    buffered: 0
  });

  useLayoutEffect(() => {
    requestPlayerProgressSync();
    return Renderer.addMessageHandler("playerProgressSync", "main", setProgressSync);
  }, []);

  return { progressSync, requestPlayerProgressSync };
}

const requestPlayerProgressSync = debounce(() => {
  Renderer.sendMessage("requestPlayerProgressSync", "main", undefined);
}, 500);
