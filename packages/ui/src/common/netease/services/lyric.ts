import { Log } from "@/common/lib/log";
import { RendererCache } from "@/common/lib/cache";
import { NeteaseAPILyric } from "@/common/netease/api";
import { QQMusicLyric } from "@/common/lib/qq-music-lyric";
import { AppleMusicLyric } from "@/common/lib/apple-music-lyric";
import { NeteaseLyric, NeteaseTrack } from "@/common/netease/models";

type AbortInput = AbortSignal | AbortController;

const resolveAbortSignal = (input?: AbortInput) =>
  input && "signal" in input ? input.signal : input;

export default class _NeteaseLyricSource {
  //region cache
  private static readonly cacheKey = "netease_lyric_v23";

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

  static async id(
    id: number,
    abortInput?: AbortInput,
    track?: NeteaseTrack
  ): Promise<NeteaseLyric> {
    const signal = resolveAbortSignal(abortInput);
    signal?.throwIfAborted();
    const cache = await _NeteaseLyricSource.getCache(id);
    signal?.throwIfAborted();
    if (cache && cache.data.length >= 1) return new NeteaseLyric(cache);

    const [ttml, response, qrc] = await Promise.allSettled([
      AppleMusicLyric.getTTM(id, signal),
      NeteaseAPILyric.getYRC(id, signal),
      QQMusicLyric.getQRC(track, signal)
    ]);
    signal?.throwIfAborted();

    let lyric = NeteaseLyric.loadErrorLyric;
    // 优先TTML，其次QRC
    if (ttml.status === "fulfilled" && ttml.value) {
      Log.debug("LyricService", "use ttml lyric id:" + id);
      lyric = NeteaseLyric.fromTTMLyric(ttml.value);
      signal?.throwIfAborted();
      lyric.data.length && void _NeteaseLyricSource.storeCache(id, lyric);
    } else {
      const QRC = qrc.status === "fulfilled" && qrc.value;
      const YRC =
        response.status === "fulfilled" && NeteaseLyric.fromNeteaseAPIResponse(response.value);
      if (QRC && (!YRC || QRC.priority > YRC.priority)) {
        Log.debug("LyricService", "use qrc lyric id:" + id);
        lyric = QRC;
        signal?.throwIfAborted();
        lyric.data.length && void _NeteaseLyricSource.storeCache(id, lyric);
      } else if (YRC) {
        Log.debug("LyricService", "use yrc lyric id:" + id);
        lyric = YRC;
        signal?.throwIfAborted();
        lyric.data.length && void _NeteaseLyricSource.storeCache(id, lyric);
      }
    }

    return lyric;
  }

  static track(track: NeteaseTrack, abortInput?: AbortInput): Promise<NeteaseLyric> {
    return _NeteaseLyricSource.id(track.id, abortInput, track);
  }
}
