import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayerCtx, PlayerCtxType } from "./PlayerCtx";
import { LyricLine } from "@applemusic-like-lyrics/core";
import { handleTranslatedLRC } from "@mahiru/ui/utils/lyric";

export default function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [info, setInfo] = useState({
    title: "小さな恋のうた",
    artist: "石見舞菜香",
    album: "小さな恋のうた",
    cover: "/小さな恋のうた - 石見舞菜香.jpg",
    audio: "/小さな恋のうた - 石見舞菜香.mp3"
  });

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
    gap ||= 0.1;
    if (audio) {
      audio.volume = Math.min(1, audio.volume + gap);
    }
  }, []);
  const downVolume = useCallback((gap?: number) => {
    const audio = audioRef.current;
    gap ||= 0.1;
    if (audio) {
      audio.volume = Math.max(0, audio.volume - gap);
    }
  }, []);
  const ctxValue = useMemo<PlayerCtxType>(
    () => ({
      audioRef,
      lyricLines,
      info,
      play,
      mute,
      upVolume,
      downVolume,
      isPlaying
    }),
    [audioRef, lyricLines, info, play, mute, upVolume, downVolume, isPlaying]
  );

  useEffect(() => {
    fetch("/小さな恋のうた - 石見舞菜香.lrc")
      .then((res) => res.text())
      .then((lrc) => {
        handleTranslatedLRC(lrc);
        setLyricLines(handleTranslatedLRC(lrc));
      });
  }, []);
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
  return (
    <>
      <audio className="w-0 h-0 opacity-0" ref={audioRef} src={info.audio} preload="auto" />
      <PlayerCtx.Provider value={ctxValue}>{children}</PlayerCtx.Provider>
    </>
  );
}
