import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FullVersionLyricLine, handleNeteaseLyricResponse } from "@mahiru/ui/utils/lyric";
import { getMP3, scrobble as requestScrobble } from "@mahiru/ui/api/track";
import { useImmer } from "use-immer";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import {
  LyricVersionType,
  PlayerCtxDefault,
  PlayerCtxType,
  PlayerTrackInfo
} from "@mahiru/ui/ctx/PlayerCtx";
import { getPersistSnapshot, Store } from "@mahiru/ui/store";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { getYRCLyric } from "@mahiru/ui/api/lyric";

const { updatePlayHistory } = getPersistSnapshot();

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
  const switching = useRef(false);
  const progress = useRef(PlayerCtxDefault.getProgress());
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
    if (switching.current) return;
    switching.current = true;
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
  }, [isShuffle, playList.length]);
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
    if (switching.current) return;
    switching.current = true;
    setCurrentIndex((index) => {
      const lastIndex = index - 1;
      if (lastIndex < 0) {
        return playList.length - 1;
      }
      return lastIndex;
    });
  }, [playList.length]);
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
          return;
        } else if (exists === currentIndex) {
          // 如果原先的索引就是播放索引，那么 currentIndex 同步提前为 0
          setCurrentIndex(0);
        } else if (exists > currentIndex) {
          // 如果原先的索引在播放索引的后面，那么 currentIndex 需要加一
          setCurrentIndex((index) => index + 1);
        }
      }
    },
    [currentIndex, playList, setPlayList]
  );
  const removeTrackInList = useCallback(
    (id: number) => {
      setPlayList((draft) => {
        const index = draft.findIndex((t) => t.id === id);
        // 如果删除的歌曲合法（在列表中）
        if (index !== -1) {
          // 如果删除的歌曲在播放中，切换到下一首
          if (index === currentIndex) {
            // 如果是最后一首，切换到第一首
            if (index === draft.length - 1) {
              setCurrentIndex(0);
            } else {
              // 否则切换到下一首，由于 splice 之后，
              // 下一首的 index 会和当前相同，所以不需要修改 currentIndex，
              // 这里显示操作是为了触发更新，因为index没有变化但是内容变了
              setCurrentIndex(() => index);
            }
          }
          draft.splice(index, 1);
        }
      });
    },
    [currentIndex, setPlayList]
  );
  const addAndPlayTrack = useCallback(
    (newTrack: PlayerTrackInfo) => {
      if (switching.current) return;
      switching.current = true;
      const exists = playList.findIndex((t) => t.id === newTrack.id);
      if (exists === -1) {
        const insertAt = Math.min(currentIndex + 1, playList.length);
        const newPlayList = [...playList.slice(0, insertAt), newTrack, ...playList.slice(insertAt)];
        setPlayList(newPlayList);
        setCurrentIndex(() => insertAt);
      } else {
        setCurrentIndex(() => exists);
      }
    },
    [currentIndex, playList, setPlayList]
  );
  const clearPlayList = useCallback(() => {
    if (switching.current) return;
    switching.current = true;
    setPlayList([]);
    setCurrentIndex(() => 0);
  }, [setPlayList]);
  const replacePlayList = useCallback(
    (playList: PlayerTrackInfo[], relativeIndex: number) => {
      if (switching.current) return;
      switching.current = true;
      setPlayList(playList);
      setCurrentIndex(() => relativeIndex);
    },
    [setPlayList]
  );
  const changeCurrentTime = useCallback((current: number) => {
    if (current < 0 || current > progress.current.buffered) return;
    const audio = audioRef.current;
    audio && (audio.currentTime = current);
  }, []);
  /**                        状态变化                         */
  // 加载歌词函数
  const loadLyric = useCallback(
    (id: number) => {
      getYRCLyric(id)
        .then((result) => {
          const lyric = handleLyricResponse(result);
          setLyricLines(lyric);
          const hasRm = lyric.rm.length > 0;
          const hasTl = lyric.tl.length > 0;
          const selectVersion = chooseLyricVersion(lyricVersion, hasRm, hasTl);
          setLyricVersion(selectVersion);
        })
        .catch((err) => {
          Log.error(
            new EqError({
              raw: err,
              message: "Failed to fetch lyric",
              label: "ui/ctx/PlayerProvider:getLyric"
            })
          );
        });
    },
    [lyricVersion]
  );
  // 加载音频函数
  const loadMP3 = useCallback(
    (id: number) => {
      let retryCount = 0;
      const maxRetries = 3;
      const fetchAudio = () => {
        getMP3(id).then((res) => {
          if (Array.isArray(res?.data) && typeof res.data[0]?.url === "string") {
            if (info.audio !== res.data[0]!.url) {
              setInfo((draft) => {
                draft.audio = res.data[0]!.url!;
              });
            }
            progress.current.size = res.data[0]!.size;
          } else {
            if (retryCount < maxRetries) {
              retryCount++;
              Log.warn(
                `MP3 URL not found for track ID ${id}. Retrying (${retryCount}/${maxRetries})...`
              );
              fetchAudio();
            } else {
              Log.error(
                new EqError({
                  message: `MP3 URL not found after ${maxRetries} attempts for track ID ${id}.`,
                  label: "ui/ctx/PlayerProvider:loadMP3"
                })
              );
            }
          }
        });
      };
      fetchAudio();
      return () => {
        retryCount = maxRetries;
      };
    },
    [info.audio, setInfo]
  );
  const preloadNextTrack = useCallback(
    async (currentTrack: PlayerTrackInfo, nextTrack: Nullable<PlayerTrackInfo>) => {
      if (!nextTrack || currentTrack.id === nextTrack.id) return;
      const cover = NeteaseImageSizeFilter(nextTrack.album.picUrl, ImageSize.raw) || "";
      const mp3 = (await getMP3(nextTrack.id)).data[0]?.url || "";
      void Store.checkOrStoreAsyncMutil([
        { url: cover },
        { id: "audio_" + nextTrack.id, url: mp3 }
      ]);
    },
    []
  );
  // 监听 currentIndex 变化以切换歌曲
  useLayoutEffect(() => {
    const candidate = playList[currentIndex];
    const next = playList[currentIndex + 1] || null;
    if (candidate && candidate.id !== info.id) {
      setInfo(candidate);
      setNextInfo(next);
      // 预加载下一首歌曲信息
      void preloadNextTrack(candidate, next);
      loadLyric(candidate.id);
      updatePlayHistory(candidate.raw);
      scrobble();
    } else {
      switching.current = false;
    }
  }, [currentIndex, info.id, loadLyric, playList, preloadNextTrack, scrobble, setInfo]);
  // 监听 info.id 变化以加载音频地址
  useLayoutEffect(() => {
    if (info.id !== 0 && info.audio === "") {
      return loadMP3(info.id);
    }
  }, [info.audio, info.id, loadMP3]);
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

  useEffect(() => {
    if (navigator.mediaSession) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: info.title,
        artist: info.artist.map((artist) => artist.name).join(", "),
        album: info.album.name,
        artwork: [
          {
            src: NeteaseImageSizeFilter(info.album.picUrl, ImageSize.lg) || "",
            sizes: "500x500",
            type: "image/png"
          }
        ]
      });
      navigator.mediaSession.setActionHandler("play", play);
      navigator.mediaSession.setActionHandler("pause", play);
      navigator.mediaSession.setActionHandler("previoustrack", lastTrack);
      navigator.mediaSession.setActionHandler("nexttrack", nextTrack);
      return () => {
        navigator.mediaSession.metadata = new MediaMetadata();
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
      };
    }
  }, [info.album.name, info.album.picUrl, info.artist, info.title, lastTrack, nextTrack, play]);
  return useMemo<PlayerCtxType>(
    () => ({
      audioRef,
      lyricLines,
      info,
      nextInfo,
      play,
      mute,
      upVolume,
      downVolume,
      currentIndex,
      setInfo,
      setPlayList,
      setCurrentIndex,
      isPlaying,
      playList,
      addTrackToList,
      removeTrackInList,
      nextTrack,
      lastTrack,
      addAndPlayTrack,
      clearPlayList,
      replacePlayList,
      getProgress,
      changeCurrentTime,
      lyricVersion,
      setLyricVersion,
      volume,
      isShuffle,
      shuffle,
      isRepeat,
      repeat
    }),
    [
      lyricLines,
      info,
      nextInfo,
      play,
      mute,
      upVolume,
      downVolume,
      currentIndex,
      setInfo,
      setPlayList,
      isPlaying,
      playList,
      addTrackToList,
      removeTrackInList,
      nextTrack,
      lastTrack,
      addAndPlayTrack,
      clearPlayList,
      replacePlayList,
      getProgress,
      changeCurrentTime,
      lyricVersion,
      volume,
      isShuffle,
      shuffle,
      isRepeat,
      repeat
    ]
  );
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
