import { useEffect, useState } from "react";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { debounce } from "lodash-es";

export function usePlayerTrackSyncReceive() {
  const [trackSync, setTrackSync] = useState<Nullable<PlayerTrackStatus>>(null);

  useEffect(() => {
    return Renderer.addMessageHandler("playerTrackSync", "main", setTrackSync);
  }, []);

  return { trackSync, requestPlayerTrackSync };
}

const requestPlayerTrackSync = debounce(() => {
  Renderer.sendMessage("requestPlayerTrackSync", "main", undefined);
}, 500);
