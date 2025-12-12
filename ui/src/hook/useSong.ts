import { RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useImmer } from "use-immer";
import { useSongResource } from "@mahiru/ui/hook/useSongResource";
import { scrobble as requestScrobble } from "@mahiru/ui/api/track";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { useMediaSession } from "@mahiru/ui/hook/useMediaSession";
import { useKeyboardShortcut } from "@mahiru/ui/hook/useKeyboardShortcut";
import { useSongAudioControl } from "@mahiru/ui/hook/useSongAudioControl";
import { useSongPlaylistControl } from "@mahiru/ui/hook/useSongPlaylistControl";
import { Lyric } from "@mahiru/ui/utils/lyric";
import { useDynamicZustandShallowStore } from "@mahiru/ui/store";

export function useSong(audioRef: RefObject<Nullable<HTMLAudioElement>>) {
  /**                        状态管理                         */
  const playerProgress = useRef<PlayerProgress>({
    buffered: 0,
    currentTime: 0,
    duration: 0,
    size: 0
  });
  const [trackStatus, setTrackStatus] = useImmer<Nullable<PlayerTrackStatus>>(null);
  const { playerStatus, setPlayerStatus } = useDynamicZustandShallowStore([
    "playerStatus",
    "setPlayerStatus"
  ]);
  /**                        播放控制                         */
  const scrobble = useCallback((lastStatus: PlayerTrackStatus) => {
    const source = lastStatus?.source || lastStatus?.track?.al?.id;
    source &&
      requestScrobble({
        id: lastStatus.track.id,
        sourceid: source,
        time: Math.floor(playerProgress.current.currentTime)
      });
  }, []);
  const beforeTrackUpdate = useCallback(
    (next: Nullable<PlayerTrackStatus>) => {
      if (trackStatus && trackStatus.track.id !== next?.track.id) {
        scrobble(trackStatus);
        setPlayerStatus((draft) => {
          if (draft.playing) {
            draft.playing = false;
          }
        });
      }
    },
    [scrobble, setPlayerStatus, trackStatus]
  );
  const setLyricVersion = useCallback(
    (next: LyricVersionType) => {
      const chosenVersion = Lyric.checkLyricVersion(
        trackStatus?.lyric,
        next,
        playerStatus.lyricVersion
      );
      setPlayerStatus((draft) => {
        draft.lyricVersion = chosenVersion;
        draft.lyricPreference = next;
      });
    },
    [playerStatus.lyricVersion, setPlayerStatus, trackStatus?.lyric]
  );
  const audioControl = useSongAudioControl({ audioRef, playerProgress });
  const playlistControl = useSongPlaylistControl({
    outerTrackUpdater: setTrackStatus,
    outerStatusUpdater: setPlayerStatus,
    beforeTrackUpdate
  });
  /**                        资源管理                         */
  useSongResource({
    playerProgress,
    setTrackStatus,
    trackStatus,
    playlistManager: playlistControl.playlistManager
  });
  const clearResourceCache = useCallback(
    (type: "audio" | "lyric") => {
      setTrackStatus((draft) => {
        if (!draft) return;
        if (type === "audio") {
          draft.audio = "";
          draft.meta = [];
        } else if (type === "lyric") {
          draft.lyric = {
            tl: [],
            rm: [],
            raw: [],
            full: []
          };
        }
      });
    },
    [setTrackStatus]
  );
  /**                        状态变化                         */
  // 初始化 progress 和 volume 状态
  useLayoutEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    playerProgress.current.duration = audio.duration || 0;
    playerProgress.current.currentTime = audio.currentTime;
    setPlayerStatus((draft) => {
      draft.playing = !audio.paused;
      draft.volume = audio.volume;
    });
    if (audio.buffered.length > 0) {
      playerProgress.current.buffered = audio.buffered.end(audio.buffered.length - 1);
    }
  }, [audioRef, setPlayerStatus]);
  useLayoutEffect(() => {
    const audio = audioRef.current;
    if (!audio || !trackStatus || !trackStatus.audio || !playerStatus.playing) return;
    audio.src = trackStatus.audio;
    const handleCanPlay = () => {
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
    audio.load();
    return () => {
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [audioRef, playerStatus.playing, trackStatus]);
  // 监听 audio 播放状态变化
  useEffect(() => {
    const audio = audioRef.current;
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
      playerProgress.current.currentTime = audio.currentTime;
      setPlayerStatus((draft) => {
        if (!draft.playing) {
          draft.playing = true;
        }
      });
    };
    const handleDurationChange = () => (playerProgress.current.duration = audio.duration || 0);
    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        playerProgress.current.buffered = audio.buffered.end(audio.buffered.length - 1);
      }
    };
    const handleVolumeChange = () =>
      setPlayerStatus((draft) => {
        draft.volume = audio.volume;
      });
    const handleEnded = () => playlistControl.nextTrack(false);

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
  }, [audioRef, playlistControl, setPlayerStatus]);
  /**                    Media Session API                 */
  useMediaSession({
    trackStatus,
    play: audioControl.play,
    lastTrack: playlistControl.lastTrack,
    nextTrack: playlistControl.nextTrack
  });
  /**                        快捷键                         */
  useKeyboardShortcut([
    {
      key: " ",
      description: "播放/暂停",
      callback: () => audioControl.play()
    },
    {
      key: "ArrowRight",
      modifiers: ["alt"],
      description: "下一首",
      callback: () => playlistControl.nextTrack(true)
    },
    {
      key: "ArrowLeft",
      modifiers: ["alt"],
      description: "上一首",
      callback: () => playlistControl.lastTrack()
    },
    {
      key: "ArrowUp",
      description: "增加音量",
      callback: () => audioControl.upVolume(0.1)
    },
    {
      key: "ArrowDown",
      description: "减少音量",
      callback: () => audioControl.downVolume(0.1)
    }
  ]);
  const getPlayerProgress = useRef(() => playerProgress.current).current;
  return useMemo(
    () => ({
      trackStatus,
      getPlayerProgress,
      audioControl,
      playlistControl,
      setLyricVersion,
      clearResourceCache,
      audioRef
    }),
    [
      audioControl,
      audioRef,
      clearResourceCache,
      getPlayerProgress,
      playlistControl,
      setLyricVersion,
      trackStatus
    ]
  );
}
