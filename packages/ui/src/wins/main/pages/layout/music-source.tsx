import { useSetAtom, useAtomValue } from "jotai";
import { memo, type FC, useMemo, useEffect } from "react";
import { RendererWindow } from "@/common/lib/window";
import { useSettings } from "@/common/store/settings";
import { useRoamMode } from "@/wins/main/hooks/use-roam-mode";
import { typingAtom, playModalAtom } from "@/wins/main/atoms/layout";
import { useMediaSession } from "@/wins/main/hooks/use-media-session";
import { useSpectrumWorker } from "@/wins/main/hooks/use-spectrum-worker";
import { useIntelligenceMode } from "@/wins/main/hooks/use-intelligence-mode";
import { type ShortcutAction, RendererShortcutConstants } from "@/common/constants/shortcut";
import { type ShortcutConfig, useKeyboardShortcut } from "@/common/hooks/use-keyboard-shortcut";
import {
  spectrumDataAtom,
  spectrumReadyAtom,
  spectrumOptionsAtom
} from "@/wins/main/atoms/spectrum";
import RendererPlayerHandle from "@/wins/main/lib/handle";

const MusicSource: FC<object> = () => {
  const player = RendererPlayerHandle.usePlayer();
  const title = player.current.track?.name;
  const artist = player.current.track?.detail.artist?.join("&");

  // 处理漫游模式
  useRoamMode();
  // 处理心动模式
  useIntelligenceMode();
  // 注册窗口标题
  useEffect(() => {
    let title;
    if (title && artist) {
      title = `${title} - ${artist}`;
    } else {
      title = import.meta.env.APP_NAME;
    }
    window.document.title = title;
    RendererWindow.current.title(title);
  }, [artist, title]);
  // 注册局部键盘快捷键（绑定可在设置中自定义）
  const setPlayModal = useSetAtom(playModalAtom);
  const typing = useAtomValue(typingAtom);
  const shortcuts = useSettings().shortcuts;
  const shortcutConfigs = useMemo<ShortcutConfig[]>(() => {
    const actions: Record<ShortcutAction, () => void> = {
      playToggle: () => (player.audio.paused ? player.audio.play() : player.audio.pause()),
      prevTrack: () => player.playlist.last(),
      nextTrack: () => player.playlist.next(true),
      volumeUp: () => (player.audio.volume += 0.1),
      volumeDown: () => (player.audio.volume -= 0.1),
      muteToggle: () => (player.audio.instance.muted ? player.audio.unmute() : player.audio.mute()),
      playModalToggle: () => setPlayModal((playModal) => !playModal)
    };
    return (
      (Object.keys(actions) as ShortcutAction[])
        // 输入框聚焦时只保留带修饰键的组合，避免吞掉正常输入
        .filter((action) => !typing || (shortcuts[action].modifiers?.length ?? 0) > 0)
        .map((action) => ({
          ...shortcuts[action],
          description: RendererShortcutConstants.actionLabels[action],
          callback: actions[action]
        }))
    );
  }, [player.audio, player.playlist, setPlayModal, shortcuts, typing]);
  useKeyboardShortcut(shortcutConfigs);
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
    seekBackward: (gap) => (player.audio.currentTime -= gap),
    seekTo: (time) => (player.audio.currentTime = time),
    changeTime: (time) => (player.audio.currentTime = time)
  });
  // 注册频谱
  const setSpectrumData = useSetAtom(spectrumDataAtom);
  const setSpectrumReady = useSetAtom(spectrumReadyAtom);
  const spectrumOptions = useAtomValue(spectrumOptionsAtom);
  const { isReady, spectrumData } = useSpectrumWorker(player.audio, player.playing, {
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
