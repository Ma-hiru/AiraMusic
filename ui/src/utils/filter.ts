import { EqError, Log } from "@mahiru/ui/utils/dev";
import { getPersistSnapshot } from "@mahiru/ui/store";
import { Auth } from "@mahiru/ui/utils/auth";
import pLimit from "p-limit";
import { CacheStore } from "@mahiru/ui/store/cache";
import { API } from "@mahiru/ui/api";

/** Netease Image Size Enum */
export const enum ImageSize {
  xs,
  sm,
  md,
  lg,
  raw
}

/** 设置图片的size，如果url为假值或者为本地路径，原地返回 */
function NeteaseImageSize(url: Undefinable<string>, size: ImageSize) {
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

/** 判断NeteaseTrack是否可以播放 */
function NeteaseTrackPlayable(track: NeteaseTrack) {
  const result = {
    playable: true,
    reason: ""
  };

  if (
    // 播放权限 > 0
    (typeof track?.privilege?.pl === "number" && track.privilege.pl > 0) ||
    // 云盘歌曲且已登录
    (Auth.isAccountLoggedIn() && track?.privilege?.cs)
  )
    return result;

  const { data } = getPersistSnapshot();
  const vipType = data?.user?.vipType;
  // 0: 免费或无版权 1: VIP 歌曲 4: 购买专辑 8: 非会员可免费播放低音质，会员可播放高音质及下载
  if (track.fee === 1 || track.privilege?.fee === 1) {
    // VIP 歌曲
    if (Auth.isAccountLoggedIn() && vipType === 11) {
      result.playable = true;
    } else {
      result.playable = false;
      result.reason = "VIP专属";
    }
  } else if (track.fee === 4 || track.privilege?.fee === 4) {
    // 付费专辑
    result.playable = false;
    result.reason = "付费专辑";
  } else if (track.noCopyrightRcmd !== null && track.noCopyrightRcmd !== undefined) {
    result.playable = false;
    result.reason = "无版权";
    // st小于0时为灰色歌曲, 使用上传云盘的方法解灰后 st == 0。
  } else if (track.privilege?.st && track.privilege.st < 0 && Auth.isAccountLoggedIn()) {
    result.playable = false;
    result.reason = "已下架";
  }

  return result;
}

/** 拓展track状态，包含版权信息 */
function NeteaseTracksPrivilegeExtends(
  tracks: NeteaseTrack[],
  privileges: NeteaseTrackPrivilege[]
) {
  return tracks.map((track) => {
    // 合并 privilege 信息
    const privilege = privileges.find((item) => item.id === track.id);
    if (privilege) track.privilege = { ...(track.privilege ?? {}), ...privilege };
    // 注入 playable 状态
    const { playable, reason } = NeteaseTrackPlayable(track);
    track.playable = playable;
    track.reason = reason;
    return track as NeteaseTrack & { playable: boolean; reason: string };
  });
}

/** 检查歌单tracks字段是否完整，不完整再额外请求 */
async function NeteasePlaylistToFullTracks(
  response: NeteasePlaylistDetailResponse,
  whenRequestMissedTracks?: NormalFunc<[missTrack: number]>
) {
  const { playlist } = response;
  if (playlist.trackCount === playlist.tracks.length) {
    return response;
  } else {
    whenRequestMissedTracks?.(playlist.trackCount - playlist.tracks.length);
    const { tracks, privilege } = await NeteaseTrackIdsToDetail(
      playlist.trackIds.slice(playlist.tracks.length, playlist.trackCount),
      100
    );
    response.playlist.tracks.push(...tracks);
    response.privileges.push(...privilege);
    return response;
  }
}

/** 根据歌曲id获取歌曲详情，会考虑请求次数和URL大小限制 */
async function NeteaseTrackIdsToDetail(
  ids: TrackId[],
  maxPerRequest: number = 100,
  concurrency: number = 5
) {
  const limit = pLimit(concurrency);
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += maxPerRequest) {
    chunks.push(ids.slice(i, i + maxPerRequest).map((t) => t.id));
  }
  const results = await Promise.all(
    chunks.map((chunk) => limit(() => API.Track.getTrackDetail(chunk.join(","))))
  );
  const tracks: NeteaseTrack[] = [];
  const privilege: NeteaseTrackPrivilege[] = [];
  for (const raw of results) {
    tracks.push(...raw.songs);
    privilege.push(...raw.privileges);
  }
  return { tracks, privilege };
}

/** 歌曲封面缓存，命中则替换成本地路径，没有就预下载 */
async function NeteaseTrackCoverPreCache(
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
    const url = NeteaseImageSize(track.al.picUrl, size)!;
    return {
      id: url,
      url
    };
  });
  // 检查或预缓存
  let cached;
  try {
    if (noStore) cached = await CacheStore.checkMutil(coverURLs);
    else cached = await CacheStore.checkOrStoreAsyncMutil(coverURLs, "GET");
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
        if (oldId) void CacheStore.remove(oldId);
        const newAl = { ...(track.al ?? {}), cachedPicUrl: "", cachedPicUrlID: "" };
        tracks[idx] = { ...track, al: newAl } as NeteaseTrack;
      }
    });
  }

  return tracks;
}

export const Filter = {
  NeteaseImageSize,
  NeteaseTrackPlayable,
  NeteaseTracksPrivilegeExtends,
  NeteasePlaylistToFullTracks,
  NeteaseTrackIdsToDetail,
  NeteaseTrackCoverPreCache
};
