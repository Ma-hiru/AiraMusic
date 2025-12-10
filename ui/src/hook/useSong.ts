import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FullVersionLyricLine } from "@mahiru/ui/utils/lyric";
import { useImmer } from "use-immer";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import {
  LyricVersionType,
  PlayerCtxDefault,
  PlayerCtxType,
  PlayerTrackInfo
} from "@mahiru/ui/ctx/PlayerCtx";
import { CacheStore, getPersistSnapshot } from "@mahiru/ui/store";
import { useMediaSession } from "@mahiru/ui/hook/useMediaSession";
import { useLock } from "@mahiru/ui/hook/useLock";
import { useKeyboardShortcut } from "@mahiru/ui/hook/useKeyboardShortcut";
import { shuffle as _shuffle } from "lodash-es";
import { useSongResource } from "@mahiru/ui/hook/useSongResource";
import { useSongControl } from "@mahiru/ui/hook/useSongControl";
import { useSongPlaylist } from "@mahiru/ui/hook/useSongPlaylist";

const { updatePlayHistory } = getPersistSnapshot();

export function useSong() {
  Log.trace("useSong executed");
  /**                        状态管理                         */
  const audioRef = useRef<HTMLAudioElement>(null);
  const [info, setInfo] = useImmer<PlayerTrackInfo>(PlayerCtxDefault.info);
  const [nextInfo, setNextInfo] = useState<Nullable<PlayerTrackInfo>>(PlayerCtxDefault.info);
  const [playList, setPlayList] = useImmer<PlayerTrackInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lyricLines, setLyricLines] = useState<FullVersionLyricLine>({
    full: [],
    raw: [],
    tl: [],
    rm: []
  });
  const [lyricVersion, setLyricVersion] = useState<LyricVersionType>("tl");
  const [volume, setVolume] = useState(PlayerCtxDefault.volume);
  const [infoFromCache, setInfoFromCache] = useState(false);
  const shuffledPlaylist = useRef<PlayerTrackInfo[]>([]);
  const progress = useRef(PlayerCtxDefault.getProgress());
  /**                        资源管理                         */
  const TransitionLock = useLock();
  const resourceControl = useSongResource({
    lyricVersion,
    setLyricLines,
    setLyricVersion,
    setInfo,
    progress
  });
  /**                        播放控制                         */
  const getProgress = useRef(() => progress.current).current;
  const audioControl = useSongControl({
    audioRef,
    setCurrentIndex,
    TransitionLock,
    playList,
    info,
    progress
  });
  /**                        播放列表                         */
  const playlistControl = useSongPlaylist({
    TransitionLock,
    currentIndex,
    setPlayList,
    isShuffle: audioControl.isShuffle,
    setInfo,
    playList,
    setCurrentIndex
  });
  /**                        状态变化                         */
  useLayoutEffect(() => {
    if (audioControl.isShuffle) {
      shuffledPlaylist.current = _shuffle(playList);
    } else if (!audioControl.isShuffle) {
      shuffledPlaylist.current = [];
    }
  }, [audioControl.isShuffle, playList]);
  // 监听 currentIndex 变化以切换歌曲
  useLayoutEffect(() => {
    let candidate = playList[currentIndex];
    let next = playList[currentIndex + 1] || null;
    if (candidate?.id === info.id) return;
    if (audioControl.isShuffle) {
      candidate = shuffledPlaylist.current[currentIndex];
      next = shuffledPlaylist.current[currentIndex + 1] || null;
    }
    if (candidate && candidate.id !== info.id) {
      setInfo(candidate);
      setNextInfo(next);
      // 预加载下一首歌曲信息
      if (!audioControl.isRepeat && !audioControl.isShuffle) {
        resourceControl.schedulePreloadNextTrack(candidate, next);
      } else {
        resourceControl.cancelScheduledPreload();
      }
      void resourceControl.loadLyric(candidate.id);
      candidate.raw && updatePlayHistory(candidate.raw);
      audioControl.scrobble();
    } else if (!candidate) {
      resourceControl.cancelScheduledPreload();
    }
    TransitionLock.unlock();
  }, [
    currentIndex,
    resourceControl.cancelScheduledPreload,
    info.id,
    audioControl.isRepeat,
    audioControl.isShuffle,
    resourceControl.loadLyric,
    playList,
    resourceControl.schedulePreloadNextTrack,
    audioControl.scrobble,
    setInfo,
    TransitionLock,
    resourceControl,
    audioControl
  ]);
  // 监听 info.id 变化以加载音频地址
  useLayoutEffect(() => {
    if (info.id !== 0 && info.audio === "") {
      void resourceControl.loadAudioSource(info.id);
    }
  }, [info.audio, info.id, resourceControl, resourceControl.loadAudioSource]);
  // 监听 info.audio 地址变化以播放音频
  useLayoutEffect(() => {
    const audio = audioRef.current;
    if (!audio || !info.audio || infoFromCache) {
      setInfoFromCache(false);
      return;
    }
    audio.src = info.audio;
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
  }, [info.audio, infoFromCache]);
  // 初始化 progress 和 volume 状态
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsPlaying(!audio.paused);
    progress.current.duration = audio.duration || 0;
    progress.current.currentTime = audio.currentTime;
    setVolume(audio.volume);
    if (audio.buffered.length > 0) {
      progress.current.buffered = audio.buffered.end(audio.buffered.length - 1);
    }
  }, []);
  // 监听 audio 播放状态变化
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => (progress.current.currentTime = audio.currentTime);
    const handleDurationChange = () => (progress.current.duration = audio.duration || 0);
    // 缓冲进度
    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        progress.current.buffered = audio.buffered.end(audio.buffered.length - 1);
      }
    };
    const handleVolumeChange = () => setVolume(audio.volume);
    audio.addEventListener("play", handlePlay, { passive: true });
    audio.addEventListener("pause", handlePause, { passive: true });
    audio.addEventListener("ended", audioControl.autoNextTrack, { passive: true });
    audio.addEventListener("timeupdate", handleTimeUpdate, { passive: true });
    audio.addEventListener("durationchange", handleDurationChange, { passive: true });
    audio.addEventListener("progress", handleProgress, { passive: true });
    audio.addEventListener("volumechange", handleVolumeChange, { passive: true });
    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", audioControl.autoNextTrack);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("progress", handleProgress);
      audio.removeEventListener("volumechange", handleVolumeChange);
    };
  }, [audioControl.autoNextTrack, audioControl.mute]);
  // 从缓存中恢复播放状态
  useEffect(() => {
    if (info.id === PlayerCtxDefault.info.id) {
      CacheStore.fetchObject<{ info: typeof info; progress: ReturnType<typeof getProgress> }>(
        "playerInfo"
      )
        .then((cache) => {
          TransitionLock.run(() => {
            if (cache && cache.info.id !== info.id) {
              const { info, progress } = cache;
              setInfo(info);
              progress.currentTime && audioControl.changeCurrentTime(progress.currentTime);
              setInfoFromCache(true);
            }
          }, true);
        })
        .catch();
    }
    // eslint-disable-next-line
  }, []);
  /**                    Media Session API                 */
  useMediaSession({
    info,
    nextTrack: audioControl.nextTrack,
    lastTrack: audioControl.lastTrack,
    play: audioControl.play
  });
  /**                        快捷键                         */
  useKeyboardShortcut([
    {
      key: " ",
      description: "播放/暂停",
      callback: audioControl.play
    },
    {
      key: "ArrowRight",
      modifiers: ["alt"],
      description: "下一首",
      callback: audioControl.nextTrack
    },
    {
      key: "ArrowLeft",
      modifiers: ["alt"],
      description: "上一首",
      callback: audioControl.lastTrack
    },
    {
      key: "ArrowUp",
      description: "增加音量",
      callback: () => audioControl.upVolume(0.05)
    },
    {
      key: "ArrowDown",
      description: "减少音量",
      callback: () => audioControl.downVolume(0.05)
    }
  ]);
  /**                        返回值                         */
  return useMemo<PlayerCtxType>(
    () => ({
      ...audioControl,
      ...playlistControl,
      setInfo,
      setPlayList,
      setCurrentIndex,
      getProgress,
      setLyricVersion,
      audioRef,
      lyricLines,
      info,
      nextInfo,
      currentIndex,
      isPlaying,
      playList,
      lyricVersion,
      volume
    }),
    [
      audioControl,
      currentIndex,
      getProgress,
      info,
      isPlaying,
      lyricLines,
      lyricVersion,
      nextInfo,
      playList,
      playlistControl,
      setInfo,
      setPlayList,
      volume
    ]
  );
}
