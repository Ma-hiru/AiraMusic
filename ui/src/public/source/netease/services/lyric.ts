import NeteaseAPI from "@mahiru/ui/public/source/netease/api";
import { Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseLyric, NeteaseTrack } from "@mahiru/ui/public/source/netease/models";
import { CacheStore } from "@mahiru/ui/public/store/cache";

export default class _NeteaseLyricSource {
  //region cache
  private static readonly cacheKey = "netease_lyric_v7";

  private static storeCache(id: number, lyric: NeteaseLyricModel) {
    return CacheStore.object.store<NeteaseLyricModel>(
      _NeteaseLyricSource.cacheKey + "_" + id,
      lyric
    );
  }

  private static getCache(id: number) {
    return CacheStore.object.fetch<NeteaseLyricModel>(_NeteaseLyricSource.cacheKey + "_" + id);
  }
  //endregion

  static async fromID(id: number) {
    const cache = await _NeteaseLyricSource.getCache(id);
    if (cache) return new NeteaseLyric(cache);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const [ttml, response] = await Promise.allSettled([
      NeteaseAPI.Lyric.getTTM(id, controller.signal),
      NeteaseAPI.Lyric.getYRC(id)
    ]).finally(() => clearTimeout(timer));

    let lyric = NeteaseLyric.blankLyric;
    if (ttml.status === "fulfilled" && ttml.value) {
      Log.debug("use ttml lyric id:" + id);
      lyric = NeteaseLyric.fromTTMLyric(ttml.value);
      void _NeteaseLyricSource.storeCache(id, lyric);
    } else if (response.status === "fulfilled") {
      lyric = NeteaseLyric.fromNeteaseAPIResponse(response.value);
      void _NeteaseLyricSource.storeCache(id, lyric);
    }

    return lyric;
  }

  static fromTrack(track: NeteaseTrack) {
    return _NeteaseLyricSource.fromID(track.id);
  }
}
