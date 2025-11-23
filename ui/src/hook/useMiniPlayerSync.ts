import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { addMessageHandler, removeMessageHandler } from "@mahiru/ui/utils/registerMessageHandlers";

export function useMiniPlayerSync() {
  const [hasOpenMiniWin, setHasOpenMiniWin] = useState(false);
  const {
    lyricVersion,
    lyricLines,
    getProgress,
    isPlaying,
    info,
    audioRef,
    lastTrack,
    nextTrack,
    play
  } = usePlayer();
  const getNewestInfo = useRef({ lyricLines, info, isPlaying, lyricVersion, getProgress });
  getNewestInfo.current = { lyricLines, info, isPlaying, lyricVersion, getProgress };

  const sendInit = useCallback(() => {
    const { lyricLines, info } = getNewestInfo.current;
    window.node.event.sendMessageTo({
      from: "main",
      to: "miniplayer",
      type: "lyricInit",
      data: JSON.stringify({
        lyricLines,
        info
      } satisfies LyricInit)
    });
  }, []);
  const sendSync = useCallback(() => {
    const { lyricVersion, isPlaying, getProgress } = getNewestInfo.current;
    const { currentTime, duration } = getProgress();
    window.node.event.sendMessageTo({
      from: "main",
      to: "miniplayer",
      type: "lyricSync",
      data: JSON.stringify({
        lyricVersion,
        currentTime,
        duration,
        isPlaying
      } satisfies LyricSync)
    });
  }, []);

  const openMiniWin = useCallback(() => {
    window.node.event.createMiniplayerWindow();
    window.node.event.hidden("main");
    setTimeout(sendInit, 2000);
    setHasOpenMiniWin(true);
    addMessageHandler(({ from, to, type }) => {
      if (from === "miniplayer" && to === "main") {
        if (type === "closeMiniplayer") {
          setHasOpenMiniWin(false);
          removeMessageHandler("mini-win-close-handler");
        } else if (type === "lastTrack") {
          lastTrack();
        } else if (type === "nextTrack") {
          nextTrack();
        } else if (type === "playTrack") {
          play();
        }
      }
    }, "mini-win-close-handler");
  }, [lastTrack, nextTrack, play, sendInit]);
  useEffect(() => {
    if (!hasOpenMiniWin) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.addEventListener("timeupdate", sendSync);
    audio.addEventListener("loadstart", sendInit);
    return () => {
      audio.removeEventListener("timeupdate", sendSync);
      audio.removeEventListener("loadstart", sendInit);
    };
  }, [audioRef, hasOpenMiniWin, sendInit, sendSync]);
  // 额外同步歌词变化，歌词受网络影响可能会延迟得到数据
  useEffect(sendInit, [sendInit]);

  return { hasOpenMiniWin, openMiniWin };
}
