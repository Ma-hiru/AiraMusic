import { useCallback, useEffect } from "react";
import { createSyncHookLock } from "@mahiru/ui/main/hooks/useSyncHookLock";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { Renderer } from "@mahiru/ui/public/entry/renderer";

const useSyncHookLock = createSyncHookLock("playerProgressSync");

export function usePlayerProgressSyncSend(syncWins: WindowType[]) {
  const { getFinalSendWins, isOwner } = useSyncHookLock(syncWins);
  const { AudioRefGetter, PlayerProgressGetter } = usePlayerStore([
    "AudioRefGetter",
    "PlayerProgressGetter"
  ]);
  const audio = AudioRefGetter();

  const sendProgressSync = useCallback(() => {
    getFinalSendWins().forEach((win) => {
      Renderer.sendMessage("playerProgressSync", win, PlayerProgressGetter());
    });
  }, [PlayerProgressGetter, getFinalSendWins]);

  useEffect(() => {
    if (!audio || !isOwner()) return;
    audio.addEventListener("timeupdate", sendProgressSync, { passive: true });
    const subscribe = Renderer.addMessageHandler("requestPlayerProgressSync", null, ({ from }) => {
      if (getFinalSendWins().includes(from)) {
        sendProgressSync();
      }
    });
    return () => {
      subscribe();
      audio.removeEventListener("timeupdate", sendProgressSync);
    };
  }, [audio, getFinalSendWins, isOwner, sendProgressSync]);

  return { sendProgressSync };
}
