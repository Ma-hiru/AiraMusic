import { isTrackPlayable } from "@mahiru/ui/api/utils/common";
import { useDynamicZustandStore } from "@mahiru/ui/store";
import { getTrackDetail } from "@mahiru/ui/api/track";
import { Store } from "@mahiru/ui/store/cache";
import { EqError, Log } from "@mahiru/ui/utils/dev";

const getDynamicSnapshot = useDynamicZustandStore.getState;

export const enum ImageSize {
  xs,
  sm,
  md,
  lg,
  raw
}

/** 如果url为假值或者为本地路径，原地返回 */
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
  param && u.searchParams.set("param", param);
  return u.toString();
}

/** 拓展track状态，版权信息 */
export function NeteaseTrackPrivilegesStatusFilter(
  tracks: NeteaseTrack[],
  privileges: NeteaseTrackPrivilege[]
) {
  return tracks.map((track) => {
    // 合并 privilege 信息
    const privilege = privileges.find((item) => item.id === track.id);
    if (privilege) track.privilege = { ...(track.privilege ?? {}), ...privilege };
    // 注入 playable 状态
    const { playable, reason } = isTrackPlayable(track);
    track.playable = playable;
    track.reason = reason;
    return track as NeteaseTrack & { playable: boolean; reason: string };
  });
}

/** 拓展track状态，是否like */
export function NeteaseTrackLikedStatusFilter(tracks: NeteaseTrack[]) {
  const { likedTrackIDs } = getDynamicSnapshot();
  return tracks.map((track) => {
    track.isLiked = likedTrackIDs.ids.has(track.id);
    return track;
  });
}

/** 检查歌单tracks是否完整，不完整再额外请求 */
export async function NeteasePlayListToFullTracksFilter(response: NeteasePlaylistDetailResponse) {
  const { playlist } = response;
  if (playlist.trackCount === playlist.tracks.length) {
    return response;
  } else {
    const { tracks, privilege } = await NeteaseTrackIdsToFullTracksFilter(
      playlist.trackIds.slice(playlist.tracks.length, playlist.trackCount),
      100
    );
    response.playlist.tracks.push(...tracks);
    response.privileges.push(...privilege);
    return response;
  }
}

/** 根据id获取歌曲详情 */
export async function NeteaseTrackIdsToFullTracksFilter(
  ids: TrackId[],
  maxPerRequest: number = 100
) {
  const tracks: NeteaseTrack[] = [];
  const privilege: NeteaseTrackPrivilege[] = [];
  for (let i = 0; i < ids.length; i += maxPerRequest) {
    const chunk = ids.slice(i, i + maxPerRequest).map((t) => t.id);
    const raw = await getTrackDetail(chunk.join(","));
    tracks.push(...raw.songs);
    privilege.push(...raw.privileges);
  }
  return { tracks, privilege };
}

/** 检查缓存，命中则替换成本地路径，没有就预下载 */
export async function NeteaseTrackCoverPreCacheFilter(
  tracks: NeteaseTrack[],
  range: [start: number, end: number],
  size: ImageSize = ImageSize.xs,
  noStore = false
) {
  // range => [start, end)
  let [start, end] = range;
  // 边界检查
  if (start >= end || start >= tracks.length || end <= 0) return tracks;
  if (end > tracks.length) end = tracks.length;
  if (start < 0) start = 0;
  // 构建检查列表
  const coverURLs = tracks.slice(start, end).map((track) => {
    const url = NeteaseImageSizeFilter(track.al.picUrl, size)!;
    return {
      id: url,
      url
    };
  });
  // 检查或预缓存
  let cached;
  try {
    if (noStore) cached = await Store.checkMutil(coverURLs);
    else cached = await Store.checkOrStoreAsyncMutil(coverURLs, "GET");
  } catch (err) {
    Log.error(
      new EqError({
        raw: err,
        message: "预缓存封面失败",
        label: "ui/utils/filter.ts:NeteaseTrackCoverPreCacheFilter"
      })
    );
    cached = { ok: false, results: [] };
  }
  // 写入结果
  if (cached.ok) {
    cached.results.forEach((cache, i) => {
      const idx = start + i;
      const track = tracks[idx];
      if (!track) return;
      if (cache.ok) {
        const newAl = {
          ...(track.al ?? {}),
          cachedPicUrl: cache.index.file,
          cachedPicUrlID: cache.index.id
        };
        tracks[idx] = { ...track, al: newAl } as NeteaseTrack;
      } else {
        const oldId = track.al?.cachedPicUrlID;
        if (oldId) void Store.remove(oldId);
        const newAl = { ...(track.al ?? {}), cachedPicUrl: "", cachedPicUrlID: "" };
        tracks[idx] = { ...track, al: newAl } as NeteaseTrack;
      }
    });
  }

  return tracks;
}
