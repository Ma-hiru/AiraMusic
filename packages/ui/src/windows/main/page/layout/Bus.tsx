import { useListenable } from "@mahiru/ui/common/hooks/useListenable";
import { type FC, memo, useCallback, useEffect, useRef } from "react";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/common/source/electron/services";
import { NeteaseServicesTrack } from "@mahiru/ui/common/source/netease/services";
import { NeteaseTrackRecord } from "@mahiru/ui/common/source/netease/models";
import { Log } from "@mahiru/ui/common/constants/dev";
import { useNavigate } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@mahiru/ui/common/routes";
import { PlaylistSource } from "@mahiru/ui/common/enum";
import { type MessageData } from "@mahiru/ipc/renderer";
import { useAtomValue } from "jotai";
import { themeAtom } from "@mahiru/ui/windows/main/atoms/theme";
import AppEntry from "@mahiru/ui/windows/main/entry";

const Bus: FC<object> = () => {
  const theme = useAtomValue(themeAtom);
  const windowCurrent = useListenable(ElectronServicesWindow.current);
  const playerActionBus = useListenable(ElectronServicesBus.playerAction);
  const playerChangeBus = useListenable(ElectronServicesBus.playerChange);
  const mainBusUpdater = useListenable(ElectronServicesBus.mainBusUpdater);
  const player = AppEntry.usePlayer();

  const updateProgressBus = useCallback(() => {
    ElectronServicesBus.progress.send(player.audio.progress);
  }, [player.audio.progress]);

  const updatePlayerBus = useCallback(() => {
    ElectronServicesBus.player.send({
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
    ElectronServicesBus.info.send({
      backgroundCover: theme.backgroundCover ?? undefined,
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
    ElectronServicesBus.clear("playerActionBus");
  }, [player.audio, player.playlist, playerActionBus.data, windowCurrent]);

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
    ElectronServicesBus.clear("updateBus");
  }, [updateInfoBus, updatePlayerBus, updateProgressBus, mainBusUpdater.data]);

  // 是否正在应用更改
  const applyingChanges = useRef(false);
  // 变更队列
  const appliedChangesQueue = useRef<MessageData<"playerChangeBus">[]>([]);
  const applyPlayerChanges = useCallback(async () => {
    if (applyingChanges.current) return;
    applyingChanges.current = true;

    let change: Undefinable<MessageData<"playerChangeBus">>;
    while ((change = appliedChangesQueue.current.shift())) {
      try {
        if (change.type === "replacePlaylistAndPlay") {
          const { trackID, trackIdx, sourceType, sourceID, allIDs } = change;
          if (player.current.track?.id === trackID) continue;

          const tracks = await NeteaseServicesTrack.ids(allIDs);
          const records = tracks.map(
            (detail) => new NeteaseTrackRecord({ detail, sourceID, sourceName: sourceType })
          );

          const track = records[trackIdx] ?? records[0];
          if (!track) continue;
          if (player.playlist.same(records)) {
            player.playlist.jump(track);
          } else {
            player.playlist.replace(records, track);
          }
        } else if (change.type === "addListToPlaylistEnd") {
          const { sourceType, sourceID, allIDs } = change;
          const tracks = await NeteaseServicesTrack.ids(allIDs);
          const records = tracks.map(
            (detail) => new NeteaseTrackRecord({ detail, sourceID, sourceName: sourceType })
          );
          player.playlist.addList(records);
        } else if (change.type === "addToPlaylistNext" || change.type === "addToPlaylistLast") {
          const { sourceID, sourceType, trackID, type } = change;
          if (player.current.track?.id === trackID) continue;

          const track = new NeteaseTrackRecord({
            detail: await NeteaseServicesTrack.idEnsure(trackID),
            sourceName: sourceType,
            sourceID: sourceID
          });
          player.playlist.add(track, type === "addToPlaylistNext" ? "next" : "end");
        }
      } catch (err) {
        Log.error("Bus", "applyPlayerChangesError:", err);
      }
    }

    applyingChanges.current = false;
  }, [player]);
  useEffect(() => {
    const changes = playerChangeBus.data;
    if (changes.length === 0) return;
    // 添加变更数据到队列
    appliedChangesQueue.current.push(...changes);
    // 清空变更数据
    ElectronServicesBus.clear("playerChangeBus");
    // 启动变更应用
    void applyPlayerChanges();
  }, [applyPlayerChanges, playerChangeBus.data]);

  useEffect(() => {
    AppEntry.busUpdater = () => updateBus.current();
    return () => {
      AppEntry.busUpdater = undefined;
    };
  }, [updateBus]);

  const navigate = useNavigate();
  useEffect(() => {
    return ElectronServicesWindow.display.listenMessage("mergeDisplay", (data) => {
      switch (data.type) {
        case "album":
          navigate(RoutePath.withQuery(RoutePathMain.album, { id: data.id }));
          break;
        case "artist":
          navigate(RoutePath.withQuery(RoutePathMain.artist, { id: data.id }));
          break;
        case "playlist":
          navigate(
            RoutePathMain.playlist.withQuery(
              data.id,
              data.source === "like" ? PlaylistSource.Like : PlaylistSource.Normal
            )
          );
          break;
      }
      ElectronServicesWindow.current.focus();
    });
  }, [navigate]);

  return null;
};

export default memo(Bus);
