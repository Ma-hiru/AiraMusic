import { parseLrc, parseQrc } from "@applemusic-like-lyrics/lyric";
import { Log } from "@/common/lib/log";
import { parseNeteaseLyric } from "@mahiru/wasm";
import { RendererCache } from "@/common/lib/cache";
import { NeteaseAPILyric } from "@/common/netease/api";
import { QQMusicLyric } from "@/common/lib/qq-music-lyric";
import { NeteaseLyric, NeteaseTrack, NeteaseLyricSchema } from "@/common/netease/models";
import type { QQLyricContent } from "@/common/lib/qq-music-lyric/model";

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

  private static async fromQQMusic(
    track: Optional<NeteaseTrack>,
    signal?: AbortSignal
  ): Promise<Nullable<NeteaseLyric>> {
    signal?.throwIfAborted();
    if (!track) return null;
    try {
      const songs = await QQMusicLyric.search(
        `${track.name} ${track.artist.join(",")} ${track.al.name}`
      );
      signal?.throwIfAborted();

      const match = QQMusicLyric.match(track, songs);
      Log.info(
        "qq-music-lyric",
        `search qq music result: ${match?.song.title || "unknown"} (${match?.score ?? 0})`
      );
      if (match) {
        const lyric = await QQMusicLyric.get(match.song);
        signal?.throwIfAborted();
        const parse = (content: Optional<QQLyricContent>) => {
          if (content?.type === "qrc") return parseQrc(content.text);
          if (content?.type === "lrc") return parseLrc(content.text);
          return [];
        };
        const row = parse(lyric.lyric);
        const roman = parse(lyric.roma);
        const trans = parse(lyric.translation);
        if (row.length) {
          return new NeteaseLyric({
            ...NeteaseLyricSchema.parse(parseNeteaseLyric(row, trans, roman)),
            id: track.id,
            tips: "歌词来源：QQ音乐"
          });
        }
      }
    } catch (err) {
      signal?.throwIfAborted();
      Log.warn("qq-music-lyric", err);
    }
    return null;
  }

  static async id(
    id: number,
    abortInput?: AbortInput,
    track?: NeteaseTrack
  ): Promise<NeteaseLyric> {
    const signal = resolveAbortSignal(abortInput);
    signal?.throwIfAborted();
    const cache = await _NeteaseLyricSource.getCache(id);
    signal?.throwIfAborted();
    if (cache && cache.data.length >= 2) return new NeteaseLyric(cache);

    const ttmlController = new AbortController();
    const relayAbort = () => ttmlController.abort(signal?.reason);
    signal?.addEventListener("abort", relayAbort, { once: true });
    const timer = setTimeout(() => ttmlController.abort(), 1500);
    const [ttml, response, qrc] = await Promise.allSettled([
      NeteaseAPILyric.getTTM(id, ttmlController.signal),
      NeteaseAPILyric.getYRC(id, signal),
      this.fromQQMusic(track, signal)
    ]).finally(() => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", relayAbort);
    });
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
      if (QRC && (!YRC || QRC.priority >= YRC.priority)) {
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
