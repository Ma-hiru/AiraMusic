import { useListenable } from "@/common/hooks/use-listenable";
import { type FC, memo, useCallback, useEffect, useRef } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
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
import { useAtomValue } from "jotai";
import { themeAtom } from "@/wins/main/atoms/theme";
import { useAudioOutput } from "@/common/hooks/use-audio-output";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { RendererDevice } from "@/common/lib/device";
import type { MessageData } from "@mahiru/ipc/types";
import RendererPlayerHandle from "@/wins/main/lib/handle";

const Bus: FC<object> = () => {
  const theme = useAtomValue(themeAtom);
  const player = RendererPlayerHandle.usePlayer();
  const { selected, views, setDevice } = useAudioOutput(player.audio.outputTarget);

  //#region -------- 需要推送给别人的BUS --------
  // 1. progress、info、player 歌曲、歌词、主题、进度信息
  const updateProgressBus = useCallback(() => {
    RendererIPCMessageBus.progress.deliver(player.audio.progress);
  }, [player.audio.progress]);
  const updatePlayerBus = useCallback(() => {
    RendererIPCMessageBus.trackMeta.deliver({
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
    RendererIPCMessageBus.theme.deliver({
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

  // 2. historyBus 播放历史推送（仅display）
  const updateHistoryBus = useCallback(() => {
    RendererIPCMessageBus.history.deliver({ list: player.history.list });
  }, [player.history]);
  useEffect(() => player.history.addListener(updateHistoryBus), [player.history, updateHistoryBus]);

  // 3. outputBus 播放设备推送（仅display）
  const updateOutputs = useCallback(() => {
    RendererDevice.platform.then((platform) => {
      // window 自带分类
      if (platform === "win32") {
        return RendererIPCMessageBus.output.deliver({
          selected,
          views: views.map((v) => ({
            deviceId: v.deviceId,
            displayName: v.label
          }))
        });
      }
      RendererIPCMessageBus.output.deliver({
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
  const playerActionBus = useListenable(RendererIPCMessageBus.playerAction);
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
    RendererIPCMessageBus.consume(playerActionBus.type);
  }, [
    player.audio,
    player.playlist,
    playerActionBus.data,
    playerActionBus.type,
    updateBus,
    windowCurrent
  ]);

  // 2. mainBusUpdater 请求式bus, 请求bus再次推送
  const mainBusUpdater = useListenable(RendererIPCMessageBus.updater);
  useEffect(() => {
    const actions = mainBusUpdater.data;
    if (actions.length === 0) return;
    for (const action of actions) {
      switch (action) {
        case "track-meta":
          updatePlayerBus();
          break;
        case "track-progress":
          updateProgressBus();
          break;
        case "theme":
          updateInfoBus();
          break;
        case "output":
          updateOutputs();
          break;
        case "history":
          updateHistoryBus();
          break;
      }
    }
    RendererIPCMessageBus.consume(mainBusUpdater.type);
  }, [
    updateInfoBus,
    updatePlayerBus,
    updateProgressBus,
    updateOutputs,
    updateHistoryBus,
    mainBusUpdater.data,
    mainBusUpdater.type
  ]);

  // 3. playerChangeBus 播放列表变化处理
  const playlistActionBus = useListenable(RendererIPCMessageBus.playlistAction);
  // 是否正在应用更改
  const applyingChanges = useRef(false);
  // 变更队列
  const appliedChangesQueue = useRef<MessageData<"bus_dispatch_playlist_action">[]>([]);

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

    let change: Undefinable<MessageData<"bus_dispatch_playlist_action">>;
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
    const changes = playlistActionBus.data;
    if (changes.length === 0) return;
    // 添加变更数据到队列
    appliedChangesQueue.current.push(...changes);
    // 启动变更应用
    void applyPlayerChanges();
    RendererIPCMessageBus.consume(playlistActionBus.type);
  }, [applyPlayerChanges, playlistActionBus.data, playlistActionBus.type]);

  // 4. 处理 display 合并消息
  const navigate = useNavigate();
  const displayBus = useListenable(RendererIPCMessageBus.display);
  useEffect(() => {
    const data = displayBus.data;
    if (!data) return;
    for (const action of data) {
      switch (action.type) {
        case "album":
          navigate(RoutePath.withQuery(RoutePathMain.album, { id: action.id }));
          break;
        case "artist":
          navigate(RoutePath.withQuery(RoutePathMain.artist, { id: action.id }));
          break;
        case "playlist":
          navigate(
            RoutePathMain.playlist.withQuery(
              action.id,
              action.source === "like" ? PlaylistSource.Like : PlaylistSource.Normal
            )
          );
          break;
        case "history":
          navigate(RoutePathMain.history);
          break;
      }
    }

    RendererWindow.current.focus();
  }, [displayBus.data, navigate]);

  // 5. 处理设备切换
  const viewsRef = useLatestRef(views);
  useEffect(() => {
    return RendererWindow.display.listenMessage(
      "message_dispatch_device_output_set",
      (deviceId) => {
        const views = viewsRef.current;
        if (!views.find((v) => v.deviceId === deviceId)) return;
        setDevice(deviceId);
      }
    );
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
