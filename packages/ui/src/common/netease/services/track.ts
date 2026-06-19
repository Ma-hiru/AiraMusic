import pLimit from "p-limit";
import { NeteaseAPITrack } from "@/common/netease/api";
import { RendererCache } from "@/common/lib/cache";
import { NeteaseTrack, NeteaseTrackRecord } from "@/common/netease/models";
import { Log } from "@/common/lib/log";
import _NeteasePlaylistSource from "./playlist";

type CacheEntry = {
  track: NeteaseAPI.NeteaseTrack;
  privilege: Nullable<NeteaseAPI.NeteaseTrackPrivilege>;
};

export default class _NeteaseTrackSource {
  private static readonly cacheKey = "netease_tracks_v2";

  private static getCacheKey(id: number) {
    return _NeteaseTrackSource.cacheKey + "_" + id;
  }

  private static getCache(ids: number[]) {
    return RendererCache.local.object.fetchMulti<CacheEntry>(
      ids.map((id) => _NeteaseTrackSource.getCacheKey(id))
    );
  }

  private static storeCache(
    tracks: NeteaseAPI.NeteaseTrack[],
    privileges: (NeteaseAPI.NeteaseTrackPrivilege | null)[]
  ) {
    return RendererCache.local.object.storeMulti<CacheEntry>(
      tracks.map((track, index) => {
        return {
          id: _NeteaseTrackSource.getCacheKey(track.id),
          data: {
            track,
            privilege: privileges[index] ?? null
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
    maxPerRequest: number = 500,
    concurrency: number = 3
  ) {
    // 如果传入的是TrackId对象数组，先提取出id
    if (ids.length === 0) return [];
    const rawIDs =
      typeof ids[0] === "object"
        ? (ids as NeteaseAPI.TrackId[]).map((track) => track.id)
        : (ids as number[]);

    // 从缓存中获取数据，找出需要请求的id
    const cache = await _NeteaseTrackSource.getCache(rawIDs);
    const requestIDs: number[] = [];
    const requestIdx: number[] = [];
    for (let i = 0; i < rawIDs.length; i++) {
      if (!cache[i]) {
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
        return limit(() => NeteaseAPITrack.detail(chunk));
      })
    );
    // 将请求结果扁平化
    const trackMap = new Map<number, NeteaseAPI.NeteaseTrack>();
    const privilegeMap = new Map<number, NeteaseAPI.NeteaseTrackPrivilege>();
    const requestTracks: NeteaseAPI.NeteaseTrack[] = [];
    const requestPrivileges: (NeteaseAPI.NeteaseTrackPrivilege | null)[] = [];
    for (const { songs, privileges } of requestResults) {
      for (const song of songs) trackMap.set(song.id, song);
      for (const privilege of privileges) privilegeMap.set(privilege.id, privilege);
    }
    for (const id of requestIDs) {
      const track = trackMap.get(id);
      const privilege = privilegeMap.get(id);

      if (track) {
        requestTracks.push(track);
        requestPrivileges.push(privilege ?? null);
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
        // 存在云端不存在的歌曲或者请求错误
        Log.error(`get track ${id} empty, not found or request error`);
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
   * 返回模型对象 \
   * 只会返回找到的歌曲，所以 ids.length !== tracks.length
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

  static async personalFM(): Promise<NeteaseTrackRecord[]> {
    const res = await NeteaseAPITrack.personalFM();
    const ids = (res.data ?? []).map((track) => track.id).filter(Boolean);
    if (ids.length === 0) return [];
    const tracks = await _NeteaseTrackSource.ids(ids);
    return tracks.map(
      (detail) => new NeteaseTrackRecord({ detail, sourceID: 0, sourceName: "fm" })
    );
  }
}
