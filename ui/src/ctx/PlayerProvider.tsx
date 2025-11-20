import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayerCtx, PlayerCtxType } from "./PlayerCtx";
import { LyricLine } from "@applemusic-like-lyrics/core";
import { handleNeteaseLyricResponse } from "@mahiru/ui/utils/lyric";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { getLyric, getMP3 } from "@mahiru/ui/api/track";
import { useImmer } from "use-immer";
import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";
import { wrapCacheUrl } from "@mahiru/ui/api/cache";

export default function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [info, setInfo] = useImmer<PlayerCtxType["info"]>({
    title: "",
    artist: [] as NeteaseTrack["ar"],
    album: {
      id: 0,
      name: "",
      pic: 0,
      pic_str: "",
      picUrl: "",
      tns: []
    } as NeteaseTrack["al"],
    cover: "",
    audio: "",
    id: 0
  });
  const [playList, setPlayList] = useImmer<PlayerCtxType["info"][]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);

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
    (newTrack: PlayerCtxType["info"]) => {
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
    (newTrack: PlayerCtxType["info"]) => {
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
    (playList: PlayerCtxType["info"][], currentIndex: number) => {
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
  }, [playList]);
  const lastTrack = useCallback(() => {
    setCurrentIndex((index) => {
      const lastIndex = index - 1;
      if (lastIndex < 0) {
        return playList.length - 1;
      }
      return lastIndex;
    });
  }, [playList]);

  const ctxValue = useMemo<PlayerCtxType>(
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
      replacePlayList
    }),
    [
      addTrackToList,
      currentIndex,
      downVolume,
      info,
      isPlaying,
      lastTrack,
      lyricLines,
      mute,
      nextTrack,
      play,
      playList,
      removeTrackInList,
      setInfo,
      setPlayList,
      upVolume,
      addAndPlayTrack,
      clearPlayList,
      replacePlayList
    ]
  );

  useEffect(() => {
    const candidate = playList[currentIndex];
    if (candidate && candidate.id !== info.id) {
      const next = candidate;
      setInfo(next);
      getLyric(next.id)
        .then((result) => {
          const parsedLyric = handleNeteaseLyricResponse(result);
          setLyricLines(parsedLyric);
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
    }
  }, [info.id, playList, currentIndex, setInfo]);
  useEffect(() => {
    if (info.id !== 0 && info.audio === "") {
      getMP3(info.id).then((res) => {
        res &&
          setInfo((draft) => {
            draft.audio = res.data[0]?.url || "err";
          });
      });
    }
  }, [info, setInfo]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !info.audio) return;
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
  }, [info.audio]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.addEventListener("ended", nextTrack);
      return () => {
        audio.removeEventListener("ended", nextTrack);
      };
    }
  }, [nextTrack]);
  return (
    <>
      <audio
        className="w-0 h-0 opacity-0"
        ref={audioRef}
        src={(wrapCacheUrl(info.audio) || null) as string}
        preload="auto"
      />
      <PlayerCtx.Provider value={ctxValue}>{children}</PlayerCtx.Provider>
    </>
  );
}
