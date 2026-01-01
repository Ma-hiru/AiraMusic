import { FC, memo, SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";
import { ShortcutConfig, useKeyboardShortcut } from "@mahiru/ui/hook/useKeyboardShortcut";
import { usePlayerResource } from "@mahiru/ui/hook/usePlayerResource";
import { useMediaSession } from "@mahiru/ui/hook/useMediaSession";
import { useWindowTitle } from "@mahiru/ui/hook/useWindowTitle";
import { Log } from "@mahiru/ui/utils/dev";
import { Track } from "@mahiru/ui/utils/track";
import { Auth } from "@mahiru/ui/utils/auth";
import { useLogin } from "@mahiru/ui/hook/useLogout";
import { usePlayerAudio } from "@mahiru/ui/hook/usePlayerAudio";
import { useSpectrumWorker } from "@mahiru/ui/hook/useSpectrumWorker";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { PlayerFSMStatusEnum, usePlayerStore } from "@mahiru/ui/store/player";
import { useLayoutStore } from "@mahiru/ui/store/layout";
import { useNetwork } from "@mahiru/ui/hook/useNetwork";

const MusicSource: FC<object> = () => {
  const {
    PlayerCoreGetter,
    PlayerTrackStatus,
    InitPlayerCore,
    SetAudioRefGetter,
    PlayerFSMStatus,
    SetSpectrumGetter,
    SpectrumOptions,
    PlayingRequest,
    TriggerPlayerFSMEvent,
    SetPlayingRequest,
    PlayerInitialized
  } = usePlayerStore([
    "PlayerCoreGetter",
    "InitPlayerCore",
    "SetAudioRefGetter",
    "PlayerTrackStatus",
    "PlayerFSMStatus",
    "SetSpectrumGetter",
    "SpectrumOptions",
    "PlayingRequest",
    "TriggerPlayerFSMEvent",
    "SetPlayingRequest",
    "PlayerInitialized"
  ]);
  const { IsTyping } = useLayoutStore(["IsTyping"]);
  // 初始化播放器
  useEffect(() => {
    InitPlayerCore();
  }, [InitPlayerCore]);
  // 注册 Audio 元素引用
  const audioRealRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    SetAudioRefGetter(() => audioRealRef.current);
    return () => {
      SetAudioRefGetter(() => null);
    };
  }, [SetAudioRefGetter]);
  // 注册音频控制器
  usePlayerAudio();
  // 注册音频资源加载器
  usePlayerResource();
  // 注册 Media Session API
  const player = PlayerCoreGetter();
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
          callback: () => player?.next(true)
        },
        {
          key: "ArrowLeft",
          modifiers: ["alt"],
          description: "上一首",
          callback: () => player?.last()
        },
        {
          key: "ArrowUp",
          description: "增加音量",
          callback: () => player?.upVolume?.(0.1)
        },
        {
          key: "ArrowDown",
          description: "减少音量",
          callback: () => player?.downVolume?.(0.1)
        }
      ]);
    } else {
      setShortcuts([
        {
          key: " ",
          description: "播放/暂停",
          callback: () => player?.play?.()
        },
        {
          key: "ArrowRight",
          modifiers: ["alt"],
          description: "下一首",
          callback: () => player?.next(true)
        },
        {
          key: "ArrowLeft",
          modifiers: ["alt"],
          description: "上一首",
          callback: () => player?.last()
        },
        {
          key: "ArrowUp",
          description: "增加音量",
          callback: () => player?.upVolume?.(0.1)
        },
        {
          key: "ArrowDown",
          description: "减少音量",
          callback: () => player?.downVolume?.(0.1)
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
            Track.removeCache(id);
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
  // 注册频谱
  const { spectrumData, isReady } = useSpectrumWorker(
    audioRealRef,
    PlayerFSMStatus === PlayerFSMStatusEnum.playing,
    {
      fftSize: 2048,
      numBands: 32,
      withPeaks: false,
      ...SpectrumOptions
    }
  );
  useEffect(() => {
    SetSpectrumGetter(() => ({
      data: () => spectrumData.current,
      ready: isReady
    }));
  }, [SetSpectrumGetter, isReady, spectrumData]);
  // 注册任务栏回调
  useEffect(() => {
    const unsubscribeLast = Renderer.addMainProcessMessageHandler("lastTrack", () => {
      player?.last(true);
    });
    const unsubscribePlay = Renderer.addMainProcessMessageHandler("playTrack", () => {
      player?.play?.();
    });
    const unsubscribeNext = Renderer.addMainProcessMessageHandler("nextTrack", () => {
      player?.next(true);
    });
    return () => {
      unsubscribeLast();
      unsubscribePlay();
      unsubscribeNext();
    };
  }, [player]);
  useEffect(() => {
    Renderer.sendMessageToMainProcess(
      "playStatus",
      PlayerFSMStatus === PlayerFSMStatusEnum.playing
    );
  }, [PlayerFSMStatus]);
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
  }, [
    PlayerFSMStatus,
    PlayerTrackStatus?.audio,
    PlayingRequest,
    SetPlayingRequest,
    TriggerPlayerFSMEvent
  ]);

  // 处理初始音频源设置
  useEffect(() => {
    if (PlayerInitialized) {
      const audio = audioRealRef.current;
      const initSrc = PlayerTrackStatus?.audio;
      if (audio && initSrc) {
        audio.src = initSrc;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [PlayerInitialized]);
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
