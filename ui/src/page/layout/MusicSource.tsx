import { FC, memo, SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";
import { Player } from "@mahiru/ui/utils/player";
import { ShortcutConfig, useKeyboardShortcut } from "@mahiru/ui/hook/useKeyboardShortcut";
import { usePlayerResource } from "@mahiru/ui/hook/usePlayerResource";
import { useMediaSession } from "@mahiru/ui/hook/useMediaSession";
import { usePlayerStatus } from "@mahiru/ui/store";
import { useWindowTitle } from "@mahiru/ui/hook/useWindowTitle";
import { Log } from "@mahiru/ui/utils/dev";
import { Track } from "@mahiru/ui/utils/track";
import { Auth } from "@mahiru/ui/utils/auth";
import { useLogin } from "@mahiru/ui/hook/useLogout";
import { usePlayerAudio } from "@mahiru/ui/hook/usePlayerAudio";
import { useSpectrumWorker } from "@mahiru/ui/hook/useSpectrumWorker";

const MusicSource: FC<object> = () => {
  const {
    trackStatus,
    setAudioRef,
    audioControl,
    playerStatus,
    spectrumOptions,
    setSpectrumData,
    setSpectrumIsReady,
    isTyping
  } = usePlayerStatus([
    "trackStatus",
    "setAudioRef",
    "audioControl",
    "playerStatus",
    "spectrumOptions",
    "setSpectrumIsReady",
    "setSpectrumData",
    "isTyping"
  ]);
  // 初始化播放器
  useEffect(() => {
    Player.init();
  }, []);
  // 注册 Audio 元素引用
  const audioRealRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    setAudioRef(() => audioRealRef.current);
    return () => {
      setAudioRef(() => null);
    };
  }, [setAudioRef]);
  // 注册音频控制器
  usePlayerAudio();
  // 注册音频资源加载器
  usePlayerResource();
  // 注册 Media Session API
  useMediaSession({
    trackStatus,
    play: () => audioControl.current()?.play(),
    lastTrack: () => Player.last(true),
    nextTrack: () => Player.next(true)
  });
  // 注册局部键盘快捷键
  const [Shortcuts, setShortcuts] = useState<ShortcutConfig[]>([]);
  useKeyboardShortcut(Shortcuts);
  useEffect(() => {
    if (isTyping) {
      setShortcuts([
        {
          key: "ArrowRight",
          modifiers: ["alt"],
          description: "下一首",
          callback: () => Player.next(true)
        },
        {
          key: "ArrowLeft",
          modifiers: ["alt"],
          description: "上一首",
          callback: () => Player.last()
        },
        {
          key: "ArrowUp",
          description: "增加音量",
          callback: () => audioControl.current()?.upVolume(0.1)
        },
        {
          key: "ArrowDown",
          description: "减少音量",
          callback: () => audioControl.current()?.downVolume(0.1)
        }
      ]);
    } else {
      setShortcuts([
        {
          key: " ",
          description: "播放/暂停",
          callback: () => audioControl.current()?.play()
        },
        {
          key: "ArrowRight",
          modifiers: ["alt"],
          description: "下一首",
          callback: () => Player.next(true)
        },
        {
          key: "ArrowLeft",
          modifiers: ["alt"],
          description: "上一首",
          callback: () => Player.last()
        },
        {
          key: "ArrowUp",
          description: "增加音量",
          callback: () => audioControl.current()?.upVolume(0.1)
        },
        {
          key: "ArrowDown",
          description: "减少音量",
          callback: () => audioControl.current()?.downVolume(0.1)
        }
      ]);
    }
  }, [audioControl, isTyping]);
  // 注册窗口标题
  const { updateWindowTitle, defaultTitle } = useWindowTitle();
  useEffect(() => {
    const title = trackStatus?.track.name;
    const artist = trackStatus?.track.ar;
    if (title && artist) {
      updateWindowTitle(`${title} - ${artist.map((ar) => ar.name).join("&")}`);
    } else {
      updateWindowTitle(defaultTitle);
    }
  }, [defaultTitle, trackStatus?.track.ar, trackStatus?.track.name, updateWindowTitle]);
  // 处理音频加载错误
  const login = useLogin();
  const onError = useCallback(
    (err: SyntheticEvent<HTMLAudioElement>) => {
      const raw = trackStatus?.meta?.[0]?.url;
      if (raw) {
        if (err.currentTarget.src !== raw) {
          Log.info("ctx/PlayerProvider.tsx", "cache audio load error, fallback to raw src");
          err.currentTarget.src = raw;
          const id = trackStatus?.track.id;
          if (id) {
            Track.removeCache(id);
          }
        } else {
          Log.error("ctx/PlayerProvider.tsx", "audio playback error", err);
          if (!Auth.isAccountLoggedIn()) {
            audioControl.current()?.play();
            login();
          } else {
            // TODO: 播放错误，可能是403或网络错误，403应该重新登录或刷新缓存，网络错误则跳过当前歌曲
            Player.next(true);
          }
        }
      }
    },
    [audioControl, login, trackStatus?.meta, trackStatus?.track.id]
  );
  // 注册频谱
  const { spectrumData, isReady } = useSpectrumWorker(audioRealRef, playerStatus.playing, {
    fftSize: 2048,
    numBands: 32,
    withPeaks: false,
    ...spectrumOptions
  });
  useEffect(() => {
    setSpectrumData(() => spectrumData.current);
    setSpectrumIsReady(isReady);
  }, [isReady, setSpectrumData, setSpectrumIsReady, spectrumData]);

  return (
    <audio
      className="w-0 h-0 opacity-0"
      controls={false}
      autoPlay={false}
      ref={audioRealRef}
      src={trackStatus?.audio || undefined}
      preload="auto"
      onError={onError}
    />
  );
};
export default memo(MusicSource);
