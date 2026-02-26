import { API } from "@mahiru/ui/public/api";
import { Log } from "@mahiru/ui/public/utils/dev";
import { LyricParser } from "@mahiru/ui/public/utils/lyric_parser";
import { NeteaseLyric } from "@mahiru/ui/public/entry/lyric";
import { AddCacheStore, WithCacheStore } from "@mahiru/ui/public/store/cache";
import { AddLocalStore, WithLocalStore } from "@mahiru/ui/public/store/local";

@AddLocalStore
@AddCacheStore
class NeteaseSongSource {
  id: number;

  private cacheKey(type: "audio" | "lyric") {
    return `song_${this.localSnapshot.User.UserProfile?.userId}_${this.id}_${type}`;
  }

  constructor(id: number) {
    this.id = id;
  }

  async requestLyric(id: number, preference?: Optional<LyricVersionType>) {
    let lyric: FullVersionLyricLine = { raw: [], rm: [], tl: [], full: [] };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const [ttml, response] = await Promise.allSettled([
      API.Lyric.getTTMLyric(id, controller.signal),
      API.Lyric.getYRCLyric(id)
    ]).finally(() => clearTimeout(timer));

    if (ttml.status === "fulfilled" && ttml.value) {
      Log.debug("use ttml lyric id:" + id);
      lyric = LyricParser.parseTTMLyric(ttml.value).lyric;
    } else if (response.status === "fulfilled") {
      lyric = LyricParser.parseNeteaseLyricResponse(response.value);
    }

    const version = NeteaseLyric.chooseLyricVersionWithPreference(lyric, preference);
    return {
      lyric,
      version,
      response
    };
  }
}

interface NeteaseSongSource extends WithCacheStore, WithLocalStore {}

export class NeteaseSource {
  static song(id: number) {
    return new NeteaseSongSource(id);
  }
}
