import {
  NeteasePlaylistDetail,
  NeteaseTrack,
  NeteaseTrackDetailResponse,
  TrackId
} from "@mahiru/ui/types/netease-api";
import { isTrackPlayable } from "@mahiru/ui/api/utils/common";
import { usePersistZustandStore, useDynamicZustandStore } from "@mahiru/ui/store";
import { getTrackDetail } from "@mahiru/ui/api/track";
import { Store } from "@mahiru/ui/utils/cache";

const getPersistSnapshot = usePersistZustandStore.getState;

const getDynamicSnapshot = useDynamicZustandStore.getState;

export const enum ImageSize {
  xs,
  sm,
  md,
  lg,
  raw
}

export function NeteaseTrackStatusFilter(trackDetailResponse: NeteaseTrackDetailResponse) {
  if (!trackDetailResponse) return [];
  const { data } = getPersistSnapshot();
  const tracks = trackDetailResponse?.songs ?? [];
  const privileges = trackDetailResponse?.privileges ?? [];
  return tracks.map((track) => {
    // 合并 privilege 信息
    const privilege = privileges.find((item) => item.id === track.id);
    if (privilege) track.privilege = { ...(track.privilege ?? {}), ...privilege };
    // 注入 playable 状态
    const { playable, reason } = isTrackPlayable(track);
    track.isLiked = data.userLikedTracksID.ids.has(track.id);
    track.playable = playable;
    track.reason = reason;
    return track as NeteaseTrack & { playable: boolean; reason: string; isLiked: boolean };
  });
}

export function NeteaseImageSizeFilter(url: Undefinable<string>, size: ImageSize) {
  if (!url || !url.startsWith("http")) return url;
  const u = new URL(url);
  let param;
  switch (size) {
    case ImageSize.xs:
      param = "50y50";
      break;
    case ImageSize.sm:
      param = "100y100";
      break;
    case ImageSize.md:
      param = "250y250";
      break;
    case ImageSize.lg:
      param = "500y500";
      break;
  }
  param && u.searchParams.append("param", param);
  return u.toString();
}

export async function NeteasePlayListToFullTracksFilter(playList: NeteasePlaylistDetail) {
  if (playList.trackCount === playList.tracks.length) {
    return playList.tracks;
  } else {
    return await NeteaseTrackIdsToFullTracksFilter(
      playList.trackIds.slice(playList.tracks.length, playList.trackCount),
      100
    );
  }
}

export async function NeteaseTrackCoverPreCacheFilter(
  tracks: NeteaseTrack[],
  range: [start: number, end: number],
  size: ImageSize = ImageSize.xs
) {
  const [start, end] = range;
  const coverURLs = tracks.slice(start, end).map((track) => ({
    url: NeteaseImageSizeFilter(track.al.picUrl, size)!
  }));

  const cached = await Store.checkOrStoreAsyncMutil(coverURLs, "GET");
  const store = getDynamicSnapshot();
  if (cached.ok) {
    cached.results.forEach((cache, i) => {
      if (cache.ok) {
        const track = tracks[i]!;
        track.al.picUrl = cache.index.file;
        store.setTrackCoverCache(track.id, size, cache.index.file);
      }
    });
  }
  return tracks;
}

export async function NeteaseTrackIdsToFullTracksFilter(ids: TrackId[], maxPerRequest: number = 100) {
  const result: NeteaseTrack[] = [];
  for (let i = 0; i < ids.length; i += maxPerRequest) {
    const chunk = ids.slice(i, i + maxPerRequest).map((t) => t.id);
    const raw = await getTrackDetail(chunk.join(","));
    const mapped = NeteaseTrackStatusFilter(raw);
    result.push(...mapped);
  }
  return result;
}
