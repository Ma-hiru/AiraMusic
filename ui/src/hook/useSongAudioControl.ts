import { RefObject, useCallback, useMemo } from "react";
import { Updater } from "use-immer";

export function useSongAudioControl(props: {
  audioRef: RefObject<Nullable<HTMLAudioElement>>;
  playerStatus: PlayerStatus;
  setPlayerStatus: Updater<PlayerStatus>;
  playerProgress: RefObject<PlayerProgress>;
}) {
  const { audioRef, playerStatus, setPlayerStatus, playerProgress } = props;
  const play = useCallback(() => {
    const audio = audioRef.current;
    audio && (audio.paused ? audio.play() : audio.pause());
  }, [audioRef]);
  const mute = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !audio.muted;
      if (audio.muted) {
        setPlayerStatus((draft) => {
          draft.volumeBeforeMute = audio.volume;
        });
        audio.volume = 0;
      } else {
        audio.volume = playerStatus.volumeBeforeMute;
      }
    }
  }, [audioRef, playerStatus.volumeBeforeMute, setPlayerStatus]);
  const upVolume = useCallback(
    (gap?: number) => {
      const audio = audioRef.current;
      if (audio) {
        gap ||= 0.2;
        audio.volume = Math.min(1, audio.volume + gap);
        audio.volume > 0 && audio.muted && (audio.muted = false);
      }
    },
    [audioRef]
  );
  const downVolume = useCallback(
    (gap?: number) => {
      const audio = audioRef.current;
      if (audio) {
        gap ||= 0.2;
        audio.volume = Math.max(0, audio.volume - gap);
        audio.volume > 0 && audio.muted && (audio.muted = false);
      }
    },
    [audioRef]
  );
  const changeCurrentTime = useCallback(
    (targetTime: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(targetTime)) return;
      const duration = Number.isFinite(audio.duration)
        ? audio.duration
        : playerProgress.current.duration || 0;
      // 确保跳转时间在合法范围内 0 ~ duration 之间
      const clamped = Math.max(0, Math.min(duration > 0 ? duration : targetTime, targetTime));
      try {
        if (typeof audio.fastSeek === "function") {
          audio.fastSeek(clamped);
        } else {
          audio.currentTime = clamped;
        }
      } catch {
        audio.currentTime = clamped;
      }
    },
    [audioRef, playerProgress]
  );

  return useMemo(
    () => ({
      play,
      mute,
      upVolume,
      downVolume,
      changeCurrentTime
    }),
    [changeCurrentTime, downVolume, mute, play, upVolume]
  );
}
