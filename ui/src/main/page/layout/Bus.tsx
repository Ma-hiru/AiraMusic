import AppBus from "@mahiru/ui/public/entry/bus";
import AppWindow from "@mahiru/ui/public/entry/window";
import AppInstance from "@mahiru/ui/main/entry/instance";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import { FC, memo, useCallback, useEffect, useRef } from "react";
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
      repeat: player.playlist.repeat,
      shuffle: player.playlist.shuffle,
      rmActive: player.current?.rmActive || false,
      tlActive: player.current?.tlActive || false,
      status: player.statusText
    });
  }, [player, windowAll]);

  const updateInfoBus = useCallback(() => {
    windowAll.send("infoBus", {
      backgroundCover: theme.backgroundCover,
      theme: {
        mainColor: theme.mainColor,
        secondaryColor: theme.secondaryColor,
        textColor: theme.textColorOnMain
      }
    });
  }, [
    theme.backgroundCover,
    theme.mainColor,
    theme.secondaryColor,
    theme.textColorOnMain,
    windowAll
  ]);

  const updateBus = useRef(() => {
    updatePlayerBus();
    updateProgressBus();
    updateInfoBus();
  });

  updateBus.current = () => {
    updatePlayerBus();
    updateProgressBus();
    updateInfoBus();
  };

  useEffect(() => {
    player.audio.addEventListener("timeupdate", updateProgressBus, { passive: true });
    player.audio.addEventListener("play", updateProgressBus, { passive: true });
    player.audio.addEventListener("pause", updateProgressBus, { passive: true });
    player.audio.addEventListener("error", updateProgressBus, { passive: true });
    player.audio.addEventListener("loadstart", updateProgressBus, { passive: true });
    return () => {
      player.audio.removeEventListener("timeupdate", updateProgressBus);
      player.audio.removeEventListener("play", updateProgressBus);
      player.audio.removeEventListener("pause", updateProgressBus);
      player.audio.removeEventListener("error", updateProgressBus);
      player.audio.removeEventListener("loadstart", updateProgressBus);
    };
  }, [player.audio, updateProgressBus]);

  useEffect(() => player.addListener(updatePlayerBus), [player, updatePlayerBus]);

  useEffect(updateInfoBus, [updateInfoBus]);

  useEffect(() => {
    windowAll.listenAll("playerActionBus", async ({ data }) => {
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
        case "toggle-lyric-version-rm":
          AppInstance.player.toggleLyric("rm");
          AppInstance.player.afterUpdate(updateBus.current);
          return;
        case "toggle-lyric-version-tl":
          AppInstance.player.toggleLyric("tl");
          AppInstance.player.afterUpdate(updateBus.current);
          return;
        case "update":
          return updateBus.current();
      }
    });
  }, [player.audio, player.playlist, windowAll, windowCurrent]);

  useEffect(() => AppBus.injectUpdater(() => updateBus.current()), [updateBus]);

  return null;
};

export default memo(Bus);
