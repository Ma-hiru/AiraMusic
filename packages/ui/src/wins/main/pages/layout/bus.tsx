import { useAtomValue } from "jotai";
import { useLocation, useNavigate } from "react-router-dom";
import { memo, useRef, type FC, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { useUser } from "@/common/store/user";
import { themeAtom } from "@/wins/main/atoms/theme";
import { RendererDevice } from "@/common/lib/device";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { RendererModified } from "@/common/lib/modified";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { NeteaseTrackRecord } from "@/common/netease/models";
import { useListenable } from "@/common/hooks/use-listenable";
import { useAudioOutput } from "@/common/hooks/use-audio-output";
import { useAgentToolHandle } from "@/wins/main/hooks/use-agent-tool-handle";
import {
  NeteaseServicesAlbum,
  NeteaseServicesTrack,
  NeteaseServicesPlaylist
} from "@/common/netease/services";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import type { MessageData } from "@mahiru/ipc/types";

const Bus: FC<object> = () => {
  const theme = useAtomValue(themeAtom);
  const player = RendererPlayerHandle.usePlayer();
  const { setDevice, views, selected } = useAudioOutput(player.audio.outputTarget);

  //#region -------- 需要推送给别人的BUS --------
  // 1. progress、info、player 歌曲、歌词、主题、进度信息
  const updateProgressBus = useCallback(() => {
    RendererIPCMessageBus.progress.deliver(player.audio.progress);
  }, [player.audio.progress]);
  const updateMetaBus = useCallback(() => {
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
  const updateThemeBus = useCallback(() => {
    RendererIPCMessageBus.theme.deliver({
      backgroundCover: theme.backgroundCover ?? undefined,
      theme: {
        mainColor: theme.mainColor,
        secondaryColor: theme.secondaryColor,
        textColorOnMain: theme.textColorOnMain,
        textColorOnSecondary: theme.textColorOnSecondary,
        textNormalColor: theme.textColor,
        themeColors: theme.themeColors
      }
    });
  }, [
    theme.backgroundCover,
    theme.mainColor,
    theme.secondaryColor,
    theme.textColor,
    theme.textColorOnMain,
    theme.textColorOnSecondary,
    theme.themeColors
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
  useEffect(() => player.addListener(updateMetaBus), [player, updateMetaBus]);
  useEffect(updateThemeBus, [updateThemeBus]);

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
    updateMetaBus();
    updateProgressBus();
    updateThemeBus();
    updateOutputs();
    updateHistoryBus();
  });
  //#endregion

  //#region -------- 需要接收并处理的BUS/消息 --------
  // 1. playerAction 播放动作，比如上一首、下一首等
  const windowCurrent = useListenable(RendererWindow.current);
  const playerActionBus = useListenable(RendererIPCMessageBus.playerAction);
  useEffect(() => {
    const actions = playerActionBus.data;
    if (actions.length === 0) return;
    RendererIPCMessageBus.consume(playerActionBus.type);

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
          RendererWindow.process.send("message_dispatch_should_close", true);
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
    RendererIPCMessageBus.consume(mainBusUpdater.type);

    for (const action of actions) {
      switch (action) {
        case "track-meta":
          updateMetaBus();
          break;
        case "track-progress":
          updateProgressBus();
          break;
        case "theme":
          updateThemeBus();
          break;
        case "output":
          updateOutputs();
          break;
        case "history":
          updateHistoryBus();
          break;
      }
    }
  }, [
    updateThemeBus,
    updateMetaBus,
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
        case "fm":
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
      let actionError: unknown;
      try {
        if (change.type === "playTrack") {
          const { trackID } = change;
          if (player.current.track?.id === trackID) {
            player.audio.play();
            continue;
          }

          const existingIndex = player.playlist.locate(trackID);
          if (existingIndex !== -1) {
            player.playlist.jump(existingIndex);
            continue;
          }

          const detail = await NeteaseServicesTrack.idEnsure(trackID);
          const track = new NeteaseTrackRecord({
            detail,
            sourceID: 0,
            sourceName: "other"
          });
          player.playlist.add(track, "next");
          player.playlist.jump(track);
        } else if (change.type === "replacePlaylistAndPlay") {
          const { allIDs, trackID, sourceID, trackIdx, sourceType } = change;

          const records = await fetchTrackList(sourceType, sourceID, allIDs);
          const track =
            records.find((record) => record.id === trackID) ?? records[trackIdx] ?? records[0];

          if (!track) throw new Error("找不到可播放的歌曲");
          if (player.playlist.same(records)) {
            player.playlist.jump(track);
          } else {
            player.playlist.replace(records, track);
          }
        } else if (change.type === "addListToPlaylistEnd") {
          const { allIDs, sourceID, sourceType } = change;

          const records = await fetchTrackList(sourceType, sourceID, allIDs);

          player.playlist.addList(records);
        } else if (change.type === "addToPlaylistNext" || change.type === "addToPlaylistLast") {
          const { type, trackID, sourceID, sourceType } = change;
          if (player.current.track?.id === trackID) continue;

          const track = new NeteaseTrackRecord({
            detail: await NeteaseServicesTrack.idEnsure(trackID),
            sourceName: sourceType,
            sourceID: sourceID
          });
          player.playlist.add(track, type === "addToPlaylistNext" ? "next" : "end");
        }
      } catch (err) {
        actionError = err;
        Log.error("Bus", "applyPlayerChangesError:", err);
      } finally {
        if (change.requestID) {
          RendererIPCMessageBus.playlistActionResult.deliver({
            requestID: change.requestID,
            ok: !actionError,
            ...(actionError
              ? {
                  error: actionError instanceof Error ? actionError.message : "播放操作失败"
                }
              : {})
          });
        }
      }
    }

    applyingChanges.current = false;
  }, [player]);
  useEffect(() => {
    const changes = playlistActionBus.data;
    if (changes.length === 0) return;
    RendererIPCMessageBus.consume(playlistActionBus.type);

    // 添加变更数据到队列
    appliedChangesQueue.current.push(...changes);
    // 启动变更应用
    void applyPlayerChanges();
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
              action.source === "like" ? "like" : "normal"
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

  // 6. 处理资源修改重载请求
  const modifiedBus = useListenable(RendererIPCMessageBus.modified);
  // 用 ref 读取最新 user/location 不然容易依赖循环
  const userRef = useLatestRef(useUser());
  const locationRef = useLatestRef(useLocation());
  useEffect(() => {
    const modifies = modifiedBus.data;
    if (modifies.length === 0) return;
    RendererIPCMessageBus.consume(modifiedBus.type);

    for (const m of modifies) {
      switch (m.type) {
        case "playlist-update":
          RendererModified.mark({
            type: "playlist",
            id: m.id,
            source: m.source
          });
          break;
        case "user-playlist": {
          const user = userRef.current;
          user &&
            RendererModified.mark({
              type: "userPlaylist",
              user
            });
          break;
        }
        case "remove-playlist": {
          const { id } = RoutePathMain.playlist.parseQuery(locationRef.current, false);
          if (id !== m.id) break;
          RendererModified.mark({
            navigate,
            type: "removePlaylist",
            id: m.id,
            homePath: RoutePathMain.home
          });
          break;
        }
      }
    }
  }, [modifiedBus.data, modifiedBus.type, navigate, userRef, locationRef]);
  // 7. 处理Agent工具请求
  useAgentToolHandle();
  //#endregion

  return null;
};

export default memo(Bus);
