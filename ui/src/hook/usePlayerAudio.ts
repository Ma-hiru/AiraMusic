import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePlayerStatus } from "@mahiru/ui/store";
import { Player } from "@mahiru/ui/utils/player";
import { EqError, Log } from "@mahiru/ui/utils/dev";

let initialized = false;

/**
 * 音频控制
 * - 监听zustand的audioRef变化，绑定audio元素的各种事件，更新播放进度、播放状态、音量等信息到zustand
 * - 提供播放/暂停、静音/取消静音、音量调节、跳转播放时间等方法
 * */
export function usePlayerAudio() {
  const { playerProgress, trackStatus, setPlayerStatus, playerStatus, audioRef, setAudioControl } =
    usePlayerStatus([
      "playerProgress",
      "trackStatus",
      "setPlayerStatus",
      "playerStatus",
      "audioRef",
      "setAudioControl"
    ]);
  const lastTrackIdRef = useRef<Nullable<number>>(null);
  const lastAudioSrcRef = useRef<Nullable<string>>(null);

  const play = useCallback(() => {
    const audio = audioRef.current();
    audio && (audio.paused ? audio.play() : audio.pause());
  }, [audioRef]);

  const mute = useCallback(() => {
    const audio = audioRef.current();
    if (!audio) return;
    audio.muted = !audio.muted;
    if (audio.muted) {
      setPlayerStatus((draft) => {
        draft.volumeBeforeMute = audio.volume;
      });
      audio.volume = 0;
    } else {
      audio.volume = playerStatus.volumeBeforeMute;
    }
  }, [audioRef, playerStatus.volumeBeforeMute, setPlayerStatus]);

  const upVolume = useCallback(
    (gap?: number) => {
      const audio = audioRef.current();
      if (!audio) return;
      gap ||= 0.2;
      audio.volume = Math.min(1, audio.volume + gap);
      audio.volume > 0 && audio.muted && (audio.muted = false);
    },
    [audioRef]
  );

  const downVolume = useCallback(
    (gap?: number) => {
      const audio = audioRef.current();
      if (!audio) return;
      gap ||= 0.2;
      audio.volume = Math.max(0, audio.volume - gap);
      audio.volume > 0 && audio.muted && (audio.muted = false);
    },
    [audioRef]
  );

  const changeCurrentTime = useCallback(
    (targetTime: number) => {
      const audio = audioRef.current();
      if (!audio || !Number.isFinite(targetTime)) return;
      // 确保跳转时间在合法范围内 0 ~ duration 之间
      const clamped = Math.max(
        0,
        Math.min(audio.duration > 0 ? audio.duration : targetTime, targetTime)
      );
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
    [audioRef]
  );
  // 自动加载
  useEffect(() => {
    const audio = audioRef.current();
    if (!audio || !trackStatus || !trackStatus.audio) return;
    const trackId = trackStatus.track.id;
    const nextAudioSrc = trackStatus.audio;
    const shouldReloadTrack =
      trackId !== lastTrackIdRef.current || nextAudioSrc !== lastAudioSrcRef.current;

    if (shouldReloadTrack) {
      audio.src = nextAudioSrc;
      audio.load();
      lastTrackIdRef.current = trackId;
      lastAudioSrcRef.current = nextAudioSrc;
    }

    const handleCanPlay = () => {
      if (playerStatus.playing) {
        audio.play().catch((err) => {
          Log.error(
            new EqError({
              raw: err,
              message: "play() failed after canplay",
              label: "ui/ctx/PlayerProvider:canPlay"
            })
          );
        });
      }
    };

    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("loadedmetadata", handleCanPlay);
    return () => {
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("loadedmetadata", handleCanPlay);
    };
  }, [audioRef, playerProgress, playerStatus.playing, playerStatus.volume, trackStatus]);
  // 从缓存恢复进度
  useEffect(() => {
    if (initialized) return;
    const audio = audioRef.current();
    if (!audio) return;
    const cachedProgress = playerProgress.current();
    const cachedVolume = playerStatus.volume;
    if (cachedProgress.currentTime && cachedProgress.currentTime !== audio.currentTime) {
      audio.volume = cachedVolume;
      audio.fastSeek?.(cachedProgress.currentTime);
      audio.currentTime = cachedProgress.currentTime;
    }
    initialized = true;
    // 排除 playerStatus.volume
    // eslint-disable-next-line
  }, [audioRef, playerProgress]);
  // 监听 audio 播放状态变化
  useEffect(() => {
    const audio = audioRef.current();
    if (!audio) return;

    const handlePlay = () =>
      setPlayerStatus((draft) => {
        if (!draft.playing) draft.playing = true;
      });
    const handlePause = () =>
      setPlayerStatus((draft) => {
        if (draft.playing) draft.playing = false;
      });
    const handleTimeUpdate = () => {
      if (!initialized) return;
      playerProgress.current().currentTime = audio.currentTime;
      setPlayerStatus((draft) => {
        if (!draft.playing) draft.playing = true;
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

  const Audio = useMemo(
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

  // 注册 Audio 控制器到全局状态
  useEffect(() => {
    setAudioControl(() => Audio);
    return () => {
      setAudioControl(() => null);
    };
  }, [Audio, setAudioControl]);

  return Audio;
}

export type AudioControl = ReturnType<typeof usePlayerAudio>;
