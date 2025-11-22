import { FC, memo, useEffect, useRef, useState } from "react";
import { addMessageHandler, removeMessageHandler } from "@mahiru/ui/utils/registerMessageHandlers";
import { useImmer } from "use-immer";
import { Drag } from "@mahiru/ui/componets/public/Drag";
import { LyricPlayer, LyricPlayerRef } from "@mahiru/ui/componets/player/LyricPlayer";

const LyricPage: FC<object> = () => {
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);
  const [_, update] = useState(0);
  const [lyricLines, setLyricLines] = useState<FullVersionLyricLine>({
    full: [],
    raw: [],
    rm: [],
    tl: []
  });
  const [lyricSync, setLyricSync] = useImmer<LyricSync>({
    currentTime: 0,
    duration: 0,
    lyricVersion: "raw",
    isPlaying: false
  });
  const getSync = useRef(lyricSync);
  getSync.current = lyricSync;
  useEffect(() => {
    addMessageHandler((message) => {
      const { data, type, to, from } = message;
      if (from === "main" && to === "lyric") {
        if (type === "lyricInit") {
          const lyricInit = JSON.parse(data) as LyricInit;
          setLyricLines(lyricInit.lyricLines);
          update((p) => p + 1);
        } else if (type === "lyricSync") {
          const lyricSync = JSON.parse(data) as LyricSync;
          setLyricSync((draft) => {
            draft.currentTime = lyricSync.currentTime;
            draft.duration = lyricSync.duration;
            draft.lyricVersion = lyricSync.lyricVersion;
            draft.isPlaying = lyricSync.isPlaying;
          });
          update((p) => p + 1);
        }
      }
    }, "lyric-sync-handler");

    return () => {
      removeMessageHandler("lyric-sync-handler");
    };
  }, [setLyricSync]);
  useEffect(() => {
    let rafId = 0;
    let lastTime = 0;

    const onFrame = (time: number) => {
      if (!getSync.current.isPlaying) return;

      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      lyricPlayerRef.current?.lyricPlayer?.update(delta);
      lyricPlayerRef.current?.lyricPlayer?.setCurrentTime((getSync.current.currentTime * 1000) | 0);

      rafId = requestAnimationFrame(onFrame);
    };

    if (lyricSync.isPlaying) {
      rafId = requestAnimationFrame(onFrame);
    }

    return () => cancelAnimationFrame(rafId);
  }, [lyricSync.isPlaying]);
  const chooseVersion = () => {
    switch (lyricSync.lyricVersion) {
      case "full":
        return lyricLines.full;
      case "tl":
        return lyricLines.tl;
      case "rm":
        return lyricLines.rm;
      case "raw":
      default:
        return lyricLines.raw;
    }
  };
  return (
    <Drag className="w-screen h-screen text-white relative overflow-hidden flex justify-center items-center">
      <div className="w-full h-1/2 overflow-hidden contain-[paint_layout] mix-blend-plus-lighter transition-normal ease-in-out text-center">
        <LyricPlayer
          ref={lyricPlayerRef}
          playing={lyricSync.isPlaying}
          className="w-full h-full"
          alignAnchor="center"
          hidePassedLines
          lyricLines={chooseVersion()}
          enableScale={false}
          enableSpring={false}
        />
      </div>
    </Drag>
  );
};
export default memo(LyricPage);
