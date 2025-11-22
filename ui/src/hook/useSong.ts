import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LyricLine } from "@applemusic-like-lyrics/core";
import { FullVersionLyricLine, handleNeteaseLyricResponse } from "@mahiru/ui/utils/lyric";
import { getLyric, getMP3 } from "@mahiru/ui/api/track";
import { useImmer } from "use-immer";
import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";
import { PlayerCtxDefault, PlayerCtxType, PlayerTrackInfo } from "@mahiru/ui/ctx/PlayerCtx";
import { NeteaseLyricResponse } from "@mahiru/ui/types/netease-api";

export function useSong() {
  /**                        状态管理                         */
  const audioRef = useRef<HTMLAudioElement>(null);
  const [info, setInfo] = useImmer<PlayerTrackInfo>(PlayerCtxDefault.info);
  const [playList, setPlayList] = useImmer<PlayerTrackInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lyricLines, setLyricLines] = useState<FullVersionLyricLine>({
    full: [],
    raw: [],
    tl: [],
    rm: []
  });
  const [lyricVersion, setLyricVersion] = useState<"raw" | "full" | "tl" | "rm">("tl");
  const switching = useRef(false);
  const progress = useRef(PlayerCtxDefault.getProgress());
  /**                        暴露方法                         */
  // 播放控制函数
  const play = useCallback(() => {
    const audio = audioRef.current;
    audio && (audio.paused ? audio.play() : audio.pause());
  }, []);
  const nextTrack = useCallback(() => {
    switching.current = true;
    setCurrentIndex((index) => {
      const nextIndex = index + 1;
      if (nextIndex >= playList.length) {
        return 0;
      }
      return nextIndex;
    });
  }, [playList.length]);
  const lastTrack = useCallback(() => {
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
    audio && (audio.muted = !audio.muted);
  }, []);
  const upVolume = useCallback((gap?: number) => {
    const audio = audioRef.current;
    gap ||= 0.2;
    if (audio) {
      audio.volume = Math.min(1, audio.volume + gap);
    }
  }, []);
  const downVolume = useCallback((gap?: number) => {
    const audio = audioRef.current;
    gap ||= 0.2;
    if (audio) {
      audio.volume = Math.max(0, audio.volume - gap);
    }
  }, []);
  // 播放列表管理函数
  const addTrackToList = useCallback(
    (newTrack: PlayerTrackInfo) => {
      const exists = playList.findIndex((t) => t.id === newTrack.id);
      if (exists === -1) {
        setPlayList((draft) => {
          draft.push(newTrack);
        });
      }
    },
    [playList, setPlayList]
  );
  const removeTrackInList = useCallback(
    (id: number) => {
      setPlayList((draft) => {
        const index = draft.findIndex((t) => t.id === id);
        if (index !== -1) {
          draft.splice(index, 1);
        }
      });
    },
    [setPlayList]
  );
  const addAndPlayTrack = useCallback(
    (newTrack: PlayerTrackInfo) => {
      switching.current = true;
      const exists = playList.findIndex((t) => t.id === newTrack.id);
      if (exists === -1) {
        const insertAt = Math.min(currentIndex + 1, playList.length);
        const newPlayList = [...playList.slice(0, insertAt), newTrack, ...playList.slice(insertAt)];
        setPlayList(newPlayList);
        setCurrentIndex(insertAt);
      } else {
        setCurrentIndex(exists);
      }
    },
    [currentIndex, playList, setPlayList]
  );
  const clearPlayList = useCallback(() => {
    switching.current = true;
    setPlayList([]);
    setCurrentIndex(0);
  }, [setPlayList]);
  const replacePlayList = useCallback(
    (playList: PlayerTrackInfo[], currentIndex: number) => {
      switching.current = true;
      setPlayList(playList);
      setCurrentIndex(currentIndex);
    },
    [setPlayList]
  );
  const changeCurrentTime = useCallback((current: number) => {
    if (current < 0 || current > progress.current.buffered) return;
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = current;
    }
  }, []);
  /**                        状态变化                         */
  // 加载歌词函数
  const loadLyric = useCallback((id: number) => {
    getLyric(id)
      .then((result) => {
        const lyric = handleLyricResponse(result);
        setLyricLines(lyric);
        if (lyric.tl.length > 0) {
          setLyricVersion("tl");
        } else if (lyric.rm.length > 0) {
          setLyricVersion("rm");
        } else {
          setLyricVersion("raw");
        }
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
  }, []);
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
  // 监听 currentIndex 变化以切换歌曲
  useEffect(() => {
    const candidate = playList[currentIndex];
    if (candidate && candidate.id !== info.id) {
      const next = candidate;
      setInfo(next);
      loadLyric(next.id);
    } else {
      switching.current = false;
    }
  }, [currentIndex, info.id, loadLyric, playList, setInfo]);
  // 监听 info.id 变化以加载音频地址
  useEffect(() => {
    if (info.id !== 0 && info.audio === "") {
      return loadMP3(info.id);
    }
  }, [info.audio, info.id, loadMP3]);
  // 监听 info.audio 地址变化以播放音频
  useEffect(() => {
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
  // 监听 audio 播放状态变化
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      progress.current.currentTime = audio.currentTime;
    };
    const handleDurationChange = () => {
      progress.current.duration = audio.duration || 0;
    };
    // 缓冲进度
    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        progress.current.buffered = audio.buffered.end(audio.buffered.length - 1);
      }
    };
    audio.addEventListener("play", handlePlay, { passive: true });
    audio.addEventListener("pause", handlePause, { passive: true });
    audio.addEventListener("ended", nextTrack, { passive: true });
    audio.addEventListener("timeupdate", handleTimeUpdate, { passive: true });
    audio.addEventListener("durationchange", handleDurationChange, { passive: true });
    audio.addEventListener("progress", handleProgress, { passive: true });
    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", nextTrack);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("progress", handleProgress);
    };
  }, [nextTrack]);

  const getProgress = useRef(() => progress.current).current;
  return useMemo<PlayerCtxType>(
    () => ({
      audioRef,
      lyricLines,
      info,
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
      setLyricVersion
    }),
    [
      addAndPlayTrack,
      addTrackToList,
      clearPlayList,
      currentIndex,
      downVolume,
      getProgress,
      info,
      isPlaying,
      lastTrack,
      lyricLines,
      mute,
      nextTrack,
      play,
      playList,
      removeTrackInList,
      replacePlayList,
      setInfo,
      setPlayList,
      upVolume,
      changeCurrentTime,
      lyricVersion,
      setLyricVersion
    ]
  );
}

function handleLyricResponse(result: NeteaseLyricResponse): FullVersionLyricLine {
  if (
    result.lrc.lyric === "" &&
    result.klyric.lyric === "" &&
    result.romalrc.lyric === "" &&
    result.tlyric.lyric === ""
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
