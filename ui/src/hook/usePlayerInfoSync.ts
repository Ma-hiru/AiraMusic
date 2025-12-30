import { useCallback, useEffect, useRef, useState } from "react";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { usePlayerStore } from "@mahiru/ui/store/player";

export function usePlayerInfoSync(targetWindow: WindowType) {
  const [hasOpened, setHasOpened] = useState(false);
  const {
    PlayerStatus,
    PlayerTrackStatus,
    PlayerProgressGetter,
    AudioRefGetter,
    SetLyricVersion,
    PlayerCoreGetter
  } = usePlayerStore([
    "PlayerTrackStatus",
    "PlayerProgressGetter",
    "SetLyricVersion",
    "PlayerStatus",
    "AudioRefGetter",
    "PlayerCoreGetter"
  ]);
  const { mainColor } = useThemeColor();
  const getNewestInfo = useRef({ PlayerTrackStatus, PlayerStatus, PlayerProgressGetter });
  getNewestInfo.current = { PlayerTrackStatus, PlayerStatus, PlayerProgressGetter };
  const player = PlayerCoreGetter();
  const audio = AudioRefGetter();
  // 发送歌曲信息
  const sendInit = useCallback(() => {
    const { PlayerTrackStatus } = getNewestInfo.current;
    PlayerTrackStatus &&
      Renderer.sendMessage("lyricInit", targetWindow, {
        trackStatus: PlayerTrackStatus
      });
  }, [targetWindow]);
  // 发送同步信息
  const sendSync = useCallback(() => {
    const { PlayerProgressGetter, PlayerStatus } = getNewestInfo.current;
    Renderer.sendMessage("lyricSync", targetWindow, {
      progress: PlayerProgressGetter(),
      playerStatus: PlayerStatus,
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
      if (changedLyricVersion) SetLyricVersion(changedLyricVersion);
      const controlMsg = sync.playerControl;
      if (controlMsg) {
        if (controlMsg === "play") {
          player?.play?.();
        } else if (controlMsg === "last") {
          player?.last(true);
        } else if (controlMsg === "next") {
          player?.next(true);
        }
      }
    });
    return () => {
      removeListener();
    };
  }, [SetLyricVersion, hasOpened, player, targetWindow]);
  // 同步音频进度变化
  useEffect(() => {
    if (!hasOpened) return;
    if (!audio) return;
    audio.addEventListener("timeupdate", sendSync);
    audio.addEventListener("loadstart", sendInit);
    audio.addEventListener("pause", sendSync);
    return () => {
      audio.removeEventListener("timeupdate", sendSync);
      audio.removeEventListener("loadstart", sendInit);
      audio.removeEventListener("pause", sendSync);
    };
  }, [audio, hasOpened, sendInit, sendSync]);
  // 同步歌曲信息
  useEffect(() => {
    hasOpened && sendInit();
  }, [hasOpened, sendInit]);
  // 保底机制，定时检查窗口是否打开，避免遗漏消息导致一直占用资源同步
  useEffect(() => {
    if (!hasOpened) return;
    const timer = setInterval(getOpenedStatus, 2000);
    return () => clearInterval(timer);
  }, [getOpenedStatus, hasOpened]);

  return { hasOpened, toggleTargetWindow };
}
