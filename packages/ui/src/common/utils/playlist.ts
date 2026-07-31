import {
  Share2,
  ListMusic,
  UserRound,
  Headphones,
  CalendarDays,
  MessageSquare
} from "lucide-react";
import { RendererFormat } from "@/common/lib/format";
import type { NeteaseUser, NeteaseAlbum, NeteasePlaylist } from "@/common/netease/models";

export function createPlaylistStats(playlist: Optional<NeteasePlaylist>) {
  if (playlist == null) return [];
  return [
    {
      icon: ListMusic,
      label: "歌曲",
      value: `${playlist.trackCount || 0} 首`,
      isTrackCount: true
    },
    {
      icon: Headphones,
      label: "播放",
      value: playlist.playCountFormat(),
      isPlayCount: true
    },
    {
      icon: CalendarDays,
      label: "创建",
      value: RendererFormat.time(playlist.createTime) || "-"
    },
    {
      icon: MessageSquare,
      label: "评论",
      value: RendererFormat.count(playlist.commentCount) || "0",
      isComment: true
    },
    {
      icon: Share2,
      label: "分享",
      value: RendererFormat.count(playlist.shareCount) || "0"
    },
    {
      icon: UserRound,
      label: "收藏",
      value: RendererFormat.count(playlist.subscribedCount) || "0",
      isStar: true
    }
  ];
}

export function createAlbumStats(
  album: Optional<NeteaseAlbum>,
  dynamic: Optional<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>
) {
  if (album == null) return [];
  if (dynamic == null) return [];
  return [
    {
      icon: ListMusic,
      label: "歌曲",
      value: `${album.tracks.length} 首`,
      isTrackCount: true
    },
    {
      icon: CalendarDays,
      label: "发行",
      value: RendererFormat.time(album.content.publishTime) || "-"
    },
    {
      icon: MessageSquare,
      label: "评论",
      value: RendererFormat.count(dynamic.commentCount) || "0",
      isComment: true
    },
    {
      icon: Share2,
      label: "分享",
      value: RendererFormat.count(dynamic.shareCount) || "0"
    },
    {
      icon: UserRound,
      label: "收藏",
      value: RendererFormat.count(dynamic.subCount) || "0",
      isStar: true
    }
  ];
}

export function isUserPlaylist(user: Falsy<NeteaseUser>, id: Falsy<number | string>) {
  if (!user || !id) return false;
  id = Number(id);

  if (id === user.likedPlaylist.id) return true;
  for (const playlist of user.userPlaylists) {
    if (playlist.id === id) return true;
  }

  return false;
}
