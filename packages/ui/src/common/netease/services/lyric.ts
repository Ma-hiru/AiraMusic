import { Log } from "@/common/lib/log";
import { RendererCache } from "@/common/lib/cache";
import { NeteaseAPILyric } from "@/common/netease/api";
import { NeteaseLyric, NeteaseTrack } from "@/common/netease/models";

type AbortInput = AbortSignal | AbortController;

const resolveAbortSignal = (input?: AbortInput) =>
  input && "signal" in input ? input.signal : input;

export default class _NeteaseLyricSource {
  //region cache
  private static readonly cacheKey = "netease_lyric_v20";

  private static storeCache(id: number, lyric: NeteaseLyricModel) {
    return RendererCache.service.object.setOne<NeteaseLyricModel>({
      id: _NeteaseLyricSource.cacheKey + "_" + id,
      data: lyric
    });
  }

  private static getCache(id: number) {
    return RendererCache.service.object.getOne<NeteaseLyricModel>(
      _NeteaseLyricSource.cacheKey + "_" + id
    );
  }
  //endregion

  static async id(id: number, abortInput?: AbortInput) {
    const signal = resolveAbortSignal(abortInput);
    signal?.throwIfAborted();
    const cache = await _NeteaseLyricSource.getCache(id);
    signal?.throwIfAborted();
    if (cache && cache.data.length >= 2) return new NeteaseLyric(cache);

    const ttmlController = new AbortController();
    const relayAbort = () => ttmlController.abort(signal?.reason);
    signal?.addEventListener("abort", relayAbort, { once: true });
    const timer = setTimeout(() => ttmlController.abort(), 1500);
    const [ttml, response] = await Promise.allSettled([
      NeteaseAPILyric.getTTM(id, ttmlController.signal),
      NeteaseAPILyric.getYRC(id, signal)
    ]).finally(() => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", relayAbort);
    });
    signal?.throwIfAborted();

    let lyric = NeteaseLyric.loadErrorLyric;
    if (ttml.status === "fulfilled" && ttml.value) {
      Log.debug("use ttml lyric id:" + id);
      lyric = NeteaseLyric.fromTTMLyric(ttml.value);
      signal?.throwIfAborted();
      lyric.data.length && void _NeteaseLyricSource.storeCache(id, lyric);
    } else if (response.status === "fulfilled") {
      lyric = NeteaseLyric.fromNeteaseAPIResponse(response.value);
      signal?.throwIfAborted();
      lyric.data.length && void _NeteaseLyricSource.storeCache(id, lyric);
    }

    return lyric;
  }

  static track(track: NeteaseTrack, abortInput?: AbortInput) {
    return _NeteaseLyricSource.id(track.id, abortInput);
  }
}
