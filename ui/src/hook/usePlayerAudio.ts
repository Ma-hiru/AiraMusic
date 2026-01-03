import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { PlayerFSMStatusEnum, usePlayerStore } from "@mahiru/ui/store/player";

/**
 * 音频控制
 * - 监听zustand的audioRef变化，绑定audio元素的各种事件，更新播放进度、播放状态、音量等信息到zustand
 * - 提供播放/暂停、静音/取消静音、音量调节、跳转播放时间等方法
 * */
export function usePlayerAudio() {
  const {
    PlayerStatus,
    AudioRefGetter,
    PlayerInitialized,
    PlayerProgressGetter,
    SetAudioControlGetter,
    PlayerFSMStatus,
    PlayerCoreGetter,
    SetPlayerStatus,
    SetPlayingRequest
  } = usePlayerStore([
    "PlayerStatus",
    "AudioRefGetter",
    "PlayerInitialized",
    "PlayerProgressGetter",
    "SetAudioControlGetter",
    "PlayerFSMStatus",
    "PlayerCoreGetter",
    "SetPlayerStatus",
    "SetPlayingRequest"
  ]);
  const volumeBeforeMute = useRef(PlayerStatus.volume);
  const audio = AudioRefGetter();
  const player = PlayerCoreGetter();

  const play = useCallback(() => {
    if (audio) {
      const shouldPlay = audio.paused;
      SetPlayingRequest(shouldPlay);
    }
  }, [SetPlayingRequest, audio]);

  const pause = useCallback(() => {
    SetPlayingRequest(false);
  }, [SetPlayingRequest]);

  const mute = useCallback(() => {
    if (!audio) return;
    audio.muted = !audio.muted;
    if (audio.muted) {
      volumeBeforeMute.current = audio.volume;
      audio.volume = 0;
    } else {
      audio.volume = volumeBeforeMute.current;
    }
  }, [audio]);

  const upVolume = useCallback(
    (gap?: number) => {
      if (!audio) return;
      gap ||= 0.2;
      audio.volume = Math.min(1, audio.volume + gap);
      audio.volume > 0 && audio.muted && (audio.muted = false);
    },
    [audio]
  );

  const downVolume = useCallback(
    (gap?: number) => {
      if (!audio) return;
      gap ||= 0.2;
      audio.volume = Math.max(0, audio.volume - gap);
      audio.volume > 0 && audio.muted && (audio.muted = false);
    },
    [audio]
  );

  const changeCurrentTime = useCallback(
    (targetTime: number) => {
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
    [audio]
  );

  // 从缓存恢复音量
  useLayoutEffect(() => {
    if (PlayerInitialized) {
      if (!audio) return;
      audio.volume = PlayerStatus.volume;
      changeCurrentTime(PlayerProgressGetter().currentTime);
    }
    // eslint-disable-next-line
  }, [PlayerInitialized]);
  // 监听 audio 播放状态变化
  useEffect(() => {
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!PlayerInitialized) return;
      PlayerProgressGetter().currentTime = audio.currentTime;
    };
    const handleDurationChange = () => (PlayerProgressGetter().duration = audio.duration || 0);
    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        PlayerProgressGetter().buffered = audio.buffered.end(audio.buffered.length - 1);
      }
    };
    const handleVolumeChange = () =>
      SetPlayerStatus((draft) => {
        draft.volume = audio.volume;
      });
    const handleEnded = () => player?.next(false);

    audio.addEventListener("ended", handleEnded, { passive: true });
    audio.addEventListener("timeupdate", handleTimeUpdate, { passive: true });
    audio.addEventListener("durationchange", handleDurationChange, { passive: true });
    audio.addEventListener("progress", handleProgress, { passive: true });
    audio.addEventListener("volumechange", handleVolumeChange, { passive: true });
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("progress", handleProgress);
      audio.removeEventListener("volumechange", handleVolumeChange);
    };
  }, [PlayerInitialized, PlayerProgressGetter, SetPlayerStatus, audio, player]);
  // 根据 FSM 状态自动播放或暂停
  useEffect(() => {
    if (PlayerFSMStatus === PlayerFSMStatusEnum.playing) {
      // 检查 src 是否是有效的音频 URL（排除页面 URL）
      const src = audio?.src || "";
      const isValidAudioSrc =
        src && !src.startsWith("http://localhost") && !src.startsWith("https://localhost");
      if (audio && isValidAudioSrc) {
        audio.play().catch();
      }
    } else {
      audio && audio.pause();
    }
  }, [PlayerFSMStatus, audio]);

  const Audio = useMemo(
    () => ({
      play,
      pause,
      mute,
      upVolume,
      downVolume,
      changeCurrentTime
    }),
    [changeCurrentTime, downVolume, mute, pause, play, upVolume]
  );

  // 注册 Audio 控制器到全局状态
  useEffect(() => {
    SetAudioControlGetter(() => Audio);
    return () => {
      SetAudioControlGetter(() => null);
    };
  }, [Audio, SetAudioControlGetter]);

  return Audio;
}

export type AudioControl = ReturnType<typeof usePlayerAudio>;
