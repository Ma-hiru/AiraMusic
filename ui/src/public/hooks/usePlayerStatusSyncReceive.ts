import { useLayoutEffect, useState } from "react";
import { debounce } from "lodash-es";
import { Renderer } from "@mahiru/ui/public/entry/renderer";

export function usePlayerStatusSyncReceive() {
  const [playerStatusSync, setPlayerStatusSync] = useState<Nullable<PlayerStatusSync>>(null);

  useLayoutEffect(() => {
    requestPlayerStatusSync();
    return Renderer.addMessageHandler("playerStatusSync", "main", setPlayerStatusSync);
  }, []);

  return { playerStatusSync, requestPlayerStatusSync };
}

const requestPlayerStatusSync = debounce(() => {
  Renderer.sendMessage("requestPlayerStatusSync", "main", undefined);
}, 500);
