import {
  LyricLine as RawLyricLine,
  LyricWord as RawLyricWord,
  parseLrc,
  parseQrc,
  parseTTML,
  parseYrc
} from "@applemusic-like-lyrics/lyric";
import { LyricLine, LyricWord } from "@applemusic-like-lyrics/core";
import { parseExternalLrc, parseNeteaseLyric, parseTranslatedLRC } from "@mahiru/wasm";
import { Errs } from "@mahiru/ui/public/entry/errs";
import { Log } from "@mahiru/ui/public/utils/dev";
import { API } from "@mahiru/ui/public/api";

class LyricParser {
  mapRawLyricLine(line: RawLyricLine): LyricLine {
    return {
      ...line,
      words: line.words.map((word) => ({ obscene: false, ...word }))
    };
  }

  mapRawLyricWord(words: RawLyricWord[]): LyricWord[] {
    return words.map((word) => ({ obscene: false, ...word }));
  }

  parseTranslatedLRC(content: string): LyricLine[] {
    const raw = parseLrc(content);
    return parseTranslatedLRC(raw, false) as LyricLine[];
  }

  parseExternalLrc(lyric: string) {
    // eg: [00:00.00-1] 作曲 : solfa \n
    lyric = parseExternalLrc(lyric);
    return parseLrc(lyric);
  }

  parseNeteaseLyric(
    raw: NeteaseLrc | NeteaseKlyric | NeteaseYRC,
    ts: NeteaseTlyric | undefined,
    rm: NeteaseRomalrc | undefined,
    type: "LRC" | "QRC" | "YRC",
    mt?: NeteaseTransUser
  ) {
    try {
      let mainLyric;
      switch (type) {
        case "YRC":
          mainLyric = parseYrc(raw.lyric);
          break;
        case "QRC":
          mainLyric = parseQrc(raw.lyric);
          break;
        case "LRC":
          mainLyric = this.parseExternalLrc(raw.lyric);
      }
      const translatedLyric = this.parseExternalLrc(ts?.lyric || "");
      const romanLyric = this.parseExternalLrc(rm?.lyric || "");
      const meta = <NeteaseTransUser>{
        nickname: mt?.nickname || ""
      };

      return parseNeteaseLyric(
        mainLyric || [],
        translatedLyric || [],
        romanLyric || [],
        meta
      ) as FullVersionLyricLine;
    } catch (err) {
      Log.error(Errs.LyricParseErr.create("ui/utils/lyric.ts:parseNeteaseLyricWasm", err));
      return {
        full: [],
        raw: [],
        tl: [],
        rm: []
      } as FullVersionLyricLine;
    }
  }

  /** 处理和解析歌词响应 */
  parseNeteaseLyricResponse(response: NeteaseLyricResponseNew): FullVersionLyricLine {
    if (!response?.lrc?.lyric && !response?.yrc)
      // 没有任何歌词
      return noLyricPreset;

    let parsedLyric;
    const LRC = response.lrc;
    const LRCTranslated = response.tlyric;
    const LRCRoman = response.romalrc;

    const YRC = response.yrc;
    const YRCTranslated = response.ytlrc;
    const YRCRoman = response.yromalrc;

    const meta = response.transUser;
    if (YRC && YRC.lyric) {
      parsedLyric = this.parseNeteaseLyric(YRC, YRCTranslated, YRCRoman, "YRC", meta);
    } else if (LRC && LRC.lyric) {
      parsedLyric = this.parseNeteaseLyric(LRC, LRCTranslated, LRCRoman, "LRC", meta);
    }

    if (!parsedLyric) {
      return noLyricPreset;
    } else if (parsedLyric.raw.length === 0) {
      return pureMusicLyricPreset;
    } else {
      return parsedLyric;
    }
  }

  parseTTMLyric(context: string) {
    const ttml = parseTTML(context);
    return {
      lyric: {
        raw: ttml.lines.map(this.mapRawLyricLine.bind(this)),
        tl: [],
        rm: [],
        full: []
      } satisfies FullVersionLyricLine,
      metadata: ttml.metadata
    };
  }
}

class NeteaseLyricClass {
  Parser = new LyricParser();

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
      console.log(ttml.value);
      Log.trace("use ttml lyric id:" + id);
      lyric = this.Parser.parseTTMLyric(ttml.value).lyric;
    } else if (response.status === "fulfilled") {
      lyric = this.Parser.parseNeteaseLyricResponse(response.value);
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

  /** 歌词显示版本选择，可用于歌词组件，含容错处理 */
  chooseLyric(
    lyric: Optional<FullVersionLyricLine>,
    version: Optional<LyricVersionType>,
    clone: Optional<boolean>
  ) {
    if (lyric) {
      const chosenVersion = this.checkLyricVersion(lyric, version, null);
      if (clone) return structuredClone(lyric[chosenVersion]);
      return lyric[chosenVersion];
    } else {
      return [];
    }
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
}

const noLyricPreset = {
  full: [],
  rm: [],
  tl: [],
  raw: [
    {
      words: [
        {
          startTime: 0,
          endTime: 999999999999,
          obscene: false,
          word: "暂无歌词",
          romanWord: ""
        }
      ],
      translatedLyric: "",
      romanLyric: "",
      startTime: 0,
      endTime: 999999999999,
      isBG: false,
      isDuet: false
    }
  ]
};

const pureMusicLyricPreset = {
  full: [],
  rm: [],
  tl: [],
  raw: [
    {
      words: [
        {
          startTime: 0,
          endTime: 999999999999,
          obscene: false,
          word: "纯音乐，请欣赏",
          romanWord: ""
        }
      ],
      translatedLyric: "",
      romanLyric: "",
      startTime: 0,
      endTime: 999999999999,
      isBG: false,
      isDuet: false
    }
  ]
};

export const NeteaseLyric = new NeteaseLyricClass();
