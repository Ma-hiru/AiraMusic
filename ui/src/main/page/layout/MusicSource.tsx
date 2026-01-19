import { FC, memo, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useNetwork } from "@mahiru/ui/public/hooks/useNetwork";
import { Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseTrack } from "@mahiru/ui/public/entry/track";
import { Auth } from "@mahiru/ui/public/entry/auth";
import { useWindowTitle } from "@mahiru/ui/public/hooks/useWindowTitle";
import { PlayerFSMStatusEnum } from "@mahiru/ui/public/enum";
import { ShortcutConfig, useKeyboardShortcut } from "@mahiru/ui/public/hooks/useKeyboardShortcut";
import { useToast } from "@mahiru/ui/public/hooks/useToast";

import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useLogin } from "@mahiru/ui/main/hooks/useLogout";
import { usePlayerResource } from "@mahiru/ui/main/hooks/usePlayerResource";
import { useMediaSession } from "@mahiru/ui/main/hooks/useMediaSession";
import { useSpectrumWorker } from "@mahiru/ui/main/hooks/useSpectrumWorker";
import { usePlayerStatusSyncSend } from "@mahiru/ui/main/hooks/usePlayerStatusSyncSend";
import { usePlayerControlSync } from "@mahiru/ui/main/hooks/usePlayerControlSync";
import { usePlayerTrackSyncSend } from "@mahiru/ui/main/hooks/usePlayerTrackSyncSend";

const MusicSource: FC<object> = () => {
  const {
    PlayerCoreGetter,
    PlayerTrackStatus,
    PlayerFSMStatus,
    SetSpectrumGetter,
    SpectrumOptions,
    PlayingRequest,
    TriggerPlayerFSMEvent,
    SetPlayingRequest,
    PlayerInitialized,
    PlayerProgressGetter,
    PlayerStatus,
    InitPlayerCore
  } = usePlayerStore();
  const { IsTyping } = useLayoutStore(["IsTyping"]);
  const player = PlayerCoreGetter();

  // 初始化播放器核心和播放地址，加载上次播放进度和音量
  useEffect(() => {
    InitPlayerCore();
  }, [InitPlayerCore]);
  useEffect(() => {
    if (PlayerInitialized) {
      const audio = player.audio;
      const initSrc = PlayerTrackStatus?.audio;
      if (audio && initSrc) {
        audio.src = initSrc;
        player.changeCurrentTime(PlayerProgressGetter().currentTime);
        player.changeVolume(PlayerStatus.volume ?? 0.5);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [PlayerInitialized]);
  const requestPlayingRetryCount = useRef(0);
  // 处理状态机
  useEffect(() => {
    // 当没有播放请求时，仅在 playing 状态下暂停
    if (!PlayingRequest) {
      if (PlayerFSMStatus === PlayerFSMStatusEnum.playing) {
        TriggerPlayerFSMEvent("requestPause");
      }
      return;
    }
    if (
      PlayerFSMStatus === PlayerFSMStatusEnum.idle ||
      PlayerFSMStatus === PlayerFSMStatusEnum.ready ||
      PlayerFSMStatus === PlayerFSMStatusEnum.paused
    ) {
      if (requestPlayingRetryCount.current < 5) {
        requestPlayingRetryCount.current += 1;
        TriggerPlayerFSMEvent("requestPlaying");
      } else {
        SetPlayingRequest(false);
      }
    }
    if (PlayerFSMStatus === PlayerFSMStatusEnum.error) {
      SetPlayingRequest(false);
    }
    if (PlayerFSMStatus === PlayerFSMStatusEnum.playing) {
      requestPlayingRetryCount.current = 0;
    }
  }, [PlayerFSMStatus, PlayingRequest, SetPlayingRequest, TriggerPlayerFSMEvent]);
  // 根据 FSM 状态自动播放或暂停
  useEffect(() => {
    if (PlayerFSMStatus === PlayerFSMStatusEnum.playing) {
      // 检查 src 是否是有效的音频 URL（排除页面 URL）
      const src = player.audio.src;
      const isValidAudioSrc = !src?.includes("localhost") && !src?.includes("127.0.0.1");
      if (isValidAudioSrc) {
        player.playAudio();
      }
    } else {
      player.pauseAudio();
    }
  }, [PlayerFSMStatus, player]);
  // 处理音频加载错误
  const login = useLogin();
  const network = useNetwork();
  const { requestToast } = useToast();
  useLayoutEffect(() => {
    player.audio.addEventListener("error", () => {
      const currentSrc = player.audio.src;
      // 如果 src 为空或者是空 src 错误，忽略（切换歌曲时的正常情况）
      if (
        !currentSrc ||
        player.audio.error?.message?.includes("Empty src") ||
        network === "offline"
      ) {
        return;
      }
      const raw = PlayerTrackStatus?.meta?.[0]?.url;
      if (raw) {
        if (currentSrc !== raw) {
          Log.info("MusicSource.tsx", "cache audio load error, fallback to raw src");
          player.audio.src = raw;
          const id = PlayerTrackStatus?.track.id;
          if (id) NeteaseTrack.removeCache(id);
        } else {
          if (!Auth.isAccountLoggedIn()) {
            player.pause();
            login();
          } else {
            // TODO: 播放错误，可能是403或网络错误，403应该重新登录或刷新缓存，网络错误则跳过当前歌曲
            Log.warn("MusicSource.tsx", "audio playback error");
            requestToast({
              type: "error",
              text: "歌曲加载失败，请检查网络或登录状态"
            });
            player.next(true);
          }
        }
      }
    });
  }, [PlayerTrackStatus?.meta, PlayerTrackStatus?.track.id, login, network, player, requestToast]);
  // 注册音频资源加载器
  usePlayerResource();
  // 注册 Media Session API
  useMediaSession({
    trackStatus: PlayerTrackStatus,
    play: player.play,
    pause: player.pause,
    lastTrack: player.last,
    nextTrack: player.next,
    seekForward: player.seekForward,
    seekBackward: player.seekBackward,
    seekTo: player.seekTo,
    changeTime: player.changeCurrentTime,
    mute: player.mute,
    unmute: player.unmute
  });
  // 注册局部键盘快捷键
  const [Shortcuts, setShortcuts] = useState<ShortcutConfig[]>([]);
  useKeyboardShortcut(Shortcuts);
  useEffect(() => {
    if (IsTyping) {
      setShortcuts([
        {
          key: "ArrowRight",
          modifiers: ["alt"],
          description: "下一首",
          callback: () => player.next(true)
        },
        {
          key: "ArrowLeft",
          modifiers: ["alt"],
          description: "上一首",
          callback: () => player.last()
        },
        {
          key: "ArrowUp",
          description: "增加音量",
          callback: () => player.upVolume(0.1)
        },
        {
          key: "ArrowDown",
          description: "减少音量",
          callback: () => player.downVolume(0.1)
        }
      ]);
    } else {
      setShortcuts([
        {
          key: " ",
          description: "播放/暂停",
          callback: () => player.play()
        },
        {
          key: "ArrowRight",
          modifiers: ["alt"],
          description: "下一首",
          callback: () => player.next(true)
        },
        {
          key: "ArrowLeft",
          modifiers: ["alt"],
          description: "上一首",
          callback: () => player.last()
        },
        {
          key: "ArrowUp",
          description: "增加音量",
          callback: () => player.upVolume(0.1)
        },
        {
          key: "ArrowDown",
          description: "减少音量",
          callback: () => player.downVolume(0.1)
        }
      ]);
    }
  }, [IsTyping, player]);
  // 注册窗口标题
  const { updateWindowTitle, defaultTitle } = useWindowTitle();
  useEffect(() => {
    const title = PlayerTrackStatus?.track.name;
    const artist = PlayerTrackStatus?.track.ar;
    if (title && artist) {
      updateWindowTitle(`${title} - ${artist.map((ar) => ar.name).join("&")}`);
    } else {
      updateWindowTitle(defaultTitle);
    }
  }, [PlayerTrackStatus?.track.ar, PlayerTrackStatus?.track.name, defaultTitle, updateWindowTitle]);
  // 注册频谱
  const { spectrumData, isReady } = useSpectrumWorker(
    player.audio,
    PlayerFSMStatus === PlayerFSMStatusEnum.playing,
    {
      fftSize: 2048,
      numBands: 32,
      withPeaks: false,
      fpsLimit: 60,
      ...SpectrumOptions
    }
  );
  useEffect(() => {
    SetSpectrumGetter(() => ({
      data: () => spectrumData.current,
      ready: isReady
    }));
  }, [SetSpectrumGetter, isReady, spectrumData]);
  // 同步歌曲信息和状态到托盘及主进程
  usePlayerStatusSyncSend(["tray", "main"]);
  usePlayerControlSync(["tray", "main"]);
  usePlayerTrackSyncSend(["tray", "main"]);
  return null;
};
export default memo(MusicSource);
