import { RefObject, useMemo } from "react";
import { usePlayerResource } from "@mahiru/ui/hook/usePlayerResource";
import { useMediaSession } from "@mahiru/ui/hook/useMediaSession";
import { useKeyboardShortcut } from "@mahiru/ui/hook/useKeyboardShortcut";
import { usePlayerAudio } from "@mahiru/ui/hook/usePlayerAudio";
import { usePlayerStatus } from "@mahiru/ui/store";
import { Player } from "@mahiru/ui/utils/player";

export function usePlayerBind(audioRef: RefObject<Nullable<HTMLAudioElement>>) {
  /**                        状态管理                         */
  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  /**                        播放控制                         */
  const Audio = usePlayerAudio(audioRef);
  /**                        资源管理                         */
  usePlayerResource();
  /**                    Media Session API                 */
  useMediaSession({
    trackStatus,
    play: Audio.play,
    lastTrack: Player.last,
    nextTrack: Player.next
  });
  /**                        快捷键                         */
  useKeyboardShortcut([
    {
      key: " ",
      description: "播放/暂停",
      callback: () => Audio.play()
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
      callback: () => Audio.upVolume(0.1)
    },
    {
      key: "ArrowDown",
      description: "减少音量",
      callback: () => Audio.downVolume(0.1)
    }
  ]);
  return useMemo(
    () => ({
      Audio,
      Player
    }),
    [Audio]
  );
}
