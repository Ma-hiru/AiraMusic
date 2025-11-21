import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LyricLine } from "@applemusic-like-lyrics/core";
import { handleNeteaseLyricResponse } from "@mahiru/ui/utils/lyric";
import { getLyric, getMP3 } from "@mahiru/ui/api/track";
import { useImmer } from "use-immer";
import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";
import { PlayerCtxDefault, PlayerCtxType, PlayerTrackInfo } from "@mahiru/ui/ctx/PlayerCtx";
import { NeteaseLyricResponse } from "@mahiru/ui/types/netease-api";

export function useSong() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [info, setInfo] = useImmer<PlayerTrackInfo>(PlayerCtxDefault.info);
  const [playList, setPlayList] = useImmer<PlayerTrackInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [progress, setProgress] = useImmer({
    currentTime: 0,
    duration: 0,
    buffered: 0
  });

  const play = useCallback(() => {
    const audio = audioRef.current;
    audio && (audio.paused ? audio.play() : audio.pause());
  }, []);
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
    setPlayList([]);
    setCurrentIndex(0);
  }, [setPlayList]);
  const replacePlayList = useCallback(
    (playList: PlayerTrackInfo[], currentIndex: number) => {
      setPlayList(playList);
      setCurrentIndex(currentIndex);
    },
    [setPlayList]
  );
  const nextTrack = useCallback(() => {
    setCurrentIndex((index) => {
      const nextIndex = index + 1;
      if (nextIndex >= playList.length) {
        return 0;
      }
      return nextIndex;
    });
  }, [playList.length]);
  const lastTrack = useCallback(() => {
    setCurrentIndex((index) => {
      const lastIndex = index - 1;
      if (lastIndex < 0) {
        return playList.length - 1;
      }
      return lastIndex;
    });
  }, [playList.length]);

  // 加载歌词函数
  const loadLyric = useCallback((id: number) => {
    getLyric(id)
      .then((result) => {
        const lyric = handleLyricResponse(result);
        setLyricLines(lyric);
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
  const loadMP3 = useCallback((id: number) => {
    let retryCount = 0;
    const maxRetries = 3;
    const fetchAudio = () => {
      getMP3(id).then((res) => {
        if (Array.isArray(res?.data) && typeof res.data[0]?.url === "string") {
          setInfo((draft) => {
            draft.audio = res.data[0]!.url!;
          });
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
  }, [setInfo]);
  // 刷新并播放音频
  const refreshAudio = useCallback((audio: HTMLAudioElement) => {
    try {
      // React 控制 audio 的 src 属性，但为了确保立即生效，调用 load 并尝试 play
      audio.load();
      void audio.play().catch((err) => {
        Log.error(
          new EqError({
            raw: err,
            message: "play request failed or was blocked",
            label: "ui/ctx/PlayerProvider:playOnInfoAudioChange"
          })
        );
      });
    } catch (err) {
      Log.error(
        new EqError({
          raw: err,
          message: "unexpected error when trying to play",
          label: "ui/ctx/PlayerProvider:playOnInfoAudioChange"
        })
      );
    }
  }, []);
  // 监听 currentIndex 变化以切换歌曲
  useEffect(() => {
    const candidate = playList[currentIndex];
    if (candidate && candidate.id !== info.id) {
      const next = candidate;
      setInfo(next);
      loadLyric(next.id);
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
    refreshAudio(audio);
  }, [info.audio, refreshAudio]);
  // 监听 audio 播放状态变化
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", nextTrack);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", nextTrack);
    };
  }, [nextTrack]);
  
  return useMemo<PlayerCtxType>(() => ({
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
    replacePlayList
  }), [addAndPlayTrack, addTrackToList, clearPlayList, currentIndex, downVolume, info, isPlaying, lastTrack, lyricLines, mute, nextTrack, play, playList, removeTrackInList, replacePlayList, setInfo, setPlayList, upVolume]);
}

function handleLyricResponse(result: NeteaseLyricResponse): LyricLine[] {
  if (result.lrc.lyric === "" && result.klyric.lyric === "" && result.romalrc.lyric === "" && result.tlyric.lyric === "") {
    return [{
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
    }];
  }
  const parsedLyric = handleNeteaseLyricResponse(result);
  if (parsedLyric.length === 0) {
    return [{
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
    }];
  } else {
    return parsedLyric;
  }
}