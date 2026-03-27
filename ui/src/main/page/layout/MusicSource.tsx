import { FC, memo, useEffect, useState } from "react";
import { useWindowTitle } from "@mahiru/ui/public/hooks/useWindowTitle";
import { ShortcutConfig, useKeyboardShortcut } from "@mahiru/ui/public/hooks/useKeyboardShortcut";
import { useMediaSession } from "@mahiru/ui/main/hooks/useMediaSession";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useSpectrumWorker } from "@mahiru/ui/main/hooks/useSpectrumWorker";
import { AppPlayerStatus } from "@mahiru/ui/public/entry/player";
import AppInstance from "@mahiru/ui/main/entry/instance";

const MusicSource: FC<object> = () => {
  const player = AppInstance.usePlayer();
  const { other, layout, updateLayout, updateOther } = useLayoutStore();
  // 注册窗口标题
  const { updateWindowTitle, defaultTitle } = useWindowTitle();
  useEffect(() => {
    const title = player.current.track?.name;
    const artist = player.current.track?.detail.artist?.().join("&");
    if (title && artist) {
      updateWindowTitle(`${title} - ${artist}`);
    } else {
      updateWindowTitle(defaultTitle);
    }
  }, [defaultTitle, player, updateWindowTitle]);
  // 注册局部键盘快捷键
  const [Shortcuts, setShortcuts] = useState<ShortcutConfig[]>([]);
  useKeyboardShortcut(Shortcuts);
  useEffect(() => {
    if (other.typing) {
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
          callback: () => updateLayout(layout.copy().setPlayModal(!layout.playModal))
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
  }, [layout, other.typing, player, updateLayout]);
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
  const { spectrumData, isReady } = useSpectrumWorker(
    player.audio.instance,
    player.status === AppPlayerStatus.playing,
    {
      fftSize: 2048,
      numBands: 32,
      withPeaks: false,
      fpsLimit: 60,
      ...(other.spectrumOptions() || {})
    }
  );
  useEffect(() => {
    updateOther(other.copy().setSpectrumData(spectrumData.current).setSpectrumReady(isReady));
  }, [isReady, other, spectrumData, updateOther]);

  return null;
};

export default memo(MusicSource);
