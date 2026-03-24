import { FC, memo, useCallback, useEffect } from "react";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import AppWindow from "@mahiru/ui/public/entry/window";
import AppInstance from "@mahiru/ui/main/entry/instance";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

const Bus: FC<object> = () => {
  const { theme } = useLayoutStore();
  const windowAll = useListenableHook(AppWindow.all);
  const windowCurrent = useListenableHook(AppWindow.current);
  const player = useListenableHook(AppInstance.player);

  const updateProgressBus = useCallback(() => {
    windowAll.send("progressBus", player.audio.progress);
  }, [player.audio.progress, windowAll]);

  const updatePlayerBus = useCallback(() => {
    windowAll.send("playerBus", {
      track: player.current.track,
      lyric: player.current.lyric,
      lyricVersion: player.current.lyric?.currentVersion,
      repeat: player.playlist.repeat,
      shuffle: player.playlist.shuffle,
      status: player.statusText
    });
  }, [player, windowAll]);

  useEffect(() => {
    player.audio.addEventListener("progress", updateProgressBus, { passive: true });
    player.audio.addEventListener("play", updateProgressBus, { passive: true });
    player.audio.addEventListener("pause", updateProgressBus, { passive: true });
    player.audio.addEventListener("error", updateProgressBus, { passive: true });
    player.audio.addEventListener("loadstart", updateProgressBus, { passive: true });
    return () => {
      player.audio.removeEventListener("progress", updateProgressBus);
      player.audio.removeEventListener("play", updateProgressBus);
      player.audio.removeEventListener("pause", updateProgressBus);
      player.audio.removeEventListener("error", updateProgressBus);
      player.audio.removeEventListener("loadstart", updateProgressBus);
    };
  }, [player.audio, updateProgressBus]);

  useEffect(() => player.addListener(updatePlayerBus), [player, updatePlayerBus]);

  useEffect(() => {
    windowAll.send("infoBus", {
      backgroundCover: theme.backgroundCover,
      theme: {
        mainColor: theme.mainColor,
        secondaryColor: theme.secondaryColor,
        textColor: theme.secondaryColor
      }
    });
  }, [theme.backgroundCover, theme.mainColor, theme.secondaryColor, windowAll]);

  useEffect(() => {
    windowAll.listenAll("playerActionBus", ({ data }) => {
      switch (data) {
        case "play":
          return player.audio.play();
        case "pause":
          return player.audio.pause();
        case "previous":
          return player.playlist.last(true);
        case "next":
          return player.playlist.next(true);
        case "exit":
          return windowCurrent.close();
      }
    });
  }, [player.audio, player.playlist, windowAll, windowCurrent]);
  return <></>;
};

export default memo(Bus);
