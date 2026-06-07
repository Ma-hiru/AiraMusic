import { useListenable } from "@/common/hooks/use-listenable";
import { type FC, memo, useCallback, useEffect, useRef } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererEventBus } from "@/common/lib/bus";
import {
  NeteaseServicesAlbum,
  NeteaseServicesPlaylist,
  NeteaseServicesTrack
} from "@/common/netease/services";
import { NeteaseTrackRecord } from "@/common/netease/models";
import { Log } from "@/common/lib/log";
import { useNavigate } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { PlaylistSource } from "@/common/enum";
import { type MessageData } from "@mahiru/ipc/renderer";
import { useAtomValue } from "jotai";
import { themeAtom } from "@/wins/main/atoms/theme";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import { useAudioOutput } from "@/common/hooks/use-audio-output";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { RendererDevice } from "@/common/lib/device";

const Bus: FC<object> = () => {
  const theme = useAtomValue(themeAtom);
  const player = RendererPlayerHandle.usePlayer();
  const { selected, views, setDevice } = useAudioOutput(player.audio.outputTarget);

  //#region -------- 需要推送给别人的BUS --------
  // 1. progress、info、player 歌曲、歌词、主题、进度信息
  const updateProgressBus = useCallback(() => {
    RendererEventBus.progress.send(player.audio.progress);
  }, [player.audio.progress]);
  const updatePlayerBus = useCallback(() => {
    RendererEventBus.player.send({
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
    RendererEventBus.info.send({
      backgroundCover: theme.backgroundCover ?? undefined,
      theme: {
        mainColor: theme.mainColor,
        secondaryColor: theme.secondaryColor,
        textColor: theme.textColorOnMain,
        textNormalColor: theme.textColor
      }
    });
  }, [
    theme.backgroundCover,
    theme.mainColor,
    theme.secondaryColor,
    theme.textColor,
    theme.textColorOnMain
  ]);
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

  // 2. outputBus 播放设备推送
  const updateOutputs = useCallback(() => {
    RendererDevice.platform.then((platform) => {
      // window 自带分类
      if (platform === "win32") {
        return RendererEventBus.output.send({
          selected,
          views: views.map((v) => ({
            deviceId: v.deviceId,
            displayName: v.label
          }))
        });
      }
      RendererEventBus.output.send({
        selected,
        views: views.map((v) => {
          let displayName;
          if (v.label === v.displayName) {
            displayName = v.label;
          } else if (v.label && v.displayName) {
            displayName = `${v.displayName}(${v.label})`;
          } else {
            displayName = v.label || v.displayName || "Unknown Device";
          }
          return {
            deviceId: v.deviceId,
            displayName
          };
        })
      });
    });
  }, [selected, views]);
  useEffect(updateOutputs, [updateOutputs]);

  const updateBus = useLatestRef(() => {
    updatePlayerBus();
    updateProgressBus();
    updateInfoBus();
    updateOutputs();
  });
  //#endregion

  //#region -------- 需要接收并处理的BUS/消息 --------
  // 1. playerAction 播放动作，比如上一首、下一首等
  const windowCurrent = useListenable(RendererWindow.current);
  const playerActionBus = useListenable(RendererEventBus.playerAction);
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
          RendererPlayerHandle.player.toggleLyric("rm");
          RendererPlayerHandle.player.afterUpdate(updateBus.current);
          break;
        case "toggle-lyric-version-tl":
          RendererPlayerHandle.player.toggleLyric("tl");
          RendererPlayerHandle.player.afterUpdate(updateBus.current);
          break;
        case "update":
          updateBus.current();
          break;
      }
    }
    RendererEventBus.clear("playerActionBus");
  }, [player.audio, player.playlist, playerActionBus.data, updateBus, windowCurrent]);

  // 2. mainBusUpdater 请求式bus, 请求bus再次推送
  const mainBusUpdater = useListenable(RendererEventBus.mainBusUpdater);
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
        case "output":
          updateOutputs();
          break;
      }
    }
    RendererEventBus.clear("updateBus");
  }, [updateInfoBus, updatePlayerBus, updateProgressBus, mainBusUpdater.data, updateOutputs]);

  // 3. playerChangeBus 播放列表变化处理
  const playerChangeBus = useListenable(RendererEventBus.playerChange);
  // 是否正在应用更改
  const applyingChanges = useRef(false);
  // 变更队列
  const appliedChangesQueue = useRef<MessageData<"playerChangeBus">[]>([]);

  const applyPlayerChanges = useCallback(async () => {
    if (applyingChanges.current) return;
    applyingChanges.current = true;

    const fetchTrackList = async (
      sourceType: NeteaseTrackRecordSourceType,
      sourceID: number,
      allIDs: number[]
    ) => {
      switch (sourceType) {
        case "playlist": {
          const playlist = await NeteaseServicesPlaylist.id(sourceID);
          return NeteaseTrackRecord.fromPlaylist(playlist);
        }
        case "album": {
          const album = await NeteaseServicesAlbum.id(sourceID);
          return album.tracks;
        }
        case "other": {
          const tracks = await NeteaseServicesTrack.ids(allIDs);
          return tracks.map(
            (detail) => new NeteaseTrackRecord({ detail, sourceID, sourceName: sourceType })
          );
        }
      }
    };

    let change: Undefinable<MessageData<"playerChangeBus">>;
    while ((change = appliedChangesQueue.current.shift())) {
      try {
        if (change.type === "replacePlaylistAndPlay") {
          const { trackID, trackIdx, sourceType, sourceID, allIDs } = change;
          if (player.current.track?.id === trackID) continue;

          const records = await fetchTrackList(sourceType, sourceID, allIDs);
          const track = records[trackIdx] ?? records[0];

          if (!track) continue;
          if (player.playlist.same(records)) {
            player.playlist.jump(track);
          } else {
            player.playlist.replace(records, track);
          }
        } else if (change.type === "addListToPlaylistEnd") {
          const { sourceType, sourceID, allIDs } = change;

          const records = await fetchTrackList(sourceType, sourceID, allIDs);

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
    RendererEventBus.clear("playerChangeBus");
    // 启动变更应用
    void applyPlayerChanges();
  }, [applyPlayerChanges, playerChangeBus.data]);

  // 4. 处理 display 合并消息
  const navigate = useNavigate();
  useEffect(() => {
    return RendererWindow.display.listenMessage("mergeDisplay", (data) => {
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
      RendererWindow.current.focus();
    });
  }, [navigate]);

  // 5. 处理设备切换
  const viewsRef = useLatestRef(views);
  useEffect(() => {
    return RendererWindow.display.listenMessage("changeOutput", (deviceId) => {
      const views = viewsRef.current;
      if (!views.find((v) => v.deviceId === deviceId)) return;
      setDevice(deviceId);
    });
  }, [setDevice, viewsRef]);
  //#endregion

  // 将bus更新函数挂载，可以在其他地方使用
  useEffect(() => {
    RendererPlayerHandle.busUpdater = () => updateBus.current();
    return () => {
      RendererPlayerHandle.busUpdater = undefined;
    };
  }, [updateBus]);

  return null;
};

export default memo(Bus);
