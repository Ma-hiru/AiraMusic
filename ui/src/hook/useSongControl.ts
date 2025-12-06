import { Dispatch, RefObject, SetStateAction, useCallback, useMemo, useRef, useState } from "react";
import { scrobble as requestScrobble } from "@mahiru/ui/api/track";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { PlayerTrackInfo } from "@mahiru/ui/ctx/PlayerCtx";
import { Lock } from "@mahiru/ui/hook/useLock";

type SongControl = {
  audioRef: RefObject<Nullable<HTMLAudioElement>>;
  info: PlayerTrackInfo;
  progress: RefObject<{ currentTime: number; duration: number; buffered: number; size: number }>;
  playList: PlayerTrackInfo[];
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  TransitionLock: Lock;
};

export function useSongControl({
  audioRef,
  info,
  progress,
  playList,
  setCurrentIndex,
  TransitionLock
}: SongControl) {
  Log.trace("useSongControl executed");
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const volumeBeforeMute = useRef(0.5);

  const play = useCallback(() => {
    const audio = audioRef.current;
    audio && (audio.paused ? audio.play() : audio.pause());
  }, [audioRef]);

  const scrobble = useCallback(() => {
    const source = info?.sourceID || info?.album?.id;
    source &&
      requestScrobble({
        id: info.id,
        sourceid: source,
        time: Math.floor(progress.current.currentTime)
      });
  }, [info?.album?.id, info.id, info?.sourceID, progress]);

  const nextTrack = useCallback(() => {
    if (!playList.length) return;
    TransitionLock.run(() => {
      setCurrentIndex((index) => {
        const nextIndex = index + 1;
        if (nextIndex >= playList.length) {
          return 0;
        }
        return nextIndex;
      });
    });
  }, [TransitionLock, playList.length, setCurrentIndex]);

  const autoNextTrack = useCallback(() => {
    if (isRepeat) {
      // 重复播放当前歌曲不会触发更新 currentIndex，所以需要手动scrobble
      scrobble();
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        try {
          void audio.play();
        } catch (err) {
          Log.error(
            new EqError({
              message: "play() failed in autoNextTrack with isRepeat",
              label: "ui/ctx/PlayerProvider:autoNextTrack",
              raw: err
            })
          );
        }
      }
    } else {
      nextTrack();
    }
  }, [audioRef, isRepeat, nextTrack, scrobble]);

  const lastTrack = useCallback(() => {
    if (!playList.length) return;
    TransitionLock.run(() => {
      setCurrentIndex((index) => {
        const lastIndex = index - 1;
        if (lastIndex < 0) {
          return playList.length - 1;
        }
        return lastIndex;
      });
    });
  }, [TransitionLock, playList.length, setCurrentIndex]);

  const mute = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !audio.muted;
      if (audio.muted) {
        volumeBeforeMute.current = audio.volume;
        audio.volume = 0;
      } else {
        audio.volume = volumeBeforeMute.current;
      }
    }
  }, [audioRef]);

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

  const shuffle = useCallback((enable?: boolean) => {
    setIsShuffle((prev) => (enable === undefined ? !prev : enable));
  }, []);

  const repeat = useCallback((enable?: boolean) => {
    setIsRepeat((prev) => (enable === undefined ? !prev : enable));
  }, []);

  const changeCurrentTime = useCallback(
    (targetTime: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(targetTime)) return;
      const duration = Number.isFinite(audio.duration)
        ? audio.duration
        : progress.current.duration || 0;
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
    [audioRef, progress]
  );

  return useMemo(
    () => ({
      play,
      scrobble,
      nextTrack,
      autoNextTrack,
      lastTrack,
      mute,
      upVolume,
      downVolume,
      shuffle,
      repeat,
      changeCurrentTime,
      isShuffle,
      isRepeat
    }),
    [
      autoNextTrack,
      changeCurrentTime,
      downVolume,
      isRepeat,
      isShuffle,
      lastTrack,
      mute,
      nextTrack,
      play,
      repeat,
      scrobble,
      shuffle,
      upVolume
    ]
  );
}
