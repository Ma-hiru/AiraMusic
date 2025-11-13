import { FC, useEffect } from "react";
import { LyricLine } from "@applemusic-like-lyrics/core";
import "@applemusic-like-lyrics/core/style.css";
import { type LyricLine as RawLyricLine, parseLrc } from "@applemusic-like-lyrics/lyric";
import { useRef, useState } from "react";
import { css, cx } from "@emotion/css";
import { LyricPlayer, LyricPlayerRef } from "@mahiru/ui/page/player/LyricPlayer";
import { BackgroundRender } from "@mahiru/ui/page/player/BackgroundRender";

const mapTTMLLyric = (line: RawLyricLine): LyricLine => ({
  ...line,
  words: line.words.map((word) => ({ obscene: false, ...word }))
});

export const PlayerPage: FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  useEffect(() => {
    fetch("/小さな恋のうた - 石見舞菜香.lrc")
      .then((res) => res.text())
      .then((lrc) => {
        setLyricLines(parseLrc(lrc).map(mapTTMLLyric));
      });
  }, []);
  useEffect(() => {
    if (audioRef.current) {
      let lastTime = -1;
      const onFrame = (time: number) => {
        if (audioRef.current && !audioRef.current.paused) {
          if (lastTime === -1) {
            lastTime = time;
          }
          lyricPlayerRef.current?.lyricPlayer?.update(time - lastTime);
          lastTime = time;
          lyricPlayerRef.current?.lyricPlayer?.setCurrentTime(
            (audioRef.current.currentTime * 1000) | 0
          );
          requestAnimationFrame(onFrame);
        }
      };
      const onPlay = () => onFrame(0);
      audioRef.current.addEventListener("play", onPlay);
      return () => {
        // oxlint-disable-next-line exhaustive-deps
        audioRef.current?.removeEventListener("play", onPlay);
      };
    }
  }, []);
  useEffect(() => {
    // 调试用途，暴露到 Window
    if (lyricPlayerRef.current) {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      (window as any).lyricPlayer = lyricPlayerRef.current;
    }
  }, []);
  return (
    <div className="w-screen h-screen relative">
      <div
        className={cx(
          css`
            -webkit-app-region: drag;
          `,
          "absolute top-0 left-0 right-0 h-10"
        )}
      />
      <div className="absolute w-1/2 h-screen flex items-center justify-center z-10 flex-col gap-8">
        <img
          className="sm:w-[200px] lg:w-[300px] object-cover rounded-lg shadow-lg ease-in duration-300 transition-normal pointer-events-none"
          src="/小さな恋のうた - 石見舞菜香.jpg"
          alt="小さな恋のうた - 石見舞菜香"
        />
        <audio
          controls
          className="z-10"
          ref={audioRef}
          src={"/小さな恋のうた - 石見舞菜香.mp3"}
          preload="auto"
        />
        <button
          onClick={() => {
            if (lyricPlayerRef.current) {
              console.log(lyricPlayerRef.current.lyricPlayer?.setWordFadeWidth);
            }
          }}>
          1
        </button>
      </div>
      <BackgroundRender
        style={{
          position: "absolute",
          top: "0",
          left: "0",
          width: "100%",
          height: "100%"
        }}
        album={"/小さな恋のうた - 石見舞菜香.jpg"}
        staticMode={true}
        flowSpeed={5}
        renderScale={0.2}
        albumIsVideo={false}
      />
      <LyricPlayer
        style={{
          position: "absolute",
          top: "0",
          left: "50%",
          width: "50%",
          height: "100%",
          maxWidth: "50%",
          maxHeight: "100%",
          contain: "paint layout",
          overflow: "hidden",
          mixBlendMode: "plus-lighter"
        }}
        ref={lyricPlayerRef}
        alignAnchor="center"
        lyricLines={lyricLines}
      />
    </div>
  );
};
export default PlayerPage;
