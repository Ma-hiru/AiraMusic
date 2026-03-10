import pLimit from "p-limit";
import NCM_API from "@mahiru/ui/public/api";
import NeteaseTrack from "@mahiru/ui/public/models/netease/NeteaseTrack";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import NeteasePlaylistSource from "@mahiru/ui/public/entry/source/playlist";

export default class NeteaseTrackSource {
  private static readonly cacheKey = "netease_tracks";

  private static getCache(ids: number[]) {
    return CacheStore.object.fetchMulti<NeteaseAPI.NeteaseTrack>(
      ids.map((id) => NeteaseTrackSource.cacheKey + "_" + id)
    );
  }

  private static storeCache(tracks: NeteaseAPI.NeteaseTrack[]) {
    return CacheStore.object.storeMulti<NeteaseAPI.NeteaseTrack>(
      tracks.map((track) => ({
        id: NeteaseTrackSource.cacheKey + "_" + track.id,
        value: track
      }))
    );
  }

  /** 根据歌曲id获取歌曲详情，会考虑请求次数和URL大小限制 */
  static async fromIDsRaw(
    ids: NeteaseAPI.TrackId[] | number[],
    maxPerRequest: number = 100,
    concurrency: number = 5
  ) {
    const limit = pLimit(concurrency);
    const chunks: number[][] = [];

    if (typeof ids[0] === "object") {
      ids = (ids as NeteaseAPI.TrackId[]).map((track) => track.id);
    }

    for (let i = 0; i < ids.length; i += maxPerRequest) {
      chunks.push((ids as number[]).slice(i, i + maxPerRequest));
    }

    // TODO: get cache

    const results = await Promise.all(
      chunks.map((chunk) => {
        return limit(() => NCM_API.Track.detail(chunk));
      })
    );
    const tracks: NeteaseAPI.NeteaseTrack[] = [];
    const privileges: NeteaseAPI.NeteaseTrackPrivilege[] = [];
    for (const raw of results) {
      tracks.push(...raw.songs);
      privileges.push(...raw.privileges);
    }
    return { tracks, privileges };
  }

  /** 根据歌曲id获取歌曲详情，会考虑请求次数和URL大小限制 */
  static async fromIDs(
    ids: NeteaseAPI.TrackId[] | number[],
    maxPerRequest: number = 100,
    concurrency: number = 5
  ) {
    const { tracks, privileges } = await NeteaseTrackSource.fromIDsRaw(
      ids,
      maxPerRequest,
      concurrency
    );

    const neteaseTracks: NeteaseTrack[] = [];
    for (let i = 0; i < tracks.length; i++) {
      neteaseTracks[i] = NeteaseTrack.fromNeteaseAPI(tracks[i]!, privileges[i]!);
    }

    return neteaseTracks;
  }

  static fromPlaylist(playlist: NeteaseAPI.NeteasePlaylistDetail) {
    return NeteasePlaylistSource.formID(playlist.id).then((p) => p.tracks);
  }
}
