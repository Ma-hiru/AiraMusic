import { useCallback, useEffect, useState } from "react";
import { usePlayerProgressSyncSend } from "@mahiru/ui/main/hooks/usePlayerProgressSyncSend";
import { usePlayerControlSync } from "@mahiru/ui/main/hooks/usePlayerControlSync";
import { usePlayerTrackSyncSend } from "@mahiru/ui/main/hooks/usePlayerTrackSyncSend";
import { usePlayerStatusSyncSend } from "@mahiru/ui/main/hooks/usePlayerStatusSyncSend";
import { useThemeSyncSend } from "@mahiru/ui/main/hooks/useThemeSyncSend";
import AppRenderer from "@mahiru/ui/public/entry/renderer";

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
      AppRenderer.invoke.hasOpenInternalWindow(targetWindow).then((opened) => {
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
        AppRenderer.event.openInternalWindow(targetWindow);
        AppRenderer.addMessageHandler("otherWindowLoaded", targetWindow, updateSync, {
          once: true
        });
        AppRenderer.addMessageHandler("otherWindowClosed", targetWindow, getOpenedStatus, {
          once: true
        });
      } else {
        AppRenderer.event.closeInternalWindow(targetWindow);
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
