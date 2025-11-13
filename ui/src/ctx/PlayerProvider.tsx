import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayerCtx, PlayerCtxType } from "./PlayerCtx";
import { LyricLine } from "@applemusic-like-lyrics/core";
import { parseLrc } from "@applemusic-like-lyrics/lyric";
import { handleTranslatedLRC, mapRawLyricLine } from "@mahiru/ui/utils/lyric";

export default function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [cover, setCover] = useState("/小さな恋のうた - 石見舞菜香.jpg");
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
      cover,
      play,
      mute,
      upVolume,
      downVolume
    }),
    [audioRef, lyricLines, cover, play, mute, upVolume, downVolume]
  );

  useEffect(() => {
    fetch("/小さな恋のうた - 石見舞菜香.lrc")
      .then((res) => res.text())
      .then((lrc) => {
        handleTranslatedLRC(lrc);
        setLyricLines(handleTranslatedLRC(lrc));
      });
  }, []);
  return (
    <>
      <audio
        className="w-0 h-0 opacity-0"
        ref={audioRef}
        src={"/小さな恋のうた - 石見舞菜香.mp3"}
        preload="auto"
      />
      <PlayerCtx.Provider value={ctxValue}>{children}</PlayerCtx.Provider>
    </>
  );
}
