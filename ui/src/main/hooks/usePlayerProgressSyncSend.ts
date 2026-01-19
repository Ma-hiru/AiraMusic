import { useCallback, useEffect } from "react";
import { createSyncHookLock } from "@mahiru/ui/main/hooks/useSyncHookLock";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { Renderer } from "@mahiru/ui/public/entry/renderer";

const useSyncHookLock = createSyncHookLock("playerProgressSync");

export function usePlayerProgressSyncSend(syncWins: WindowType[]) {
  const { getFinalSendWins, isOwner } = useSyncHookLock(syncWins);
  const { PlayerCoreGetter } = usePlayerStore(["PlayerCoreGetter"]);
  const player = PlayerCoreGetter();

  const sendProgressSync = useCallback(() => {
    getFinalSendWins().forEach((win) => {
      Renderer.sendMessage("playerProgressSync", win, player.progress);
    });
  }, [getFinalSendWins, player.progress]);

  useEffect(() => {
    if (!isOwner()) return;
    player.addEventListener("timeupdate", sendProgressSync, { passive: true });
    const subscribe = Renderer.addMessageHandler("requestPlayerProgressSync", null, ({ from }) => {
      if (getFinalSendWins().includes(from)) {
        sendProgressSync();
      }
    });
    return () => {
      player.removeEventListener("timeupdate", sendProgressSync);
      subscribe();
    };
  }, [getFinalSendWins, isOwner, player, sendProgressSync]);

  return { sendProgressSync };
}
