import { NeteaseAPILyric } from "@/common/netease/api";
import { Log } from "@/common/lib/log";
import { NeteaseLyric, NeteaseTrack } from "@/common/netease/models";
import { RendererCache } from "@/common/lib/cache";

export default class _NeteaseLyricSource {
  //region cache
  private static readonly cacheKey = "netease_lyric_v12";

  private static storeCache(id: number, lyric: NeteaseLyricModel) {
    return RendererCache.local.object.store<NeteaseLyricModel>(
      _NeteaseLyricSource.cacheKey + "_" + id,
      lyric
    );
  }

  private static getCache(id: number) {
    return RendererCache.local.object.fetch<NeteaseLyricModel>(
      _NeteaseLyricSource.cacheKey + "_" + id
    );
  }
  //endregion

  static async id(id: number, _controller?: AbortController) {
    const cache = await _NeteaseLyricSource.getCache(id);
    if (cache) return new NeteaseLyric(cache);

    const controller = new AbortController();
    _controller?.signal.addEventListener("abort", () => {
      controller.abort();
    });
    const timer = setTimeout(() => controller.abort(), 1500);
    const [ttml, response] = await Promise.allSettled([
      NeteaseAPILyric.getTTM(id, controller.signal),
      NeteaseAPILyric.getYRC(id)
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

  static track(track: NeteaseTrack, controller?: AbortController) {
    return _NeteaseLyricSource.id(track.id, controller);
  }
}
