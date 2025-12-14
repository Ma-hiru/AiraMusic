import { useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { usePlayerStatus } from "@mahiru/ui/store";
import { Player } from "@mahiru/ui/utils/player";
import { EqError, Log } from "@mahiru/ui/utils/dev";

let initialized = false;
let initialSeekTime: number | null = null;
let isApplyingInitialSeek = false;

export function usePlayerAudio() {
  const { playerProgress, trackStatus, setPlayerStatus, playerStatus, audioRef } = usePlayerStatus([
    "playerProgress",
    "trackStatus",
    "setPlayerStatus",
    "playerStatus",
    "audioRef"
  ]);

  const play = useCallback(() => {
    const audio = audioRef.current();
    audio && (audio.paused ? audio.play() : audio.pause());
  }, [audioRef]);
  const mute = useCallback(() => {
    const audio = audioRef.current();
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
      const audio = audioRef.current();
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
      const audio = audioRef.current();
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
      const audio = audioRef.current();
      if (!audio || !Number.isFinite(targetTime)) return;
      const duration = Number.isFinite(audio.duration)
        ? audio.duration
        : playerProgress.current().duration || 0;
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

  // 初始化 progress 和 volume 状态
  useLayoutEffect(() => {
    const audio = audioRef.current();
    if (!audio || !trackStatus || !trackStatus.audio) return;
    if (!initialized) {
      const cached = playerProgress.current();
      if (cached.currentTime && cached.currentTime !== audio.currentTime) {
        initialSeekTime = cached.currentTime;
        isApplyingInitialSeek = true;
      }
      initialized = true;
    }
    if (!playerStatus.playing) return;
    audio.src = trackStatus.audio;
    const handleCanPlay = () => {
      if (initialSeekTime && Number.isFinite(initialSeekTime)) {
        try {
          if (typeof audio.fastSeek === "function") {
            audio.fastSeek(initialSeekTime);
          } else {
            audio.currentTime = initialSeekTime;
          }
        } catch {
          audio.currentTime = initialSeekTime;
        } finally {
          initialSeekTime = null;
          isApplyingInitialSeek = false;
        }
      }
      audio.play().catch((err) => {
        Log.error(
          new EqError({
            raw: err,
            message: "play() failed after canplay",
            label: "ui/ctx/PlayerProvider:canPlay"
          })
        );
      });
    };
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("loadedmetadata", handleCanPlay);
    audio.load();
    return () => {
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("loadedmetadata", handleCanPlay);
    };
  }, [audioRef, playerProgress, playerStatus.playing, trackStatus]);
  // 监听 audio 播放状态变化
  useEffect(() => {
    const audio = audioRef.current();
    if (!audio) return;
    const handlePlay = () =>
      setPlayerStatus((draft) => {
        draft.playing = true;
      });
    const handlePause = () =>
      setPlayerStatus((draft) => {
        draft.playing = false;
      });
    const handleTimeUpdate = () => {
      if (isApplyingInitialSeek) return;
      playerProgress.current().currentTime = audio.currentTime;
      setPlayerStatus((draft) => {
        if (!draft.playing) {
          draft.playing = true;
        }
      });
    };
    const handleDurationChange = () => (playerProgress.current().duration = audio.duration || 0);
    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        playerProgress.current().buffered = audio.buffered.end(audio.buffered.length - 1);
      }
    };
    const handleVolumeChange = () =>
      setPlayerStatus((draft) => {
        draft.volume = audio.volume;
      });
    const handleEnded = () => Player.next(false);

    audio.addEventListener("play", handlePlay, { passive: true });
    audio.addEventListener("pause", handlePause, { passive: true });
    audio.addEventListener("ended", handleEnded, { passive: true });
    audio.addEventListener("timeupdate", handleTimeUpdate, { passive: true });
    audio.addEventListener("durationchange", handleDurationChange, { passive: true });
    audio.addEventListener("progress", handleProgress, { passive: true });
    audio.addEventListener("volumechange", handleVolumeChange, { passive: true });
    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("progress", handleProgress);
      audio.removeEventListener("volumechange", handleVolumeChange);
    };
  }, [audioRef, playerProgress, setPlayerStatus]);

  return useMemo(
    () => ({
      play,
      mute,
      upVolume,
      downVolume,
      changeCurrentTime,
      ref: audioRef
    }),
    [audioRef, changeCurrentTime, downVolume, mute, play, upVolume]
  );
}

export type AudioControl = ReturnType<typeof usePlayerAudio>;
