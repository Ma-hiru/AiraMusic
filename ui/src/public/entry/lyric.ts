import { Log } from "@mahiru/ui/public/utils/dev";
import { API } from "@mahiru/ui/public/api";
import { LyricParser } from "@mahiru/ui/public/utils/lyric_parser";
import {
  loadErrorLyricPreset,
  noLyricPreset,
  pureMusicLyricPreset
} from "@mahiru/ui/public/constants/lyric";

class NeteaseLyricClass {
  /** 歌词版本选择，结合偏好和现有歌词，选出最合适的歌词版本，没有偏好默认显示翻译 */
  chooseLyricVersionWithPreference(
    lyric: FullVersionLyricLine,
    preference: Optional<LyricVersionType>
  ): LyricVersionType {
    const { hasRm, hasTl } = this.getLyricVersionInfo(lyric);
    if (!preference) {
      if (hasTl) {
        return "tl";
      }
      if (hasRm) {
        return "rm";
      }
      return "raw";
    }
    if (preference === "raw" && hasTl) {
      return "tl";
    }
    if (preference === "full") {
      if (!hasRm && !hasTl) {
        return "raw";
      } else if (!hasRm && hasTl) {
        return "tl";
      } else if (hasRm && !hasTl) {
        return "rm";
      }
    } else if (preference === "rm" && !hasRm) {
      if (hasTl) {
        return "tl";
      } else {
        return "raw";
      }
    } else if (preference === "tl" && !hasTl) {
      if (hasRm) {
        return "rm";
      } else {
        return "raw";
      }
    }
    return preference;
  }

  /** 请求和解析歌词 */
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

    const version = this.chooseLyricVersionWithPreference(lyric, preference);
    return {
      lyric,
      version,
      response
    };
  }

  /** 根据歌词数据，将相应版本映射成布尔值 */
  getLyricVersionInfo(
    lyric: Optional<FullVersionLyricLine>,
    currentVersion?: Optional<LyricVersionType>
  ) {
    const result = {
      hasRm: false,
      hasTl: false,
      hasFull: false,
      hasRaw: false,
      rmActive: false,
      tlActive: false
    };

    if (lyric) {
      result.hasRm = lyric.rm.length > 0;
      result.hasTl = lyric.tl.length > 0;
      result.hasFull = lyric.full.length > 0;
      result.hasRaw = lyric.raw.length > 0;
      if (currentVersion) {
        result.rmActive = currentVersion === "rm" || currentVersion === "full";
        result.tlActive = currentVersion === "tl" || currentVersion === "full";
      }
    }
    return result;
  }

  /** 歌词版本切换检查 */
  checkLyricVersion(
    lyric: Optional<FullVersionLyricLine>,
    next: Optional<LyricVersionType>,
    last: Optional<LyricVersionType>
  ): LyricVersionType {
    if (!lyric || !next || next === "raw") return "raw";
    const { hasRm, hasFull, hasTl } = this.getLyricVersionInfo(lyric);
    if ((next === "rm" && hasRm) || (next === "tl" && hasTl) || (next === "full" && hasFull)) {
      return next;
    }
    return last || "raw";
  }

  get blankLyricPreset() {
    return noLyricPreset;
  }

  get pureMusicLyricPreset() {
    return pureMusicLyricPreset;
  }

  get loadErrorLyricPreset() {
    return loadErrorLyricPreset;
  }
}

export const NeteaseLyric = new NeteaseLyricClass();
