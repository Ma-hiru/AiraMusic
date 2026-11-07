import { useMemo } from "react";
import { useSetAtom } from "jotai";
import { playModalAtom } from "@/wins/main/atoms/layout";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import type { ShortcutAction } from "@/common/constants/shortcut";

/** 快捷键动作表：主窗口本地按键与其他窗口转发来的快捷键共用同一份实现 */
export function useShortcutActions() {
  const player = RendererPlayerHandle.usePlayer();
  const setPlayModal = useSetAtom(playModalAtom);

  return useMemo<Record<ShortcutAction, () => void>>(
    () => ({
      playToggle: () => (player.audio.paused ? player.audio.play() : player.audio.pause()),
      prevTrack: () => player.playlist.last(),
      nextTrack: () => player.playlist.next(true),
      volumeUp: () => (player.audio.volume += 0.1),
      volumeDown: () => (player.audio.volume -= 0.1),
      muteToggle: () => (player.audio.instance.muted ? player.audio.unmute() : player.audio.mute()),
      playModalToggle: () => setPlayModal((playModal) => !playModal)
    }),
    [player.audio, player.playlist, setPlayModal]
  );
}
