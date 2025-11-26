import React, { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { addMessageHandler, removeMessageHandler } from "@mahiru/ui/utils/message";
import { useImmer } from "use-immer";
import { LyricPlayer, LyricPlayerRef } from "@mahiru/ui/componets/player/LyricPlayer";
import { cx } from "@emotion/css";
import { changeLyricComponentColorByCSSVar } from "@mahiru/ui/utils/color";
import Control from "@mahiru/ui/page/lyric/Control";

const LyricPage: FC<object> = () => {
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);
  const [_, update] = useState(0);
  const [lyricLines, setLyricLines] = useState<FullVersionLyricLine>({
    full: [],
    raw: [],
    rm: [],
    tl: []
  });
  const [info, setInfo] = useState<Nullable<LyricInit["info"]>>(null);
  const [lyricSync, setLyricSync] = useImmer<LyricSync>({
    currentTime: 0,
    duration: 0,
    lyricVersion: "raw",
    isPlaying: false
  });
  const [showBg, setShowBg] = useState(false);
  const [color, setColor] = useState("#ffffff");
  const [lock, setLock] = useState(false);

  const showBgTimer = useRef<Nullable<ReturnType<typeof setTimeout>>>(null);
  const getSync = useRef(lyricSync);
  getSync.current = lyricSync;
  // 同步信息
  useEffect(() => {
    addMessageHandler((message) => {
      const { data, type, to, from } = message;
      if (from === "main" && to === "lyric") {
        if (type === "lyricInit") {
          const lyricInit = JSON.parse(data) as LyricInit;
          setLyricLines(lyricInit.lyricLines);
          setInfo(lyricInit.info);
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
  // 歌词播放同步
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
  // 颜色变化
  useEffect(() => {
    changeLyricComponentColorByCSSVar(color);
  }, [color]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (lock) return;
      if (showBg) {
        setShowBg(false);
        return;
      }
      setShowBg(true);
      showBgTimer.current && clearTimeout(showBgTimer.current);
      showBgTimer.current = setTimeout(() => {
        setShowBg(false);
      }, 2500);
    },
    [lock, showBg]
  );
  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      if (lock) return;
      e.preventDefault();
      setShowBg(true);
      showBgTimer.current && clearTimeout(showBgTimer.current);
      showBgTimer.current = setTimeout(() => {
        setShowBg(false);
      }, 2500);
    },
    [lock]
  );
  // 初始显示背景
  useEffect(() => {
    setShowBg(true);
    showBgTimer.current && clearTimeout(showBgTimer.current);
    showBgTimer.current = setTimeout(() => {
      setShowBg(false);
    }, 2500);
  }, []);
  return (
    <div className="w-screen h-screen overflow-hidden relative flex rounded-md flex-col-reverse">
      <div
        className={cx(
          "w-screen flex-1 relative overflow-hidden flex flex-col justify-center items-center ease-in-out transition-all duration-300",
          showBg && "bg-black/10 rounded-lg",
          lock && "bg-transparent"
        )}
        onClick={handleClick}
        onMouseOver={handleMouseOver}>
        <div
          className={cx(
            "w-full h-full overflow-hidden contain-[paint_layout] mix-blend-plus-lighter transition-normal ease-in-out text-center",
            lock && "pointer-events-none"
          )}>
          <LyricPlayer
            ref={lyricPlayerRef}
            playing={lyricSync.isPlaying}
            className="w-full h-full"
            alignAnchor="center"
            hidePassedLines
            lyricLines={chooseVersion(lyricSync, lyricLines)}
            enableScale={false}
            enableSpring={false}
          />
        </div>
      </div>
      <Control
        color={color}
        setColor={setColor}
        lyricSync={lyricSync}
        info={info}
        showBg={showBg}
        setShowBg={setShowBg}
        lyricLines={lyricLines}
        lock={lock}
        setLock={setLock}
      />
    </div>
  );
};
export default memo(LyricPage);

function chooseVersion(lyricSync: LyricSync, lyricLines: FullVersionLyricLine) {
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
}
