import { useCallback, useEffect, useRef } from "react";
import { createSyncHookLock } from "@mahiru/ui/main/hooks/useSyncHookLock";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { Renderer } from "@mahiru/ui/public/entry/renderer";

const useSyncHookLock = createSyncHookLock("playerTrackSync");

export function usePlayerTrackSyncSend(syncWins: WindowType[]) {
  const { PlayerTrackStatus } = usePlayerStore(["PlayerTrackStatus"]);
  const { getFinalSendWins, isOwner } = useSyncHookLock(syncWins);
  const lastTrackID = useRef(PlayerTrackStatus?.track.id);

  const sendTrackSync = useCallback(() => {
    if (!PlayerTrackStatus) return;
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
  }, [getFinalSendWins, isOwner, sendTrackSync, PlayerTrackStatus?.lyric]);

  return { sendTrackSync };
}
