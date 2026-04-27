import pLimit from "p-limit";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import { NeteaseTrack } from "@mahiru/ui/public/source/netease/models";
import { Log } from "@mahiru/ui/public/utils/dev";
import _NeteasePlaylistSource from "./playlist";

type CacheEntry = {
  track: NeteaseAPI.NeteaseTrack;
  privilege: NeteaseAPI.NeteaseTrackPrivilege;
};

export default class _NeteaseTrackSource {
  private static readonly cacheKey = "netease_tracks_v1";
  private static readonly notFoundKey = "netease_track_not_found";

  private static getNotFoundIds() {
    return CacheStore.browser.getOne<number[]>(this.notFoundKey) ?? [];
  }

  private static setNotFound(id: number) {
    return CacheStore.browser.setOne(
      this.notFoundKey,
      (_NeteaseTrackSource.getNotFoundIds() ?? []).concat(id)
    );
  }

  private static getCacheKey(id: number) {
    return _NeteaseTrackSource.cacheKey + "_" + id;
  }

  private static getCache(ids: number[]) {
    return CacheStore.local.object.fetchMulti<CacheEntry>(
      ids.map((id) => _NeteaseTrackSource.getCacheKey(id))
    );
  }

  private static storeCache(
    tracks: NeteaseAPI.NeteaseTrack[],
    privileges: NeteaseAPI.NeteaseTrackPrivilege[]
  ) {
    return CacheStore.local.object.storeMulti<CacheEntry>(
      tracks.map((track, index) => {
        return {
          id: _NeteaseTrackSource.getCacheKey(track.id),
          data: {
            track,
            privilege: privileges[index]!
          }
        };
      })
    );
  }

  /**
   *  根据歌曲id获取歌曲详情，会考虑请求次数和URL大小限制
   *  返回原始json解析对象
   *  */
  static async _raw(
    ids: NeteaseAPI.TrackId[] | number[],
    maxPerRequest: number = 100,
    concurrency: number = 5
  ) {
    // 如果传入的是TrackId对象数组，先提取出id
    if (ids.length === 0) return [];
    const rawIDs =
      typeof ids[0] === "object"
        ? (ids as NeteaseAPI.TrackId[]).map((track) => track.id)
        : (ids as number[]);
    const notFoundIds = _NeteaseTrackSource.getNotFoundIds();

    // 从缓存中获取数据，找出需要请求的id
    const cache = await _NeteaseTrackSource.getCache(rawIDs);
    const requestIDs: number[] = [];
    const requestIdx: number[] = [];
    for (let i = 0; i < rawIDs.length; i++) {
      if (!cache[i] && !notFoundIds.includes(rawIDs[i]!)) {
        requestIDs.push(rawIDs[i]!);
        requestIdx.push(i);
      }
    }
    // 如果没有需要请求的id，直接返回缓存结果
    if (requestIDs.length === 0) return cache as Nullable<CacheEntry>[];
    // 将需要请求的id分成若干批，每批不超过maxPerRequest个
    const limit = pLimit(concurrency);
    const chunks: number[][] = [];
    for (let i = 0; i < requestIDs.length; i += maxPerRequest) {
      chunks.push(requestIDs.slice(i, i + maxPerRequest));
    }
    const requestResults = await Promise.all(
      chunks.map((chunk) => {
        return limit(() => NeteaseAPI.Track.detail(chunk));
      })
    );
    // 将请求结果扁平化
    const trackMap = new Map<number, NeteaseAPI.NeteaseTrack>();
    const privilegeMap = new Map<number, NeteaseAPI.NeteaseTrackPrivilege>();
    const requestTracks: NeteaseAPI.NeteaseTrack[] = [];
    const requestPrivileges: NeteaseAPI.NeteaseTrackPrivilege[] = [];
    for (const { songs, privileges } of requestResults) {
      for (const song of songs) trackMap.set(song.id, song);
      for (const privilege of privileges) privilegeMap.set(privilege.id, privilege);
    }
    for (const id of requestIDs) {
      const track = trackMap.get(id);
      const privilege = privilegeMap.get(id);

      if (track && privilege) {
        requestTracks.push(track);
        requestPrivileges.push(privilege);
      }
    }
    // 将请求结果存入缓存
    await _NeteaseTrackSource.storeCache(requestTracks, requestPrivileges);
    // 将请求结果合并到结果中
    for (const idx of requestIdx) {
      const id = rawIDs[idx]!;
      const track = trackMap.get(id);
      const privilege = privilegeMap.get(id);
      if (!track || !privilege) {
        // 存在云端不存在的歌曲
        Log.error(`track ${id} not found`);
        _NeteaseTrackSource.setNotFound(id);
        cache[idx] = null;
        continue;
      }
      cache[idx] = {
        track,
        privilege
      };
    }
    return cache as Nullable<CacheEntry>[];
  }

  /**
   * 根据歌曲id获取歌曲详情，会考虑请求次数和URL大小限制 \
   * 返回模型对象
   * */
  static async ids(
    ids: NeteaseAPI.TrackId[] | number[],
    maxPerRequest: number = 100,
    concurrency: number = 5
  ) {
    const entries = await _NeteaseTrackSource._raw(ids, maxPerRequest, concurrency);

    const results: NeteaseTrack[] = [];
    for (const entry of entries) {
      if (!entry) continue;
      const { track, privilege } = entry;
      results.push(NeteaseTrack.fromNeteaseAPI(track, privilege));
    }

    return results;
  }

  static id(id: number) {
    return _NeteaseTrackSource.ids([id]).then((response) => response[0]);
  }

  static idEnsure(id: number) {
    return _NeteaseTrackSource.ids([id]).then((response) => response[0]!);
  }

  static playlist(playlist: NeteaseAPI.NeteasePlaylistDetail) {
    return _NeteasePlaylistSource.id(playlist.id).then((p) => p.tracks);
  }
}
