import { Log } from "@/common/lib/log";
import { RendererCache } from "@/common/lib/cache";
import { NeteaseAPILyric } from "@/common/netease/api";
import { QQMusicLyric } from "@/common/lib/qq-music-lyric";
import { settingsStoreSnapshot } from "@/common/store/settings";
import { AppleMusicLyric } from "@/common/lib/apple-music-lyric";
import { NeteaseLyric, NeteaseTrack } from "@/common/netease/models";

type AbortInput = AbortSignal | AbortController;

const resolveAbortSignal = (input?: AbortInput) =>
  input && "signal" in input ? input.signal : input;

export default class _NeteaseLyricSource {
  //region cache
  private static readonly cacheKey = "netease_lyric_v28";

  private static buildCacheKey(id: number, isLocalTTML: boolean) {
    return `${this.cacheKey}_${id}_${isLocalTTML ? 1 : 0}`;
  }

  private static storeCache(id: number, lyric: NeteaseLyricModel, isLocalTTML: boolean) {
    return RendererCache.service.object.setOne<NeteaseLyricModel>({
      id: this.buildCacheKey(id, isLocalTTML),
      data: lyric
    });
  }

  private static async getCache(id: number, useExtra: boolean) {
    const fetchCache = (local = false) =>
      RendererCache.service.object.getOne<NeteaseLyricModel>(this.buildCacheKey(id, local));

    if (useExtra) {
      const localCache = await fetchCache(true);
      if (localCache?.data.length) return localCache;
      if (AppleMusicLyric.hasLocalTTML(id)) return null;
    }

    return fetchCache();
  }
  //endregion

  static async id(
    id: number,
    abortInput?: AbortInput,
    track?: NeteaseTrack
  ): Promise<NeteaseLyric> {
    const signal = resolveAbortSignal(abortInput);
    signal?.throwIfAborted();
    const useExtraTTML = !!settingsStoreSnapshot()?._settings?.preference?.useExtraTTML;
    const cache = await _NeteaseLyricSource.getCache(id, useExtraTTML);
    signal?.throwIfAborted();
    if (cache && cache.data.length >= 1)
      return new NeteaseLyric({ ...cache, id, duration: track?.dt ?? cache.duration });

    let isLocalTTML = false;
    const ttmlPromise = AppleMusicLyric.getTTML(id, signal).then((ttml) => {
      if (ttml || !useExtraTTML) return ttml;
      Log.debug("LyricService", "ttml not in amll-ttml-db, try extra db id:" + id);
      return AppleMusicLyric.getTTMLByLocal(id, signal).then((result) => {
        isLocalTTML = !!result;
        return result;
      });
    });

    const [ttml, response, qrc] = await Promise.allSettled([
      ttmlPromise,
      NeteaseAPILyric.getYRC(id, signal),
      QQMusicLyric.getQRC(track, signal)
    ]);
    signal?.throwIfAborted();

    let lyric: Undefinable<NeteaseLyric>;
    let localTTMLFallback: Undefinable<NeteaseLyric>;
    if (ttml.status === "fulfilled" && ttml.value) {
      try {
        const parsed = NeteaseLyric.fromTTMLyric(ttml.value, isLocalTTML);
        if (parsed.data.length) {
          if (isLocalTTML && !parsed.hasSpecialEffects()) localTTMLFallback = parsed;
          else lyric = parsed;
        }
      } catch (error) {
        Log.warn("LyricService", "parse ttml failed", error);
      }
    }

    if (!lyric) {
      const QRC = qrc.status === "fulfilled" && qrc.value;
      const YRC =
        response.status === "fulfilled" && NeteaseLyric.fromNeteaseAPIResponse(response.value);
      if (localTTMLFallback && !(QRC && QRC.hasWordTiming()) && !(YRC && YRC.hasWordTiming())) {
        lyric = localTTMLFallback;
      } else if (QRC && (!YRC || QRC.priority > YRC.priority)) {
        lyric = QRC;
      } else if (YRC) {
        lyric = YRC;
      }
    }

    signal?.throwIfAborted();
    if (!lyric) return NeteaseLyric.loadErrorLyric;
    lyric = new NeteaseLyric({
      ...lyric,
      id,
      duration: track?.dt ?? lyric.duration
    });
    Log.debug("LyricService", `selected lyric id:${id}, ${lyric.tips}`);
    // _1 保存存在 localTTML 时的选择结果，包括普通 localTTML 让位于 QRC/YRC 的情况。
    if (lyric.data.length) void _NeteaseLyricSource.storeCache(id, lyric, isLocalTTML);
    return lyric;
  }

  static track(track: NeteaseTrack, abortInput?: AbortInput): Promise<NeteaseLyric> {
    return _NeteaseLyricSource.id(track.id, abortInput, track);
  }
}
