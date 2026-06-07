import { type FC, memo, useEffect, useState } from "react";
import { type ShortcutConfig, useKeyboardShortcut } from "@/common/hooks/use-keyboard-shortcut";
import { useMediaSession } from "@/wins/main/hooks/use-media-session";
import { useSpectrumWorker } from "@/wins/main/hooks/use-spectrum-worker";
import { useAtomValue, useSetAtom } from "jotai";
import {
  spectrumDataAtom,
  spectrumOptionsAtom,
  spectrumReadyAtom
} from "@/wins/main/atoms/spectrum";
import { playModalAtom, typingAtom } from "@/wins/main/atoms/layout";
import RendererPlayerHandle from "@/wins/main/lib/handle";

const MusicSource: FC<object> = () => {
  const player = RendererPlayerHandle.usePlayer();
  const title = player.current.track?.name;
  const artist = player.current.track?.detail.artist?.join("&");

  // 注册窗口标题
  useEffect(() => {
    if (title && artist) {
      document.title = `${title} - ${artist}`;
    } else {
      document.title = import.meta.env.APP_NAME;
    }
  }, [artist, title]);
  // 注册局部键盘快捷键
  const setPlayModal = useSetAtom(playModalAtom);
  const typing = useAtomValue(typingAtom);
  const [Shortcuts, setShortcuts] = useState<ShortcutConfig[]>([]);
  useKeyboardShortcut(Shortcuts);
  useEffect(() => {
    if (typing) {
      setShortcuts([
        {
          key: "ArrowRight",
          modifiers: ["alt"],
          description: "下一首",
          callback: () => player.playlist.next(true)
        },
        {
          key: "ArrowLeft",
          modifiers: ["alt"],
          description: "上一首",
          callback: () => player.playlist.last()
        },
        {
          key: "ArrowUp",
          description: "增加音量",
          callback: () => (player.audio.volume += 0.1)
        },
        {
          key: "ArrowDown",
          description: "减少音量",
          callback: () => (player.audio.volume -= 0.1)
        },
        {
          key: "M",
          description: "静音/取消静音",
          callback: () => player.audio.mute()
        },
        {
          key: "M",
          description: "切换播放页",
          modifiers: ["alt"],
          callback: () => setPlayModal((playModal) => !playModal)
        }
      ]);
    } else {
      setShortcuts((shortcuts) => {
        return [
          ...shortcuts,
          {
            key: " ",
            description: "播放/暂停",
            callback: () => (player.audio.paused ? player.audio.play() : player.audio.pause())
          }
        ];
      });
    }
  }, [player.audio, player.playlist, setPlayModal, typing]);
  // 禁 Tab 键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Tab" && e.preventDefault();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  // 注册 Media Session API
  useMediaSession({
    play: () => player.audio.play(),
    pause: () => player.audio.pause(),
    lastTrack: () => player.playlist.last(true),
    nextTrack: () => player.playlist.next(true),
    seekForward: (gap) => (player.audio.currentTime += gap),
    seekBackward: (gap) => (player.audio.currentTime += gap),
    seekTo: (time) => (player.audio.currentTime = time),
    changeTime: (time) => (player.audio.currentTime = time),
    mute: () => player.audio.mute(),
    unmute: () => player.audio.unmute()
  });
  // 注册频谱
  const setSpectrumData = useSetAtom(spectrumDataAtom);
  const setSpectrumReady = useSetAtom(spectrumReadyAtom);
  const spectrumOptions = useAtomValue(spectrumOptionsAtom);
  const { spectrumData, isReady } = useSpectrumWorker(player.audio, player.playing, {
    fftSize: 2048,
    numBands: 32,
    withPeaks: false,
    ...spectrumOptions
  });
  useEffect(() => {
    setSpectrumData(spectrumData.current);
    setSpectrumReady(isReady);
  }, [isReady, setSpectrumData, setSpectrumReady, spectrumData]);

  return null;
};

export default memo(MusicSource);
