import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { addMessageHandler, removeMessageHandler } from "@mahiru/ui/utils/message";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

export function useLyricSync() {
  const [hasOpenLyricWin, setHasOpenLyricWin] = useState(false);
  const { lyricVersion, lyricLines, getProgress, isPlaying, info, audioRef, setLyricVersion } =
    usePlayer();
  const { mainColor } = useThemeColor();
  const getNewestInfo = useRef({ lyricLines, info, isPlaying, lyricVersion, getProgress });
  getNewestInfo.current = { lyricLines, info, isPlaying, lyricVersion, getProgress };

  const sendInit = useCallback(() => {
    const { lyricLines, info } = getNewestInfo.current;
    window.node.event.sendMessageTo({
      from: "main",
      to: "lyric",
      type: "lyricInit",
      data: {
        lyricLines,
        info,
        themeColor: mainColor
      } satisfies LyricInit
    });
  }, [mainColor]);
  const sendSync = useCallback(() => {
    const { lyricVersion, isPlaying, getProgress } = getNewestInfo.current;
    const { currentTime, duration } = getProgress();
    window.node.event.sendMessageTo({
      from: "main",
      to: "lyric",
      type: "lyricSync",
      data: {
        lyricVersion,
        currentTime,
        duration,
        isPlaying,
        themeColor: mainColor
      } satisfies LyricSync
    });
  }, [mainColor]);

  const openLyricWin = useCallback(() => {
    if (!hasOpenLyricWin) {
      window.node.event.createLyricWindow();
      setHasOpenLyricWin(true);
      addMessageHandler((message) => {
        if (message.from === "lyric" && message.type === "winLoaded") {
          sendInit();
          removeMessageHandler("lyric-win-loaded-handler");
        }
      }, "lyric-win-loaded-handler");
      addMessageHandler<LyricVersionType>((message) => {
        if (message.from === "lyric" && message.to === "main") {
          if (message.type === "lyricVersionChange") {
            setLyricVersion(message.data);
          }
        }
      }, "lyric-win-lyric-version-change-handler");
    } else {
      window.node.event.close("lyric");
      removeMessageHandler("lyric-win-lyric-version-change-handler");
      setHasOpenLyricWin(false);
    }
  }, [hasOpenLyricWin, sendInit, setLyricVersion]);
  useEffect(() => {
    if (!hasOpenLyricWin) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.addEventListener("timeupdate", sendSync);
    audio.addEventListener("loadstart", sendInit);
    return () => {
      audio.removeEventListener("timeupdate", sendSync);
      audio.removeEventListener("loadstart", sendInit);
    };
  }, [audioRef, hasOpenLyricWin, sendInit, sendSync]);
  // 额外同步歌词变化，歌词受网络影响可能会延迟得到数据
  useEffect(sendInit, [sendInit, lyricLines, info]);

  return { hasOpenLyricWin, openLyricWin };
}
