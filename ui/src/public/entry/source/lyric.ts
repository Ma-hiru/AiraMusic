import { Log } from "@mahiru/ui/public/utils/dev";
import NCM_API from "@mahiru/ui/public/api";
import NeteaseLyric from "@mahiru/ui/public/models/netease/NeteaseLyric";
import NeteaseTrack from "@mahiru/ui/public/models/netease/NeteaseTrack";
import { CacheStore } from "@mahiru/ui/public/store/cache";

export default class NeteaseLyricSource {
  //region cache
  private static readonly cacheKey = "netease_lyric";

  private static storeCache(id: number, lyric: FullVersionLyricLine) {
    return CacheStore.object.store<FullVersionLyricLine>(
      NeteaseLyricSource.cacheKey + "_" + id,
      lyric
    );
  }

  private static getCache(id: number) {
    return CacheStore.object.fetch<FullVersionLyricLine>(NeteaseLyricSource.cacheKey + "_" + id);
  }
  //endregion

  static async fromID(id: number) {
    const cache = await NeteaseLyricSource.getCache(id);
    if (cache) return new NeteaseLyric(cache);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const [ttml, response] = await Promise.allSettled([
      NCM_API.Lyric.getTTM(id, controller.signal),
      NCM_API.Lyric.getYRC(id)
    ]).finally(() => clearTimeout(timer));

    let lyric = NeteaseLyric.blankLyric;
    if (ttml.status === "fulfilled" && ttml.value) {
      Log.debug("use ttml lyric id:" + id);
      lyric = NeteaseLyric.fromTTMLyric(ttml.value);
      void NeteaseLyricSource.storeCache(id, lyric);
    } else if (response.status === "fulfilled") {
      lyric = NeteaseLyric.fromNeteaseAPIResponse(response.value);
      void NeteaseLyricSource.storeCache(id, lyric);
    }

    return lyric;
  }

  static fromTrack(track: NeteaseTrack) {
    return NeteaseLyricSource.fromID(track.id);
  }
}
