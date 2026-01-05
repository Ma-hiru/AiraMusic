import { useCallback, useEffect, useRef } from "react";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { usePlayerStore } from "@mahiru/ui/store/player";
import { createSyncHookLock } from "@mahiru/ui/hook/useSyncHookLock";

const useSyncHookLock = createSyncHookLock("playerTrackSync");

export function usePlayerTrackSyncSend(syncWins: WindowType[]) {
  const { PlayerTrackStatus } = usePlayerStore(["PlayerTrackStatus"]);
  const { getFinalSendWins, isOwner } = useSyncHookLock(syncWins);
  const lastTrackID = useRef(PlayerTrackStatus?.track.id);

  const sendTrackSync = useCallback(() => {
    if (!PlayerTrackStatus || PlayerTrackStatus.track.id === lastTrackID.current) return;
    lastTrackID.current = PlayerTrackStatus.track.id;
    getFinalSendWins().forEach((win) => {
      Renderer.sendMessage("playerTrackSync", win, PlayerTrackStatus);
    });
  }, [PlayerTrackStatus, getFinalSendWins]);

  useEffect(() => {
    if (!isOwner()) return;
    sendTrackSync();
    return Renderer.addMessageHandler("requestPlayerTrackSync", null, ({ from }) => {
      if (getFinalSendWins().includes(from)) {
        sendTrackSync();
      }
    });
  }, [getFinalSendWins, isOwner, sendTrackSync]);

  return { sendTrackSync };
}
