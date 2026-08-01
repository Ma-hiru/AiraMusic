import { z } from "zod";
import { useEffect, useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { settingsStoreSnapshot } from "@/common/store/settings";
import { useUser, userStoreSnapshot } from "@/common/store/user";
import { SearchType, CommentSort, CommentType, TrackQuality } from "@/common/enum";
import { RendererTool, type RendererToolDetail } from "@/common/lib/renderer-tool";
import { NeteaseUser, NeteaseLyricSchema, NeteaseTrackRecord } from "@/common/netease/models";
import {
  NeteaseServicesAlbum,
  NeteaseServicesLyric,
  NeteaseServicesTrack,
  NeteaseServicesArtist,
  NeteaseServicesPlaylist
} from "@/common/netease/services";
import {
  NeteaseAPIHome,
  NeteaseAPIUser,
  NeteaseAPIAlbum,
  NeteaseAPITrack,
  NeteaseAPIArtist,
  NeteaseAPIRecord,
  NeteaseAPISearch,
  NeteaseAPIComment,
  NeteaseAPIPlaylist
} from "@/common/netease/api";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import type { AgentToolRequest } from "@mahiru/ipc/types";

const AgentToolRequestControllers = new Map<string, AbortController>();
const AgentToolRequestDetails = new Map<string, RendererToolDetail>();

const beginAgentToolRequest = (id: string, detail: RendererToolDetail) => {
  AgentToolRequestControllers.get(id)?.abort();
  const controller = new AbortController();
  AgentToolRequestControllers.set(id, controller);
  AgentToolRequestDetails.set(id, detail);
  return controller;
};

const cancelAgentToolRequest = (id: string) => {
  const controller = AgentToolRequestControllers.get(id);
  if (!controller) return;
  controller.abort();
  AgentToolRequestControllers.delete(id);
  AgentToolRequestDetails.delete(id);
};

const finishAgentToolRequest = (id: string) => {
  const controller = AgentToolRequestControllers.get(id);
  if (!controller || controller.signal.aborted) return false;
  AgentToolRequestControllers.delete(id);
  return true;
};

const isAgentToolRequestActive = (id: string, controller: AbortController) =>
  AgentToolRequestControllers.get(id) === controller && !controller.signal.aborted;

export function useAgentToolHandle() {
  const player = RendererPlayerHandle.player;
  const userRef = useLatestRef(useUser());

  const handleAgentToolRequest = useCallback(
    (request: AgentToolRequest) => {
      const id = request.id;
      const detail = request.detail ?? "standard";
      const controller = beginAgentToolRequest(id, detail);
      try {
        switch (request.tool) {
          case "agent-tool-player-action": {
            switch (request.input.action) {
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
              case "toggle-lyric-version-rm":
                player.toggleLyric("rm");
                break;
              case "toggle-lyric-version-tl":
                player.toggleLyric("tl");
                break;
            }
            sendOK(id, {
              ok: true,
              action: request.input.action,
              currentTrackID: player.current.track?.id ?? null,
              status: player.audio.audio.paused ? "paused" : "playing"
            });
            break;
          }
          case "agent-tool-track-lyrics":
            NeteaseServicesLyric.id(request.input.id, controller.signal)
              .then((lyric) => sendOK(id, RendererTool.lyric(lyric, request.input.mode, detail)))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-album-detail":
            NeteaseServicesAlbum.id(request.input.id, controller.signal)
              .then((album) => sendOK(id, RendererTool.album(album, detail)))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-track-detail":
            NeteaseServicesTrack.ids(request.input.ids, 100, 5, controller.signal)
              .then((tracks) => {
                if (tracks)
                  sendOK(
                    id,
                    RendererTool.list(
                      tracks,
                      (track) => RendererTool.track(track, request.input.mode, detail),
                      RendererTool.options(detail, {
                        maxItems: request.input.ids.length
                      })
                    )
                  );
                else sendErr(id, "track not found or network error");
              })
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-artist-detail":
            NeteaseServicesArtist.id(request.input.id, controller.signal)
              .then((artist) => {
                if (artist) sendOK(id, RendererTool.artist(artist, detail));
                else sendErr(id, "artist not found or network error");
              })
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-playlist-detail":
            NeteaseServicesPlaylist.id(request.input.id, controller.signal)
              .then((playlist) => {
                if (playlist) sendOK(id, RendererTool.playlist(playlist, detail));
                else sendErr(id, "playlist not found or network error");
              })
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-track-playable":
            NeteaseServicesTrack.id(request.input.id, controller.signal)
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
            NeteaseAPIComment.get(
              {
                id: request.input.id,
                type,
                sortType,
                pageNo: request.input.page,
                pageSize: request.input.pageSize
              },
              controller.signal
            )
              .then((comments) => sendOK(id, RendererTool.comments(comments, detail)))
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
            NeteaseAPISearch.search(
              {
                type,
                keywords: request.input.keyword,
                offset: (request.input.page - 1) * request.input.pageSize,
                limit: request.input.pageSize
              },
              controller.signal
            )
              .then((res) =>
                sendOK(
                  id,
                  RendererTool.search(
                    res.result,
                    request.input.type,
                    {
                      page: request.input.page,
                      pageSize: request.input.pageSize
                    },
                    detail
                  )
                )
              )
              .catch((err) => sendErr(id, String(err)));
            break;
          }
          case "agent-tool-track-similar":
            NeteaseAPITrack.similar(request.input.id, controller.signal)
              .then((tracks) => sendOK(id, tracks as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-track-play": {
            const idx = player.playlist.locate(request.input.id);
            if (idx !== -1) {
              player.playlist.jump(idx);
              return sendOK(id, { ok: true, message: "已在播放列表中，已跳转" });
            }
            NeteaseServicesTrack.id(request.input.id, controller.signal)
              .then((track) => {
                if (!isAgentToolRequestActive(id, controller)) return;
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
            RendererWindow.display
              .reactReadyAwait()
              .then(() => {
                if (!isAgentToolRequestActive(id, controller)) return;
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
              })
              .catch((err) => sendErr(id, String(err)));
            break;
          }
          case "agent-tool-search-open":
            RendererWindow.display
              .reactReadyAwait()
              .then(() => {
                if (!isAgentToolRequestActive(id, controller)) return;
                RendererIPCMessageBus.display.deliver({
                  type: "search",
                  keyword: request.input.keyword
                });
                sendOK(id, { ok: true, message: "已打开搜索界面" });
              })
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-comment-open":
            RendererWindow.comment
              .reactReadyAwait()
              .then(() => {
                if (!isAgentToolRequestActive(id, controller)) return;
                RendererIPCMessageBus.comment.deliver({
                  type: request.input.type,
                  id: request.input.id
                });
                sendOK(id, { ok: true, message: "已打开评论界面" });
              })
              .catch((err) => sendErr(id, String(err)));
            break;
          // ---- 播放器信息与控制 ----
          case "agent-tool-player-current": {
            const track = player.current.track;
            sendOK(id, {
              track: track ? RendererTool.track(track.detail, "simple") : null,
              status: player.statusText,
              progress: {
                duration: player.audio.progress.duration,
                currentTime: player.audio.progress.currentTime,
                buffered: player.audio.progress.buffered
              },
              volume: Math.round(player.audio.volume * 100),
              muted: player.audio.audio.muted,
              repeat: player.playlist.repeat,
              shuffle: player.playlist.shuffle
            });
            break;
          }
          case "agent-tool-player-volume": {
            if (request.input.volume !== undefined) {
              player.audio.volume = request.input.volume / 100;
            }
            if (request.input.mute !== undefined) {
              request.input.mute ? player.audio.mute() : player.audio.unmute();
            }
            sendOK(id, {
              volume: Math.round(player.audio.volume * 100),
              muted: player.audio.audio.muted
            });
            break;
          }
          case "agent-tool-player-seek":
            player.audio.currentTime = request.input.position as number | `${number}%`;
            sendOK(id, {
              currentTime: player.audio.currentTime,
              duration: player.audio.progress.duration
            });
            break;
          case "agent-tool-player-queue": {
            const current = player.current.track;
            const queue = player.playlist.list();
            sendOK(
              id,
              RendererTool.list(queue, (record, index) => ({
                index,
                record: RendererTool.record(record),
                isCurrent: record === current
              }))
            );
            break;
          }
          case "agent-tool-player-queue-add": {
            const requestedIDs = [...new Set(request.input.ids)];
            NeteaseServicesTrack.ids(requestedIDs, 100, 5, controller.signal)
              .then((tracks) => {
                if (!isAgentToolRequestActive(id, controller)) return;
                if (tracks.length === 0) {
                  sendErr(id, "未找到可加入播放队列的歌曲");
                  return;
                }

                const records = tracks.map(
                  (detail) =>
                    new NeteaseTrackRecord({
                      detail,
                      sourceName: "other",
                      sourceID: 0
                    })
                );

                if (request.input.position === "next") {
                  // playlist.add(next) 每次都插在当前位置之后，因此需要逆序加入以保持模型给出的顺序。
                  for (let index = records.length - 1; index >= 0; index--) {
                    player.playlist.add(records[index]!, "next");
                  }
                } else {
                  player.playlist.addList(records);
                }

                const acceptedIDs = new Set(tracks.map((track) => track.id));
                sendOK(id, {
                  acceptedCount: records.length,
                  missingIDs: requestedIDs.filter((trackID) => !acceptedIDs.has(trackID)),
                  position: request.input.position,
                  queueLength: player.playlist.list().length,
                  tracks: records.map((record) => RendererTool.record(record))
                });
              })
              .catch((err) => sendErr(id, String(err)));
            break;
          }
          case "agent-tool-player-queue-remove": {
            const queue = player.playlist.list();
            const requestedIDs =
              request.input.scope === "tracks" ? [...new Set(request.input.ids)] : [];
            const requestedIDSet = new Set(requestedIDs);
            const removed =
              request.input.scope === "all"
                ? queue
                : queue.filter((record) => requestedIDSet.has(record.id));

            if (request.input.scope === "all") {
              player.playlist.clear();
            } else {
              for (const record of removed) player.playlist.remove(record);
            }

            const removedIDs = new Set(removed.map((record) => record.id));
            const current = player.playlist.current();
            sendOK(id, {
              current: current ? RendererTool.record(current) : null,
              missingIDs: requestedIDs.filter((trackID) => !removedIDs.has(trackID)),
              queueLength: player.playlist.list().length,
              removed: removed.map((record) => RendererTool.record(record)),
              removedCount: removed.length
            });
            break;
          }
          case "agent-tool-player-mode": {
            const previous = {
              repeat: player.playlist.repeat,
              shuffle: player.playlist.shuffle
            };
            if (request.input.repeat !== undefined) {
              player.playlist.repeat = request.input.repeat;
            }
            if (request.input.shuffle !== undefined) {
              player.playlist.shuffle = request.input.shuffle;
            }
            sendOK(id, {
              previous,
              current: {
                repeat: player.playlist.repeat,
                shuffle: player.playlist.shuffle
              }
            });
            break;
          }
          // ---- 用户 ----
          case "agent-tool-user-info": {
            const user = userStoreSnapshot()._user;
            if (!user || !user.profile) {
              sendErr(id, "用户未登录");
            } else {
              sendOK(id, {
                userId: user.userId,
                nickname: user.profile.nickname,
                avatarUrl: user.profile.avatarUrl,
                signature: user.profile.signature,
                vipType: user.profile.vipType,
                likedTrackCount: Object.keys(user.likedTrackIDs?.ids ?? {}).length,
                playlistCount: (user.userPlaylists?.length ?? 0) + (user.starPlaylists?.length ?? 0)
              });
            }
            break;
          }
          case "agent-tool-user-playlists":
            NeteaseAPIUser.playlist(
              {
                uid: request.input.uid ?? userStoreSnapshot()._user?.userId ?? 0,
                limit: request.input.limit,
                offset: request.input.offset
              },
              controller.signal
            )
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-user-play-history":
            NeteaseAPIUser.playHistory(
              {
                uid: request.input.uid,
                type: request.input.type
              },
              controller.signal
            )
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          // ---- 歌曲操作 ----
          case "agent-tool-track-like":
            NeteaseAPITrack.star(
              {
                id: request.input.id,
                like: request.input.like
              },
              controller.signal
            )
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-track-recommend-daily":
            NeteaseAPITrack.recommendDaily(controller.signal)
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-track-recommend-new":
            NeteaseAPITrack.recommendNew(request.input.type ?? 0, controller.signal)
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-track-fm":
            NeteaseServicesTrack.personalFM(controller.signal)
              .then((records) =>
                sendOK(
                  id,
                  RendererTool.list(records, (record) => RendererTool.record(record))
                )
              )
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-fm-trash":
            NeteaseAPITrack.personalFMTrash(request.input.id, controller.signal)
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          // ---- 艺人 ----
          case "agent-tool-artist-hot-tracks":
            NeteaseAPIArtist.hotTracks(request.input.id, controller.signal)
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-artist-albums":
            NeteaseAPIArtist.albums(
              {
                id: request.input.id,
                pageNo: request.input.page,
                pageSize: request.input.pageSize
              },
              controller.signal
            )
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-artist-similar":
            NeteaseAPIArtist.similar(request.input.id, controller.signal)
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-artist-toplist":
            NeteaseAPIArtist.toplist(request.input.type, controller.signal)
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-artist-desc":
            NeteaseAPIArtist.desc(request.input.id, controller.signal)
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          // ---- 歌单管理 ----
          case "agent-tool-playlist-recommend":
            NeteaseAPIPlaylist.recommend(request.input.limit, controller.signal)
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-playlist-create":
            NeteaseAPIPlaylist.create(
              {
                name: request.input.name,
                privacy: request.input.privacy
              },
              controller.signal
            )
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-playlist-delete":
            NeteaseAPIPlaylist.delete(request.input.id, controller.signal)
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-playlist-modify":
            NeteaseAPIPlaylist.modify(
              {
                op: request.input.op,
                pid: request.input.pid,
                tracks: request.input.trackIds
              },
              controller.signal
            )
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-playlist-star":
            NeteaseAPIPlaylist.star(
              {
                id: request.input.id,
                t: request.input.subscribe ? 1 : 2
              },
              controller.signal
            )
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-playlist-similar":
            NeteaseAPIPlaylist.similar(request.input.id, controller.signal)
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-playlist-top":
            NeteaseAPIPlaylist.recommendTop(
              {
                cat: request.input.cat ?? "全部",
                order: request.input.order ?? "hot",
                limit: request.input.limit,
                offset: request.input.offset
              },
              controller.signal
            )
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          // ---- 专辑 ----
          case "agent-tool-album-new":
            NeteaseAPIAlbum.allNews(
              {
                area: request.input.area,
                limit: request.input.limit,
                offset: request.input.offset
              },
              controller.signal
            )
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-album-star":
            NeteaseAPIAlbum.star(
              {
                id: request.input.id,
                t: request.input.subscribe ? 1 : 0
              },
              controller.signal
            )
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          // ---- 评论互动 ----
          case "agent-tool-comment-send": {
            let commentType;
            switch (request.input.type) {
              case "playlist":
                commentType = CommentType.Playlist;
                break;
              case "album":
                commentType = CommentType.Album;
                break;
              case "track":
                commentType = CommentType.Song;
                break;
            }
            NeteaseAPIComment.send(
              {
                t: request.input.commentId ? 2 : 1,
                type: commentType,
                id: request.input.id,
                content: request.input.content,
                commentId: request.input.commentId
              },
              controller.signal
            )
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          }
          case "agent-tool-comment-like": {
            let commentType;
            switch (request.input.type) {
              case "playlist":
                commentType = CommentType.Playlist;
                break;
              case "album":
                commentType = CommentType.Album;
                break;
              case "track":
                commentType = CommentType.Song;
                break;
            }
            NeteaseAPIComment.like(
              {
                cid: request.input.cid,
                t: request.input.like ? 1 : 0,
                type: commentType,
                id: request.input.id
              },
              controller.signal
            )
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          }
          // ---- 搜索增强 ----
          case "agent-tool-search-hot":
            NeteaseAPISearch.hotListDetail(controller.signal)
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          case "agent-tool-search-suggest":
            NeteaseAPISearch.suggest(request.input.keyword, controller.signal)
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          // ---- 首页与榜单 ----
          case "agent-tool-home-toplists":
            NeteaseAPIHome.toplists(controller.signal)
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          // ---- 设置 ----
          case "agent-tool-change-settings": {
            const result = updateAgentSetting(request.input.key, request.input.value);
            if (result.ok) sendOK(id, result.data);
            else sendErr(id, result.reason);
            break;
          }
          case "agent-tool-settings-get": {
            const settings = settingsStoreSnapshot()._settings;
            sendOK(id, settings as unknown as JsonValue);
            break;
          }
          // ---- 听歌统计 ----
          case "agent-tool-record": {
            let promise;
            switch (request.input.type) {
              case "today":
                promise = NeteaseAPIRecord.today(controller.signal);
                break;
              case "total":
                promise = NeteaseAPIRecord.total(controller.signal);
                break;
              case "week":
                promise = NeteaseAPIRecord.week(controller.signal);
                break;
              case "month":
                promise = NeteaseAPIRecord.month(controller.signal);
                break;
            }
            promise
              .then((res) => sendOK(id, res as unknown as JsonValue))
              .catch((err) => sendErr(id, String(err)));
            break;
          }
          default:
            sendErr(id, "tool not implemented");
        }
      } catch (error) {
        sendErr(id, error instanceof Error ? error.message : String(error));
      }
    },
    [player, userRef]
  );

  useEffect(() => {
    const removeRequestListener = RendererWindow.process.listenMessage(
      "message_dispatch_agent_tool_request",
      handleAgentToolRequest
    );
    const removeCancelListener = RendererWindow.process.listenMessage(
      "message_cancel_agent_tool_request",
      ({ id }) => cancelAgentToolRequest(id)
    );
    return () => {
      removeRequestListener();
      removeCancelListener();
      for (const controller of AgentToolRequestControllers.values()) controller.abort();
      AgentToolRequestControllers.clear();
      AgentToolRequestDetails.clear();
    };
  }, [handleAgentToolRequest]);
}

const WritableBooleanPerformanceSettings = [
  "barSpectrum",
  "homeFluidWithPlaying",
  "playerFluidWithPlaying",
  "playerSpectrum",
  "useHomeFluid",
  "usePlayerFluid"
] as const;

const WritableTrackQualities = [
  TrackQuality.l,
  TrackQuality.m,
  TrackQuality.h,
  TrackQuality.sq,
  TrackQuality.hr
] as const;

type WritableBooleanPerformanceSetting = (typeof WritableBooleanPerformanceSettings)[number];

const updateAgentSetting = (
  key: string,
  value: JsonValue
):
  | { ok: true; data: JsonValue }
  | {
      ok: false;
      reason: string;
    } => {
  const store = settingsStoreSnapshot();
  const settings = store._settings;

  if (key === "trackQuality.quality") {
    if (
      typeof value !== "string" ||
      !WritableTrackQualities.includes(value as (typeof WritableTrackQualities)[number])
    ) {
      return {
        ok: false,
        reason: `设置 ${key} 只接受：${WritableTrackQualities.join("、")}`
      };
    }
    const user = userStoreSnapshot()._user;
    if ((value === TrackQuality.sq || value === TrackQuality.hr) && !NeteaseUser.isVIP(user)) {
      return { ok: false, reason: `设置 ${key} 的值 ${value} 需要会员权限` };
    }
    const previousValue = settings.trackQuality.quality;
    store.updateSettings({
      ...settings,
      trackQuality: {
        ...settings.trackQuality,
        uid: user?.profile.userId ?? settings.trackQuality.uid,
        quality: value as TrackQuality
      }
    });
    return { ok: true, data: { key, previousValue, value } };
  }

  if (key === "preference.defaultUseDisplayWindow") {
    if (typeof value !== "boolean") {
      return { ok: false, reason: `设置 ${key} 只接受 boolean` };
    }
    const previousValue = settings.preference.defaultUseDisplayWindow;
    store.updateSettings({
      ...settings,
      preference: {
        ...settings.preference,
        defaultUseDisplayWindow: value
      }
    });
    return { ok: true, data: { key, previousValue, value } };
  }

  if (key.startsWith("performance.")) {
    const performanceKey = key.slice("performance.".length);
    if (
      WritableBooleanPerformanceSettings.includes(
        performanceKey as WritableBooleanPerformanceSetting
      )
    ) {
      if (typeof value !== "boolean") {
        return { ok: false, reason: `设置 ${key} 只接受 boolean` };
      }
      const typedKey = performanceKey as WritableBooleanPerformanceSetting;
      const previousValue = settings.performance[typedKey];
      store.updateSettings({
        ...settings,
        performance: {
          ...settings.performance,
          [typedKey]: value
        }
      });
      return { ok: true, data: { key, previousValue, value } };
    }

    if (performanceKey === "homeFluidSpeed" || performanceKey === "playerFluidSpeed") {
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) {
        return { ok: false, reason: `设置 ${key} 只接受 1 到 10 的整数` };
      }
      const previousValue = settings.performance[performanceKey];
      store.updateSettings({
        ...settings,
        performance: {
          ...settings.performance,
          [performanceKey]: value
        }
      });
      return { ok: true, data: { key, previousValue, value } };
    }

    if (performanceKey === "spectrumFps") {
      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < 15 ||
        value > 60 ||
        value % 5 !== 0
      ) {
        return { ok: false, reason: `设置 ${key} 只接受 15 到 60、步长为 5 的整数` };
      }
      const previousValue = settings.performance.spectrumFps;
      store.updateSettings({
        ...settings,
        performance: {
          ...settings.performance,
          spectrumFps: value
        }
      });
      return { ok: true, data: { key, previousValue, value } };
    }
  }

  return {
    ok: false,
    reason: `设置键不可由 Agent 修改或不存在：${key}`
  };
};

const sendOK = (callID: string, data: JsonValue) => {
  const detail = AgentToolRequestDetails.get(callID) ?? "standard";
  if (!finishAgentToolRequest(callID)) return;
  AgentToolRequestDetails.delete(callID);
  RendererWindow.process.send("message_deliver_agent_tool_response", {
    id: callID,
    ok: true,
    data: RendererTool.output(data, detail)
  });
};

const sendErr = (callID: string, reason: string) => {
  if (!finishAgentToolRequest(callID)) return;
  AgentToolRequestDetails.delete(callID);
  RendererWindow.process.send("message_deliver_agent_tool_response", {
    id: callID,
    ok: false,
    reason
  });
};
