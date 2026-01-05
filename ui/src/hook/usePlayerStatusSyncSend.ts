import { createSyncHookLock } from "@mahiru/ui/hook/useSyncHookLock";
import { useCallback, useEffect } from "react";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { usePlayerStore } from "@mahiru/ui/store/player";

const useSyncHookLock = createSyncHookLock("playerStatusSync");

export function usePlayerStatusSyncSend(syncWins: WindowType[]) {
  const { PlayerStatus, PlayerFSMStatus } = usePlayerStore(["PlayerStatus", "PlayerFSMStatus"]);
  const { getFinalSendWins, isOwner } = useSyncHookLock(syncWins);

  const sendStatusSync = useCallback(() => {
    const data: PlayerStatusSync = {
      volume: PlayerStatus.volume,
      repeat: PlayerStatus.repeat,
      shuffle: PlayerStatus.shuffle,
      position: PlayerStatus.position,
      fsmState: PlayerFSMStatus,
      lyricPreference: PlayerStatus.lyricPreference,
      lyricVersion: PlayerStatus.lyricVersion
    };
    getFinalSendWins().forEach((win) => {
      Renderer.sendMessage("playerStatusSync", win, data);
    });
  }, [
    PlayerFSMStatus,
    PlayerStatus.lyricPreference,
    PlayerStatus.lyricVersion,
    PlayerStatus.position,
    PlayerStatus.repeat,
    PlayerStatus.shuffle,
    PlayerStatus.volume,
    getFinalSendWins
  ]);

  useEffect(() => {
    if (!isOwner()) return;
    sendStatusSync();
    return Renderer.addMessageHandler("requestPlayerStatusSync", null, ({ from }) => {
      if (getFinalSendWins().includes(from)) {
        sendStatusSync();
      }
    });
  }, [getFinalSendWins, isOwner, sendStatusSync]);

  return { sendStatusSync };
}
