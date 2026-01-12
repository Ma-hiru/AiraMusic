import { FC, memo, SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";

import { useNetwork } from "@mahiru/ui/public/hooks/useNetwork";
import { Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseTrack } from "@mahiru/ui/public/entry/track";
import { Auth } from "@mahiru/ui/public/entry/auth";
import { useWindowTitle } from "@mahiru/ui/public/hooks/useWindowTitle";
import { PlayerFSMStatusEnum } from "@mahiru/ui/public/enum";
import { ShortcutConfig, useKeyboardShortcut } from "@mahiru/ui/public/hooks/useKeyboardShortcut";

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
    SetAudioRefGetter,
    PlayerFSMStatus,
    SetSpectrumGetter,
    SpectrumOptions,
    PlayingRequest,
    TriggerPlayerFSMEvent,
    SetPlayingRequest,
    PlayerInitialized,
    PlayerProgressGetter,
    SetPlayerStatus,
    PlayerStatus,
    InitPlayerCore
  } = usePlayerStore();
  const { IsTyping } = useLayoutStore(["IsTyping"]);
  // 注入 Audio 元素引用
  const audioRealRef = useRef<HTMLAudioElement>(null);
  const audio = audioRealRef.current;
  const player = PlayerCoreGetter();
  useEffect(() => {
    SetAudioRefGetter(() => audioRealRef.current);
    return () => {
      SetAudioRefGetter(() => null);
    };
  }, [SetAudioRefGetter]);
  // 处理初始化
  useEffect(() => {
    InitPlayerCore();
  }, [InitPlayerCore]);
  useEffect(() => {
    if (PlayerInitialized) {
      const audio = audioRealRef.current;
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
  // 处理播放请求
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
  // 监听 audio 播放状态变化
  useEffect(() => {
    if (!audio) return;
    const handleTimeUpdate = () => {
      PlayerProgressGetter().currentTime = audio.currentTime;
    };
    const handleDurationChange = () => (PlayerProgressGetter().duration = audio.duration || 0);
    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        PlayerProgressGetter().buffered = audio.buffered.end(audio.buffered.length - 1);
      }
    };
    const handleVolumeChange = () =>
      SetPlayerStatus((draft) => {
        draft.volume = audio.volume;
      });
    const handleEnded = () => player?.next(false);

    audio.addEventListener("ended", handleEnded, { passive: true });
    audio.addEventListener("timeupdate", handleTimeUpdate, { passive: true });
    audio.addEventListener("durationchange", handleDurationChange, { passive: true });
    audio.addEventListener("progress", handleProgress, { passive: true });
    audio.addEventListener("volumechange", handleVolumeChange, { passive: true });
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("progress", handleProgress);
      audio.removeEventListener("volumechange", handleVolumeChange);
    };
  }, [PlayerProgressGetter, SetPlayerStatus, audio, player]);
  // 根据 FSM 状态自动播放或暂停
  useEffect(() => {
    if (PlayerFSMStatus === PlayerFSMStatusEnum.playing) {
      // 检查 src 是否是有效的音频 URL（排除页面 URL）
      const src = audio?.src || "";
      const isValidAudioSrc =
        src && !src.startsWith("http://localhost") && !src.startsWith("https://localhost");
      if (audio && isValidAudioSrc) {
        audio.play().catch();
      }
    } else {
      audio && audio.pause();
    }
  }, [PlayerFSMStatus, audio]);
  // 处理音频加载错误
  const login = useLogin();
  const network = useNetwork();
  const onError = useCallback(
    (err: SyntheticEvent<HTMLAudioElement>) => {
      const audioEl = err.currentTarget;
      const currentSrc = audioEl.src;
      // 如果 src 为空或者是空 src 错误，忽略（切换歌曲时的正常情况）
      if (!currentSrc || audioEl.error?.message?.includes("Empty src") || network === "offline") {
        return;
      }
      const raw = PlayerTrackStatus?.meta?.[0]?.url;
      if (raw) {
        if (currentSrc !== raw) {
          Log.info("MusicSource.tsx", "cache audio load error, fallback to raw src");
          audioEl.src = raw;
          const id = PlayerTrackStatus?.track.id;
          if (id) {
            NeteaseTrack.removeCache(id);
          }
        } else {
          Log.error("MusicSource.tsx", "audio playback error");
          if (!Auth.isAccountLoggedIn()) {
            player?.play?.();
            login();
          } else {
            // TODO: 播放错误，可能是403或网络错误，403应该重新登录或刷新缓存，网络错误则跳过当前歌曲
            player?.next(true);
          }
        }
      }
    },
    [PlayerTrackStatus?.meta, PlayerTrackStatus?.track.id, login, network, player]
  );
  // 注册音频资源加载器
  usePlayerResource();
  // 注册 Media Session API
  useMediaSession({
    trackStatus: PlayerTrackStatus,
    play: () => player?.play?.(),
    lastTrack: () => player?.last(true),
    nextTrack: () => player?.next(true)
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
    audioRealRef,
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
  usePlayerStatusSyncSend(["tray", "main"]);
  usePlayerControlSync(["tray", "main"]);
  usePlayerTrackSyncSend(["tray", "main"]);
  return (
    <audio
      className="w-0 h-0 opacity-0"
      controls={false}
      autoPlay={false}
      ref={audioRealRef}
      preload="auto"
      onError={onError}
    />
  );
};
export default memo(MusicSource);
