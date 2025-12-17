import { useCallback, useEffect, useRef, useState } from "react";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { usePlayerStatus } from "@mahiru/ui/store";
import { Player } from "@mahiru/ui/utils/player";

export function usePlayerInfoSync(targetWindow: WindowType) {
  const [hasOpened, setHasOpened] = useState(false);
  const { trackStatus, playerProgress, setLyricVersion, playerStatus, audioControl, audioRef } =
    usePlayerStatus([
      "trackStatus",
      "playerProgress",
      "setLyricVersion",
      "playerStatus",
      "audioControl",
      "audioRef"
    ]);
  const { mainColor } = useThemeColor();
  const getNewestInfo = useRef({ trackStatus, playerStatus, playerProgress });
  getNewestInfo.current = { trackStatus, playerStatus, playerProgress };

  // 发送歌曲信息
  const sendInit = useCallback(() => {
    const { trackStatus } = getNewestInfo.current;
    trackStatus &&
      Renderer.sendMessage("lyricInit", targetWindow, {
        trackStatus
      });
  }, [targetWindow]);
  // 发送同步信息
  const sendSync = useCallback(() => {
    const { playerProgress, playerStatus } = getNewestInfo.current;
    Renderer.sendMessage("lyricSync", targetWindow, {
      progress: playerProgress.current(),
      playerStatus,
      themeColor: mainColor.hex()
    });
  }, [mainColor, targetWindow]);
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
        Renderer.addMessageHandler("otherWindowLoaded", targetWindow, sendInit, { once: true });
        Renderer.addMessageHandler("otherWindowClosed", targetWindow, getOpenedStatus, {
          once: true
        });
      } else {
        Renderer.event.closeInternalWindow(targetWindow);
      }
    });
  }, [getOpenedStatus, sendInit, targetWindow]);
  // 同步状态反向变更
  useEffect(() => {
    if (!hasOpened) return;
    const removeListener = Renderer.addMessageHandler("lyricSyncReverse", targetWindow, (sync) => {
      const changedLyricVersion = sync.playerStatus?.lyricVersion;
      if (changedLyricVersion) setLyricVersion(changedLyricVersion);
      const controlMsg = sync.playerControl;
      if (controlMsg) {
        if (controlMsg === "play") {
          audioControl.current()?.play();
        } else if (controlMsg === "last") {
          Player.last(true);
        } else if (controlMsg === "next") {
          Player.next(true);
        }
      }
    });
    return () => {
      removeListener();
    };
  }, [audioControl, hasOpened, setLyricVersion, targetWindow]);
  // 同步音频进度变化
  useEffect(() => {
    if (!hasOpened) return;
    const audio = audioRef.current();
    if (!audio) return;
    audio.addEventListener("timeupdate", sendSync);
    audio.addEventListener("loadstart", sendInit);
    audio.addEventListener("pause", sendSync);
    return () => {
      audio.removeEventListener("timeupdate", sendSync);
      audio.removeEventListener("loadstart", sendInit);
      audio.removeEventListener("pause", sendSync);
    };
  }, [audioRef, hasOpened, sendInit, sendSync]);
  // 同步歌曲信息
  useEffect(() => {
    hasOpened && sendInit();
  }, [hasOpened, sendInit, trackStatus]);
  // 保底机制，定时检查窗口是否打开，避免遗漏消息导致一直占用资源同步
  useEffect(() => {
    if (!hasOpened) return;
    const timer = setInterval(getOpenedStatus, 2000);
    return () => clearInterval(timer);
  }, [getOpenedStatus, hasOpened]);

  return { hasOpened, toggleTargetWindow };
}
