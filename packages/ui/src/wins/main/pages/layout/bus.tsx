import { z } from "zod";
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
import { useListenable } from "@/common/hooks/use-listenable";
import { useAudioOutput } from "@/common/hooks/use-audio-output";
import { SearchType, CommentSort, CommentType } from "@/common/enum";
import { NeteaseLyricSchema, NeteaseTrackRecord } from "@/common/netease/models";
import { NeteaseAPITrack, NeteaseAPISearch, NeteaseAPIComment } from "@/common/netease/api";
import {
  NeteaseServicesAlbum,
  NeteaseServicesLyric,
  NeteaseServicesTrack,
  NeteaseServicesArtist,
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
      try {
        if (change.type === "replacePlaylistAndPlay") {
          const { allIDs, trackID, sourceID, trackIdx, sourceType } = change;
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
        Log.error("Bus", "applyPlayerChangesError:", err);
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
  useEffect(() => {
    const sendOK = (callID: string, data: JsonValue) => {
      RendererWindow.process.send("message_deliver_agent_tool_response", {
        id: callID,
        ok: true,
        data: JSON.stringify(data)
      });
    };
    const sendErr = (callID: string, reason: string) => {
      RendererWindow.process.send("message_deliver_agent_tool_response", {
        id: callID,
        ok: false,
        reason
      });
    };
    return RendererWindow.process.listenMessage(
      "message_dispatch_agent_tool_request",
      (request) => {
        const id = request.id;
        switch (request.tool) {
          case "agent-tool-player-action":
            playerActionBus.dispatch(request.input.action);
            sendOK(id, { ok: true, message: "已将请求发送到播放器" });
            break;
          case "agent-tool-track-lyrics":
            NeteaseServicesLyric.id(request.input.id)
              .then((lyric) => sendOK(id, lyric.toToolJSONValue()))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-album-detail":
            NeteaseServicesAlbum.id(request.input.id)
              .then((album) => sendOK(id, album.toToolJSONValue()))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-track-detail":
            NeteaseServicesTrack.ids(request.input.ids)
              .then((tracks) => {
                if (tracks)
                  sendOK(
                    id,
                    tracks.map((track) => track.toToolJSONValue(request.input.mode))
                  );
                else sendErr(id, "track not found or network error");
              })
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-artist-detail":
            NeteaseServicesArtist.id(request.input.id)
              .then((artist) => {
                if (artist) sendOK(id, artist.toToolJSONValue());
                else sendErr(id, "artist not found or network error");
              })
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-playlist-detail":
            NeteaseServicesPlaylist.id(request.input.id)
              .then((playlist) => {
                if (playlist) sendOK(id, playlist.toToolJSONValue());
                else sendErr(id, "playlist not found or network error");
              })
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-track-playable":
            NeteaseServicesTrack.id(request.input.id)
              .then((track) => {
                if (track) sendOK(id, track.playable(userRef.current));
                else sendErr(id, "track not found or network error");
              })
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-track-comment": {
            let type;
            let sortType;
            switch (request.input.type) {
              case "playlist":
                type = CommentType.Playlist;
                break;
              case "album":
                type = CommentType.Album;
                break;
              case "track":
                type = CommentType.Song;
                break;
            }
            switch (request.input.sort) {
              case "hot":
                sortType = CommentSort.Hot;
                break;
              case "new":
                sortType = CommentSort.Time;
                break;
              case "recommend":
                sortType = CommentSort.Recommend;
                break;
            }
            NeteaseAPIComment.get({
              id: request.input.id,
              type,
              sortType,
              pageNo: request.input.page,
              pageSize: request.input.pageSize
            })
              .then((comments) => sendOK(id, comments as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          }
          case "agent-search": {
            let type;
            switch (request.input.type) {
              case "playlist":
                type = SearchType.PLAYLIST;
                break;
              case "album":
                type = SearchType.ALBUM;
                break;
              case "artist":
                type = SearchType.ARTIST;
                break;
              case "track":
                type = SearchType.SONG;
                break;
            }
            NeteaseAPISearch.search({
              type,
              keywords: request.input.keyword,
              offset: (request.input.page - 1) * request.input.pageSize,
              limit: request.input.pageSize
            })
              .then((res) => sendOK(id, res.result as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          }
          case "agent-tool-track-similar":
            NeteaseAPITrack.similar(request.input.id)
              .then((tracks) => sendOK(id, tracks as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-track-play": {
            const idx = player.playlist.locate(request.input.id);
            if (idx !== -1) {
              player.playlist.jump(idx);
              return sendOK(id, { ok: true, message: "已在播放列表中，已跳转" });
            }
            NeteaseServicesTrack.id(request.input.id)
              .then((track) => {
                if (!track) return sendErr(id, "track not found or network error");
                const record = new NeteaseTrackRecord({
                  detail: track,
                  sourceName: "other",
                  sourceID: 0
                });
                player.playlist.add(record, "next");
                player.playlist.jump(record);
                return sendOK(id, { ok: true, message: "已添加到播放列表，并已跳转" });
              })
              .catch((err) => sendErr(id, String(err)));
            break;
          }
          case "agent-tool-replace-lyrics": {
            const res = player.replaceLyricByAgent(request.input.content);
            if (res.ok) sendOK(id, "已替换");
            else sendErr(id, res.reason);
            break;
          }
          case "agent-lyric-schema":
            sendOK(id, z.toJSONSchema(NeteaseLyricSchema) as JsonValue);
            break;
          case "agent-tool-source-open": {
            RendererWindow.display.reactReadyAwait().then(() => {
              switch (request.input.type) {
                case "playlist":
                  RendererIPCMessageBus.display.deliver({
                    id: request.input.id,
                    source: "normal",
                    type: "playlist"
                  });
                  break;
                case "album":
                case "artist":
                  RendererIPCMessageBus.display.deliver({
                    type: request.input.type,
                    id: request.input.id
                  });
                  break;
              }
              sendOK(id, { ok: true, message: "已打开界面" });
            });
            break;
          }
          case "agent-tool-search-open":
            RendererWindow.display.reactReadyAwait().then(() => {
              RendererIPCMessageBus.display.deliver({
                type: "search",
                keyword: request.input.keyword
              });
              sendOK(id, { ok: true, message: "已打开搜索界面" });
            });
            break;
          case "agent-tool-comment-open":
            RendererWindow.comment.reactReadyAwait().then(() => {
              RendererIPCMessageBus.comment.deliver({
                type: request.input.type,
                id: request.input.id
              });
              sendOK(id, { ok: true, message: "已打开评论界面" });
            });
            break;
          default:
            sendErr(id, "tool not implemented");
        }
      }
    );
  }, [player, player.playlist, playerActionBus, userRef]);
  //#endregion

  return null;
};

export default memo(Bus);
