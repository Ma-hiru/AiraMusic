import { useEffect, useState } from "react";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { debounce } from "lodash-es";

export function usePlayerStatusSyncReceive() {
  const [playerStatusSync, setPlayerStatusSync] = useState<Nullable<PlayerStatusSync>>(null);
  useEffect(() => {
    return Renderer.addMessageHandler("playerStatusSync", "main", setPlayerStatusSync);
  }, []);

  return { playerStatusSync, requestPlayerStatusSync };
}

const requestPlayerStatusSync = debounce(() => {
  Renderer.sendMessage("requestPlayerStatusSync", "main", undefined);
}, 500);
