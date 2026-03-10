import pLimit from "p-limit";
import NCM_API from "@mahiru/ui/public/api";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import NeteasePlaylistSource from "@mahiru/ui/public/entry/source/playlist";
import NeteaseTrack from "@mahiru/ui/public/models/netease/NeteaseTrack";

type CacheEntry = {
  track: NeteaseAPI.NeteaseTrack;
  privilege: NeteaseAPI.NeteaseTrackPrivilege;
};

export default class NeteaseTrackSource {
  private static readonly cacheKey = "netease_tracks";

  private static getCache(ids: number[]) {
    return CacheStore.object.fetchMulti<CacheEntry>(
      ids.map((id) => NeteaseTrackSource.cacheKey + "_" + id)
    );
  }

  private static storeCache(
    tracks: NeteaseAPI.NeteaseTrack[],
    privileges: NeteaseAPI.NeteaseTrackPrivilege[]
  ) {
    return CacheStore.object.storeMulti<CacheEntry>(
      tracks.map((track, index) => {
        return {
          id: String(track.id),
          value: {
            track,
            privilege: privileges[index]!
          }
        };
      })
    );
  }

  /** 根据歌曲id获取歌曲详情，会考虑请求次数和URL大小限制 */
  static async fromIDsRaw(
    ids: NeteaseAPI.TrackId[] | number[],
    maxPerRequest: number = 100,
    concurrency: number = 5
  ) {
    // 如果传入的是TrackId对象数组，先提取出id
    if (typeof ids[0] === "object") {
      ids = (ids as NeteaseAPI.TrackId[]).map((track) => track.id);
    }
    // 从缓存中获取数据，找出需要请求的id
    const cache = await NeteaseTrackSource.getCache(ids as number[]);
    const requestIDs: number[] = [];
    const requestIdx: number[] = [];
    for (let i = 0; i < cache.length; i++) {
      if (!cache[i]) {
        requestIdx.push(i);
        requestIDs.push(ids[i] as number);
      }
    }
    // 如果没有需要请求的id，直接返回缓存结果
    if (requestIDs.length === 0) {
      return cache as CacheEntry[];
    }
    // 分批请求数据
    const limit = pLimit(concurrency);
    const chunks: number[][] = [];
    // 将需要请求的id分成若干批，每批不超过maxPerRequest个
    for (let i = 0; i < ids.length; i += maxPerRequest) {
      chunks.push(requestIDs.slice(i, i + maxPerRequest));
    }
    const requestResults = await Promise.all(
      chunks.map((chunk) => {
        return limit(() => NCM_API.Track.detail(chunk));
      })
    );
    // 将请求结果扁平化
    const requestTracks: NeteaseAPI.NeteaseTrack[] = [];
    const requestPrivileges: NeteaseAPI.NeteaseTrackPrivilege[] = [];
    for (const { songs, privileges } of requestResults) {
      requestTracks.push(...songs);
      requestPrivileges.push(...privileges);
    }
    // 将请求结果存入缓存
    NeteaseTrackSource.storeCache(requestTracks, requestPrivileges);
    // 将请求结果合并到结果中
    requestIdx.forEach((idx, index) => {
      cache[idx] = {
        track: requestTracks[index]!,
        privilege: requestPrivileges[index]!
      };
    });
    return cache as CacheEntry[];
  }

  /** 根据歌曲id获取歌曲详情，会考虑请求次数和URL大小限制 */
  static async fromIDs(
    ids: NeteaseAPI.TrackId[] | number[],
    maxPerRequest: number = 100,
    concurrency: number = 5
  ) {
    const entries = await NeteaseTrackSource.fromIDsRaw(ids, maxPerRequest, concurrency);

    const results: NeteaseTrack[] = [];
    for (const { track, privilege } of entries) {
      results.push(NeteaseTrack.fromNeteaseAPI(track, privilege));
    }

    return results;
  }

  static fromPlaylist(playlist: NeteaseAPI.NeteasePlaylistDetail) {
    return NeteasePlaylistSource.formID(playlist.id).then((p) => p.tracks);
  }
}
