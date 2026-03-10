import { Log } from "@mahiru/ui/public/utils/dev";
import NCM_API from "@mahiru/ui/public/api";
import NeteaseLyric from "@mahiru/ui/public/models/netease/NeteaseLyric";

export default class NeteaseLyricSource {
  /** 请求和解析歌词 */
  async detail(id: number, preference?: Optional<LyricVersionType>) {
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
    } else if (response.status === "fulfilled") {
      lyric = NeteaseLyric.fromNeteaseAPIResponse(response.value);
    }
    lyric.versionChangeWithPreference(preference);

    return lyric;
  }
}
