import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  RefObject
} from "react";
import { FullVersionLyricLine, handleNeteaseLyricResponse } from "@mahiru/ui/utils/lyric";
import { getMP3, scrobble as requestScrobble } from "@mahiru/ui/api/track";
import { useImmer, Updater } from "use-immer";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { LyricVersionType, PlayerCtxDefault, PlayerTrackInfo } from "@mahiru/ui/ctx/PlayerCtx";
import { getPersistSnapshot, Store } from "@mahiru/ui/store";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { getYRCLyric } from "@mahiru/ui/api/lyric";
import { useMediaSession } from "@mahiru/ui/hook/useMediaSession";
import { useLock } from "@mahiru/ui/hook/useLock";

const { updatePlayHistory } = getPersistSnapshot();
const AUDIO_CACHE_PREFIX = "audio_";

type PlayerProgress = ReturnType<typeof PlayerCtxDefault.getProgress>;
type AudioMeta = {
  url: string;
  size?: number;
};

export function useSong() {
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
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const volumeBeforeMute = useRef(volume);
  const TransitionLock = useLock();
  const progress = useRef(PlayerCtxDefault.getProgress());
  const { loadLyric, loadAudioSource, schedulePreloadNextTrack, cancelScheduledPreload } =
    useMediaResourceManager({
      lyricVersion,
      setLyricLines,
      setLyricVersion,
      setInfo,
      progress
    });
  /**                        暴露方法                         */
  // 播放控制函数
  const getProgress = useRef(() => progress.current).current;
  const play = useCallback(() => {
    const audio = audioRef.current;
    audio && (audio.paused ? audio.play() : audio.pause());
  }, []);
  const scrobble = useCallback(() => {
    const source = info?.sourceID || info?.album?.id;
    source &&
      requestScrobble({
        id: info.id,
        sourceid: source,
        time: Math.floor(progress.current.currentTime)
      });
  }, [info?.album?.id, info.id, info?.sourceID]);
  const nextTrack = useCallback(() => {
    if (!playList.length) return;
    TransitionLock.run(() => {
      setCurrentIndex((index) => {
        let nextIndex = index + 1;
        if (isShuffle) {
          nextIndex = (Math.random() * (playList.length || 0)) >>> 0;
        }
        if (nextIndex >= playList.length) {
          return 0;
        }
        return nextIndex;
      });
    });
  }, [TransitionLock, isShuffle, playList.length]);
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
  }, [isRepeat, nextTrack, scrobble]);
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
  }, [TransitionLock, playList.length]);
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
  }, []);
  const upVolume = useCallback((gap?: number) => {
    const audio = audioRef.current;
    if (audio) {
      gap ||= 0.2;
      audio.volume = Math.min(1, audio.volume + gap);
      audio.volume > 0 && audio.muted && (audio.muted = false);
    }
  }, []);
  const downVolume = useCallback((gap?: number) => {
    const audio = audioRef.current;
    if (audio) {
      gap ||= 0.2;
      audio.volume = Math.max(0, audio.volume - gap);
      audio.volume > 0 && audio.muted && (audio.muted = false);
    }
  }, []);
  const shuffle = useCallback((enable?: boolean) => {
    setIsShuffle((prev) => (enable === undefined ? !prev : enable));
  }, []);
  const repeat = useCallback((enable?: boolean) => {
    setIsRepeat((prev) => (enable === undefined ? !prev : enable));
  }, []);
  // 播放列表管理函数
  const addTrackToList = useCallback(
    (newTrack: PlayerTrackInfo) => {
      TransitionLock.run(() => {
        const exists = playList.findIndex((t) => t.id === newTrack.id);
        if (exists === -1) {
          // 不存在则添加到列表尾
          setPlayList((draft) => {
            draft.push(newTrack);
          });
        } else {
          // 已存在则提前到列表头
          setPlayList((draft) => {
            const [track] = draft.splice(exists, 1);
            draft.unshift(track!);
          });
          // 由于歌曲被提前到列表头，currentIndex 需要更新
          if (exists < currentIndex) {
            // 如果原先的索引在播放索引的前面，那么无需修改 currentIndex，因为播放位置不变
            TransitionLock.unlock();
            return;
          } else if (exists === currentIndex) {
            // 如果原先的索引就是播放索引，那么 currentIndex 同步提前为 0
            setCurrentIndex(() => 0);
            return;
          } else if (exists > currentIndex) {
            // 如果原先的索引在播放索引的后面，那么 currentIndex 需要加一
            setCurrentIndex((index) => index + 1);
            return;
          }
        }
        TransitionLock.unlock();
      });
    },
    [TransitionLock, currentIndex, playList, setPlayList]
  );
  const removeTrackInList = useCallback(
    (id: number) => {
      TransitionLock.run(() => {
        setPlayList((draft) => {
          const index = draft.findIndex((t) => t.id === id);
          // 如果删除的歌曲合法（在列表中）
          if (index !== -1) {
            // 如果删除的歌曲在播放中，切换到下一首
            if (index === currentIndex) {
              // 如果是最后一首，切换到第一首
              if (index === draft.length - 1) {
                setCurrentIndex(() => 0);
                return;
              } else {
                // 否则切换到下一首，由于 splice 之后，
                // 下一首的 index 会和当前相同，所以不需要修改 currentIndex，
                // 这里显示操作是为了触发更新，因为index没有变化但是内容变了
                setCurrentIndex(() => index);
                return;
              }
            }
            draft.splice(index, 1);
          }
          TransitionLock.unlock();
        });
      });
    },
    [TransitionLock, currentIndex, setPlayList]
  );
  const addAndPlayTrack = useCallback(
    (newTrack: PlayerTrackInfo) => {
      TransitionLock.run(() => {
        const exists = playList.findIndex((t) => t.id === newTrack.id);
        if (exists === -1) {
          const insertAt = Math.min(currentIndex + 1, playList.length);
          const newPlayList = [
            ...playList.slice(0, insertAt),
            newTrack,
            ...playList.slice(insertAt)
          ];
          setPlayList(newPlayList);
          setCurrentIndex(() => insertAt);
        } else {
          if (exists === currentIndex) {
            TransitionLock.unlock();
            return;
          }
          setCurrentIndex(() => exists);
        }
      });
    },
    [TransitionLock, currentIndex, playList, setPlayList]
  );
  const clearPlayList = useCallback(() => {
    TransitionLock.run(() => {
      setPlayList([]);
      setCurrentIndex(() => 0);
    }, true);
  }, [TransitionLock, setPlayList]);
  const replacePlayList = useCallback(
    (playList: PlayerTrackInfo[], relativeIndex: number) => {
      TransitionLock.run(() => {
        setPlayList(playList);
        setCurrentIndex(() => relativeIndex);
      });
    },
    [TransitionLock, setPlayList]
  );
  const changeCurrentTime = useCallback((targetTime: number) => {
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
  }, []);
  /**                        状态变化                         */
  // 监听 currentIndex 变化以切换歌曲
  useLayoutEffect(() => {
    const candidate = playList[currentIndex];
    const next = playList[currentIndex + 1] || null;
    if (candidate && candidate.id !== info.id) {
      setInfo(candidate);
      setNextInfo(next);
      // 预加载下一首歌曲信息
      if (!isRepeat && !isShuffle) {
        schedulePreloadNextTrack(candidate, next);
      } else {
        cancelScheduledPreload();
      }
      void loadLyric(candidate.id);
      candidate.raw && updatePlayHistory(candidate.raw);
      scrobble();
    } else if (!candidate) {
      cancelScheduledPreload();
    }
    TransitionLock.unlock();
  }, [
    currentIndex,
    cancelScheduledPreload,
    info.id,
    isRepeat,
    isShuffle,
    loadLyric,
    playList,
    schedulePreloadNextTrack,
    scrobble,
    setInfo,
    TransitionLock
  ]);
  // 监听 info.id 变化以加载音频地址
  useLayoutEffect(() => {
    if (info.id !== 0 && info.audio === "") {
      void loadAudioSource(info.id);
    }
  }, [info.audio, info.id, loadAudioSource]);
  // 监听 info.audio 地址变化以播放音频
  useLayoutEffect(() => {
    const audio = audioRef.current;
    if (!audio || !info.audio) return;
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
  }, [info.audio]);
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
    audio.addEventListener("ended", autoNextTrack, { passive: true });
    audio.addEventListener("timeupdate", handleTimeUpdate, { passive: true });
    audio.addEventListener("durationchange", handleDurationChange, { passive: true });
    audio.addEventListener("progress", handleProgress, { passive: true });
    audio.addEventListener("volumechange", handleVolumeChange, { passive: true });
    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", autoNextTrack);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("progress", handleProgress);
      audio.removeEventListener("volumechange", handleVolumeChange);
    };
  }, [autoNextTrack, mute]);
  // 清理预加载定时器
  useEffect(() => cancelScheduledPreload, [cancelScheduledPreload]);
  // Media Session API 支持
  useMediaSession({
    info,
    nextTrack,
    lastTrack,
    play
  });
  /**                        返回值                         */
  // 将方法和状态进行 useMemo 包装以避免不必要的重渲染
  // 返回方法
  const actions = useMemo(
    () => ({
      play,
      mute,
      upVolume,
      downVolume,
      setInfo,
      setPlayList,
      setCurrentIndex,
      addTrackToList,
      removeTrackInList,
      nextTrack,
      lastTrack,
      addAndPlayTrack,
      clearPlayList,
      replacePlayList,
      getProgress,
      changeCurrentTime,
      setLyricVersion,
      shuffle,
      repeat
    }),
    [
      addAndPlayTrack,
      addTrackToList,
      changeCurrentTime,
      clearPlayList,
      downVolume,
      getProgress,
      lastTrack,
      mute,
      nextTrack,
      play,
      removeTrackInList,
      repeat,
      replacePlayList,
      setInfo,
      setPlayList,
      shuffle,
      upVolume
    ]
  );
  // 返回状态
  const states = useMemo(
    () => ({
      audioRef,
      lyricLines,
      info,
      nextInfo,
      currentIndex,
      isPlaying,
      playList,
      lyricVersion,
      volume,
      isShuffle,
      isRepeat
    }),
    [
      currentIndex,
      info,
      isPlaying,
      isRepeat,
      isShuffle,
      lyricLines,
      lyricVersion,
      nextInfo,
      playList,
      volume
    ]
  );
  return {
    actions,
    states
  };
}

function useMediaResourceManager(params: {
  lyricVersion: LyricVersionType;
  setLyricLines: (lines: FullVersionLyricLine) => void;
  setLyricVersion: (version: LyricVersionType) => void;
  setInfo: Updater<PlayerTrackInfo>;
  progress: RefObject<PlayerProgress>;
}) {
  const { lyricVersion, setLyricLines, setLyricVersion, setInfo, progress } = params;
  const lyricRequestIdRef = useRef(0);
  const audioRequestIdRef = useRef(0);
  const audioMetaCacheRef = useRef<Map<number, AudioMeta>>(new Map());
  const preloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloadScheduleIdRef = useRef(0);

  const fetchAudioMeta = useCallback(async (id: number): Promise<Nullable<AudioMeta>> => {
    if (audioMetaCacheRef.current.has(id)) {
      return audioMetaCacheRef.current.get(id)!;
    }
    try {
      const res = await getMP3(id);
      const meta = Array.isArray(res?.data) ? res.data[0] : undefined;
      if (meta?.url) {
        const payload: AudioMeta = { url: meta.url, size: meta.size };
        audioMetaCacheRef.current.set(id, payload);
        return payload;
      }
    } catch (err) {
      Log.error(
        new EqError({
          raw: err,
          message: `Failed to fetch MP3 for track ${id}`,
          label: "ui/ctx/PlayerProvider:fetchAudioMeta"
        })
      );
    }
    return null;
  }, []);

  const loadLyric = useCallback(
    async (id: number) => {
      const requestId = ++lyricRequestIdRef.current;
      try {
        const result = await getYRCLyric(id);
        if (requestId !== lyricRequestIdRef.current) return;
        const lyric = handleLyricResponse(result);
        setLyricLines(lyric);
        const hasRm = lyric.rm.length > 0;
        const hasTl = lyric.tl.length > 0;
        const selectVersion = chooseLyricVersion(lyricVersion, hasRm, hasTl);
        setLyricVersion(selectVersion);
      } catch (err) {
        if (requestId !== lyricRequestIdRef.current) return;
        Log.error(
          new EqError({
            raw: err,
            message: "Failed to fetch lyric",
            label: "ui/ctx/PlayerProvider:getLyric"
          })
        );
      }
    },
    [lyricVersion, setLyricLines, setLyricVersion]
  );

  const loadAudioSource = useCallback(
    async (id: number) => {
      const requestId = ++audioRequestIdRef.current;
      const meta = await fetchAudioMeta(id);
      if (requestId !== audioRequestIdRef.current) return;
      if (meta?.url) {
        setInfo((draft) => {
          if (draft.audio !== meta.url) {
            draft.audio = meta.url;
          }
        });
        progress.current.size = meta.size ?? 0;
        return;
      }
      Log.error(
        new EqError({
          message: `MP3 URL not found for track ${id}`,
          label: "ui/ctx/PlayerProvider:loadAudioSource"
        })
      );
    },
    [fetchAudioMeta, progress, setInfo]
  );

  const cancelScheduledPreload = useCallback(() => {
    if (preloadTimerRef.current) {
      clearTimeout(preloadTimerRef.current);
      preloadTimerRef.current = null;
    }
  }, []);

  const schedulePreloadNextTrack = useCallback(
    (currentTrack: PlayerTrackInfo, nextTrack: Nullable<PlayerTrackInfo>) => {
      if (!nextTrack || currentTrack.id === nextTrack.id) return;
      cancelScheduledPreload();
      const scheduleId = ++preloadScheduleIdRef.current;
      preloadTimerRef.current = setTimeout(async () => {
        if (scheduleId !== preloadScheduleIdRef.current) return;
        const cover = NeteaseImageSizeFilter(nextTrack.album.picUrl, ImageSize.raw) || "";
        const meta = await fetchAudioMeta(nextTrack.id);
        const tasks: { id?: string; url: string }[] = [];
        if (cover) {
          tasks.push({ url: cover });
        }
        if (meta?.url) {
          tasks.push({ id: getAudioCacheKey(nextTrack.id), url: meta.url });
        }
        if (tasks.length > 0) {
          void Store.checkOrStoreAsyncMutil(tasks);
        }
      }, 150);
    },
    [cancelScheduledPreload, fetchAudioMeta]
  );

  useEffect(() => cancelScheduledPreload, [cancelScheduledPreload]);

  return { loadLyric, loadAudioSource, schedulePreloadNextTrack, cancelScheduledPreload };
}

function getAudioCacheKey(id: number) {
  return `${AUDIO_CACHE_PREFIX}${id}`;
}

function handleLyricResponse(result: NeteaseLyricResponseNew): FullVersionLyricLine {
  if (
    !result.lrc?.lyric &&
    !result.klyric?.lyric &&
    !result.romalrc?.lyric &&
    !result.tlyric?.lyric &&
    !result.yrc
  ) {
    return {
      full: [noLyricTmp],
      rm: [noLyricTmp],
      tl: [noLyricTmp],
      raw: [noLyricTmp]
    };
  }
  const parsedLyric = handleNeteaseLyricResponse(result);
  if (!parsedLyric)
    return {
      full: [noLyricTmp],
      rm: [noLyricTmp],
      tl: [noLyricTmp],
      raw: [noLyricTmp]
    };
  if (parsedLyric.raw.length === 0) {
    return {
      full: [pureMusicTmp],
      rm: [pureMusicTmp],
      tl: [pureMusicTmp],
      raw: [pureMusicTmp]
    };
  } else {
    return parsedLyric;
  }
}

function chooseLyricVersion(current: LyricVersionType, hasRm: boolean, hasTl: boolean) {
  if (current === "raw" && hasTl) {
    return "tl";
  }
  if (current === "full") {
    if (!hasRm && !hasTl) {
      return "raw";
    } else if (!hasRm && hasTl) {
      return "tl";
    } else if (hasRm && !hasTl) {
      return "rm";
    }
  } else if (current === "rm" && !hasRm) {
    if (hasTl) {
      return "tl";
    } else {
      return "raw";
    }
  } else if (current === "tl" && !hasTl) {
    if (hasRm) {
      return "rm";
    } else {
      return "raw";
    }
  }
  return current;
}

const noLyricTmp = {
  words: [
    {
      startTime: 0,
      endTime: 999999999999,
      obscene: false,
      word: "暂无歌词",
      romanWord: ""
    }
  ],
  translatedLyric: "",
  romanLyric: "",
  startTime: 0,
  endTime: 999999999999,
  isBG: false,
  isDuet: false
};

const pureMusicTmp = {
  words: [
    {
      startTime: 0,
      endTime: 999999999999,
      obscene: false,
      word: "纯音乐，请欣赏",
      romanWord: ""
    }
  ],
  translatedLyric: "",
  romanLyric: "",
  startTime: 0,
  endTime: 999999999999,
  isBG: false,
  isDuet: false
};
