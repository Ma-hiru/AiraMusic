import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { Renderer } from "@mahiru/ui/utils/renderer";

export function usePlayerInfoSync(targetWindow: WindowType) {
  const [hasOpened, setHasOpened] = useState(false);
  const {
    trackStatus,
    playerStatus,
    getPlayerProgress,
    setLyricVersion,
    audioRef,
    audioControl,
    playlistControl
  } = usePlayer();
  const { mainColor } = useThemeColor();
  const getNewestInfo = useRef({ trackStatus, playerStatus, getPlayerProgress });
  getNewestInfo.current = { trackStatus, playerStatus, getPlayerProgress };

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
    const { getPlayerProgress, playerStatus } = getNewestInfo.current;
    Renderer.sendMessage("lyricSync", targetWindow, {
      progress: getPlayerProgress(),
      playerStatus,
      themeColor: mainColor.hex()
    });
  }, [mainColor, targetWindow]);
  // 更新歌词窗口打开状态
  const updateOpenedStatus = useCallback(() => {
    setTimeout(() => {
      Renderer.invoke.hasOpenInternalWindow(targetWindow).then((opened) => {
        setHasOpened(opened);
      });
    }, 200);
  }, [targetWindow]);
  // 打开/关闭歌词窗口
  const toggleTargetWindow = useCallback(() => {
    if (!hasOpened) {
      Renderer.event.openInternalWindow(targetWindow);
      Renderer.addMessageHandler("otherWindowLoaded", targetWindow, sendInit, { once: true });
      updateOpenedStatus();
    } else {
      Renderer.event.closeInternalWindow(targetWindow);
      updateOpenedStatus();
    }
  }, [hasOpened, sendInit, targetWindow, updateOpenedStatus]);
  // 同步状态反向变更
  useEffect(() => {
    const removeListener = Renderer.addMessageHandler("lyricSyncReverse", targetWindow, (sync) => {
      const changedLyricVersion = sync.playerStatus?.lyricVersion;
      if (changedLyricVersion) setLyricVersion(changedLyricVersion);
      const controlMsg = sync.playerControl;
      if (controlMsg) {
        if (controlMsg === "play") {
          audioControl.play();
        } else if (controlMsg === "last") {
          playlistControl.lastTrack(true);
        } else if (controlMsg === "next") {
          playlistControl.nextTrack(true);
        }
      }
    });
    return () => {
      removeListener();
    };
  }, [audioControl, playlistControl, setLyricVersion, targetWindow]);
  // 同步音频进度变化
  useEffect(() => {
    if (!hasOpened) return;
    const audio = audioRef.current;
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
  useEffect(sendInit, [sendInit, trackStatus]);

  return { hasOpened, toggleTargetWindow };
}
