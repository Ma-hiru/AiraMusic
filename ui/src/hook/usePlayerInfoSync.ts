import { useCallback, useEffect, useState } from "react";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { usePlayerControlSync } from "@mahiru/ui/hook/usePlayerControlSync";
import { usePlayerProgressSyncSend } from "@mahiru/ui/hook/usePlayerProgressSyncSend";
import { usePlayerTrackSyncSend } from "@mahiru/ui/hook/usePlayerTrackSyncSend";
import { usePlayerStatusSyncSend } from "@mahiru/ui/hook/usePlayerStatusSyncSend";
import { useThemeSyncSend } from "@mahiru/ui/hook/useThemeSyncSend";

export function usePlayerInfoSync(targetWindow: WindowType) {
  const [hasOpened, setHasOpened] = useState(false);
  usePlayerControlSync([targetWindow]);
  const { sendProgressSync } = usePlayerProgressSyncSend([targetWindow]);
  const { sendTrackSync } = usePlayerTrackSyncSend([targetWindow]);
  const { sendStatusSync } = usePlayerStatusSyncSend([targetWindow]);
  const { sendThemeSync } = useThemeSyncSend([targetWindow]);

  const updateSync = useCallback(() => {
    sendProgressSync();
    sendTrackSync();
    sendStatusSync();
    sendThemeSync();
  }, [sendProgressSync, sendStatusSync, sendThemeSync, sendTrackSync]);

  // 更新歌词窗口打开状态
  const getOpenedStatus = useCallback(
    (callback?: NormalFunc<[ok: boolean]>) => {
      Renderer.invoke.hasOpenInternalWindow(targetWindow).then((opened) => {
        setHasOpened(opened);
        if (callback) {
          callback(opened);
          getOpenedStatus();
        }
      });
    },
    [targetWindow]
  );
  // 打开/关闭歌词窗口
  const toggleTargetWindow = useCallback(() => {
    getOpenedStatus((ok) => {
      if (!ok) {
        Renderer.event.openInternalWindow(targetWindow);
        Renderer.addMessageHandler("otherWindowLoaded", targetWindow, updateSync, { once: true });
        Renderer.addMessageHandler("otherWindowClosed", targetWindow, getOpenedStatus, {
          once: true
        });
      } else {
        Renderer.event.closeInternalWindow(targetWindow);
      }
    });
  }, [getOpenedStatus, targetWindow, updateSync]);

  // 保底机制，定时检查窗口是否打开，避免遗漏消息导致一直占用资源同步
  useEffect(() => {
    if (!hasOpened) return;
    const timer = setInterval(getOpenedStatus, 2000);
    return () => clearInterval(timer);
  }, [getOpenedStatus, hasOpened]);

  return { hasOpened, toggleTargetWindow };
}
