import type { MediaItem } from "@/common/components/layout/media-grid/card";

export function createSimilarPlaylistItems(
  response: NeteaseAPI.NeteaseRelatedPlaylistResponse,
  currentID: number
): MediaItem[] {
  const seen = new Set([currentID]);
  const items: MediaItem[] = [];

  for (const { playlist } of response.data?.recPlaylist ?? []) {
    if (seen.has(playlist.id)) continue;
    seen.add(playlist.id);
    items.push({
      id: playlist.id,
      name: playlist.name,
      coverUrl: playlist.coverImgUrl,
      playCount: playlist.playCount
    });
  }

  return items;
}
