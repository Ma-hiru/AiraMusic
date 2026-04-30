import AppEntry from "@mahiru/ui/windows/main/entry";
import ElectronServices from "@mahiru/ui/public/source/electron/services";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";

import { FC, memo, useCallback, useEffect, useRef } from "react";
import { useLayoutStore } from "@mahiru/ui/windows/main/store/layout";

const Bus: FC<object> = () => {
  const { theme } = useLayoutStore();
  const windowCurrent = useListenableHook(ElectronServices.Window.current);
  const playerActionBus = useListenableHook(ElectronServices.Bus.playerAction);
  const mainBusUpdater = useListenableHook(ElectronServices.Bus.mainBusUpdater);
  const player = AppEntry.usePlayer();

  const updateProgressBus = useCallback(() => {
    ElectronServices.Bus.progress.send(player.audio.progress);
  }, [player.audio.progress]);

  const updatePlayerBus = useCallback(() => {
    ElectronServices.Bus.player.send({
      track: player.current.track,
      lyric: player.current.lyric,
      repeat: player.playlist.repeat,
      shuffle: player.playlist.shuffle,
      rmActive: player.current?.rmActive || false,
      tlActive: player.current?.tlActive || false,
      noteActive: player.current?.noteActive || false,
      status: player.statusText
    });
  }, [player]);

  const updateInfoBus = useCallback(() => {
    ElectronServices.Bus.info.send({
      backgroundCover: theme.backgroundCover,
      theme: {
        mainColor: theme.mainColor,
        secondaryColor: theme.secondaryColor,
        textColor: theme.textColorOnMain
      }
    });
  }, [theme.backgroundCover, theme.mainColor, theme.secondaryColor, theme.textColorOnMain]);

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
    const actions = playerActionBus.data;
    if (actions.length === 0) return;
    for (const action of actions) {
      switch (action) {
        case "play":
          player.audio.play();
          break;
        case "pause":
          player.audio.pause();
          break;
        case "previous":
          player.playlist.last(true);
          break;
        case "next":
          player.playlist.next(true);
          break;
        case "exit":
          windowCurrent.close();
          break;
        case "toggle-lyric-version-rm":
          AppEntry.player.toggleLyric("rm");
          AppEntry.player.afterUpdate(updateBus.current);
          break;
        case "toggle-lyric-version-tl":
          AppEntry.player.toggleLyric("tl");
          AppEntry.player.afterUpdate(updateBus.current);
          break;
        case "update":
          updateBus.current();
          break;
      }
    }
    playerActionBus.finish();
  }, [
    player.audio,
    player.playlist,
    // 监听变化数据
    playerActionBus.data,
    playerActionBus,
    windowCurrent
  ]);

  useEffect(() => {
    const actions = mainBusUpdater.data;
    if (actions.length === 0) return;
    for (const action of actions) {
      switch (action) {
        case "player":
          updatePlayerBus();
          break;
        case "progress":
          updateProgressBus();
          break;
        case "info":
          updateInfoBus();
          break;
      }
    }
    mainBusUpdater.finish();
  }, [
    updateInfoBus,
    updatePlayerBus,
    updateProgressBus,
    // 监听变化数据
    mainBusUpdater.data,
    mainBusUpdater
  ]);

  useEffect(() => {
    AppEntry.busUpdater = () => updateBus.current();
    return () => {
      AppEntry.busUpdater = undefined;
    };
  }, [updateBus]);

  return null;
};

export default memo(Bus);
