import { z } from "zod";
import { useEffect, useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { settingsStoreSnapshot } from "@/common/store/settings";
import { useUser, userStoreSnapshot } from "@/common/store/user";
import { SearchType, CommentSort, CommentType } from "@/common/enum";
import { NeteaseLyricSchema, NeteaseTrackRecord } from "@/common/netease/models";
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

export function useAgentToolHandle() {
  const player = RendererPlayerHandle.player;
  const userRef = useLatestRef(useUser());

  const handleAgentToolRequest = useCallback(
    (request: AgentToolRequest) => {
      const id = request.id;
      switch (request.tool) {
        case "agent-tool-player-action":
          RendererIPCMessageBus.playerAction.dispatch(request.input.action);
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
        // ---- 播放器信息与控制 ----
        case "agent-tool-player-current": {
          const track = player.current.track;
          sendOK(id, {
            track: track ? track.detail.toToolJSONValue("simple") : null,
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
            queue.map((r, i) => ({
              index: i,
              ...(NeteaseTrackRecord.toToolJSONValue(r) as Record<string, unknown>),
              isCurrent: r === current
            }))
          );
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
          NeteaseAPIUser.playlist({
            uid: request.input.uid ?? userStoreSnapshot()._user?.userId ?? 0,
            limit: request.input.limit,
            offset: request.input.offset
          })
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-user-play-history":
          NeteaseAPIUser.playHistory({
            uid: request.input.uid,
            type: request.input.type
          })
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        // ---- 歌曲操作 ----
        case "agent-tool-track-like":
          NeteaseAPITrack.star({
            id: request.input.id,
            like: request.input.like
          })
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-track-recommend-daily":
          NeteaseAPITrack.recommendDaily()
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-track-recommend-new":
          NeteaseAPITrack.recommendNew(request.input.type ?? 0)
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-track-fm":
          NeteaseServicesTrack.personalFM()
            .then((records) =>
              sendOK(
                id,
                records.map((r) => NeteaseTrackRecord.toToolJSONValue(r))
              )
            )
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-fm-trash":
          NeteaseAPITrack.personalFMTrash(request.input.id)
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        // ---- 艺人 ----
        case "agent-tool-artist-hot-tracks":
          NeteaseAPIArtist.hotTracks(request.input.id)
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-artist-albums":
          NeteaseAPIArtist.albums({
            id: request.input.id,
            pageNo: request.input.page,
            pageSize: request.input.pageSize
          })
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-artist-similar":
          NeteaseAPIArtist.similar(request.input.id)
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-artist-toplist":
          NeteaseAPIArtist.toplist(request.input.type)
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-artist-desc":
          NeteaseAPIArtist.desc(request.input.id)
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        // ---- 歌单管理 ----
        case "agent-tool-playlist-recommend":
          NeteaseAPIPlaylist.recommend(request.input.limit)
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-playlist-create":
          NeteaseAPIPlaylist.create({
            name: request.input.name,
            privacy: request.input.privacy
          })
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-playlist-delete":
          NeteaseAPIPlaylist.delete(request.input.id)
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-playlist-modify":
          NeteaseAPIPlaylist.modify({
            op: request.input.op,
            pid: request.input.pid,
            tracks: request.input.trackIds
          })
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-playlist-star":
          NeteaseAPIPlaylist.star({
            id: request.input.id,
            t: request.input.subscribe ? 1 : 2
          })
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-playlist-similar":
          NeteaseAPIPlaylist.similar(request.input.id)
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-playlist-top":
          NeteaseAPIPlaylist.recommendTop({
            cat: request.input.cat ?? "全部",
            order: request.input.order ?? "hot",
            limit: request.input.limit,
            offset: request.input.offset
          })
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        // ---- 专辑 ----
        case "agent-tool-album-new":
          NeteaseAPIAlbum.allNews({
            area: request.input.area,
            limit: request.input.limit,
            offset: request.input.offset
          })
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-album-star":
          NeteaseAPIAlbum.star({
            id: request.input.id,
            t: request.input.subscribe ? 1 : 0
          })
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
          NeteaseAPIComment.send({
            t: request.input.commentId ? 2 : 1,
            type: commentType,
            id: request.input.id,
            content: request.input.content,
            commentId: request.input.commentId
          })
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
          NeteaseAPIComment.like({
            cid: request.input.cid,
            t: request.input.like ? 1 : 0,
            type: commentType,
            id: request.input.id
          })
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        }
        // ---- 搜索增强 ----
        case "agent-tool-search-hot":
          NeteaseAPISearch.hotListDetail()
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        case "agent-tool-search-suggest":
          NeteaseAPISearch.suggest(request.input.keyword)
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        // ---- 首页与榜单 ----
        case "agent-tool-home-toplists":
          NeteaseAPIHome.toplists()
            .then((res) => sendOK(id, res as unknown as JsonValue))
            .catch((err) => sendErr(id, String(err)));
          break;
        // ---- 设置 ----
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
              promise = NeteaseAPIRecord.today();
              break;
            case "total":
              promise = NeteaseAPIRecord.total();
              break;
            case "week":
              promise = NeteaseAPIRecord.week();
              break;
            case "month":
              promise = NeteaseAPIRecord.month();
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
    },
    [player, userRef]
  );

  useEffect(() => {
    return RendererWindow.process.listenMessage(
      "message_dispatch_agent_tool_request",
      handleAgentToolRequest
    );
  }, [handleAgentToolRequest]);
}

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
