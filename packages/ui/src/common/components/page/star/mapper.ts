import { RendererFormat } from "@/common/lib/format";
import type { MediaItem } from "@/common/components/layout/media-grid/card";
import type {
  NeteaseStarAlbum,
  NeteaseStarArtist,
  NeteasePlaylistSummary
} from "@/common/netease/models";

/** 收藏歌单 → 网格卡片 */
export function playlistToMediaItem(playlist: NeteasePlaylistSummary): MediaItem {
  return {
    id: playlist.id,
    name: playlist.name,
    playCount: playlist.playCount,
    coverUrl: playlist.coverImgUrl,
    badge: `${playlist.trackCount} 首`,
    meta: playlist.creator?.nickname
  };
}

/** 收藏专辑 → 网格卡片 */
export function albumToMediaItem(album: NeteaseStarAlbum): MediaItem {
  return {
    id: album.id,
    name: album.name,
    coverUrl: album.coverUrl,
    nameClampLine: 1,
    badge: `${album.size} 首`,
    meta: album.artistNames || undefined
  };
}

/** 收藏歌手 → 网格卡片（圆形封面） */
export function artistToMediaItem(artist: NeteaseStarArtist): MediaItem {
  const fans = artist.fansCount ? `${RendererFormat.count(artist.fansCount)} 粉丝` : undefined;

  return {
    id: artist.id,
    name: artist.name,
    coverUrl: artist.coverUrl,
    shape: "circle",
    nameClampLine: 1,
    badge: artist.albumSize ? `专辑 ${artist.albumSize}` : undefined,
    meta: artist.aliasText || fans
  };
}
