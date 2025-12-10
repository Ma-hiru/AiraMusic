import {
  LyricLine as RawLyricLine,
  LyricWord as RawLyricWord,
  parseLrc,
  parseQrc,
  parseYrc
} from "@applemusic-like-lyrics/lyric";
import { LyricLine, LyricWord } from "@applemusic-like-lyrics/core";
import { parseExternalLrc, parseNeteaseLyric, parseTranslatedLRC } from "@mahiru/wasm";
import { Log } from "@mahiru/ui/utils/dev";
import { LyricParseErr } from "@mahiru/ui/utils/errs";
import { getYRCLyric } from "@mahiru/ui/api/lyric";

class Parser {
  mapRawLyricLine(line: RawLyricLine): LyricLine {
    return {
      ...line,
      words: line.words.map((word) => ({ obscene: false, ...word }))
    };
  }

  mapRawLyricWord(words: RawLyricWord[]): LyricWord[] {
    return words.map((word) => ({ obscene: false, ...word }));
  }

  parseTranslatedLRCWasm(content: string): LyricLine[] {
    const raw = parseLrc(content);
    return parseTranslatedLRC(raw, false) as LyricLine[];
  }

  parseExternalLrc(lyric: string) {
    // eg: [00:00.00-1] 作曲 : solfa \n
    lyric = parseExternalLrc(lyric);
    return parseLrc(lyric);
  }

  parseNeteaseLyricWasm(
    raw: NeteaseLrc | NeteaseKlyric | NeteaseYRC,
    ts: NeteaseTlyric | undefined,
    rm: NeteaseRomalrc | undefined,
    type: "LRC" | "QRC" | "YRC",
    mt?: NeteaseTransUser
  ) {
    try {
      const mainLyric = (() => {
        switch (type) {
          case "YRC":
            return parseYrc(raw.lyric);
          case "QRC":
            return parseQrc(raw.lyric);
          case "LRC":
            return this.parseExternalLrc(raw.lyric);
        }
      })();
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
      Log.error(LyricParseErr.create("ui/utils/lyric.ts:parseNeteaseLyricWasm", err));
      return {
        full: [],
        raw: [],
        tl: [],
        rm: []
      } as FullVersionLyricLine;
    }
  }

  parseNeteaseLyricResponse(response: NeteaseLyricResponseNew) {
    const translatedLyric = response.tlyric;
    const romanLyric = response.romalrc;
    const meta = response.transUser;
    const LRC = response.lrc;
    const QRC = response.klyric;
    const YRC = response.yrc;
    if (QRC && QRC.lyric) {
      return this.parseNeteaseLyricWasm(QRC, translatedLyric, romanLyric, "QRC", meta);
    } else if (LRC && LRC.lyric) {
      return this.parseNeteaseLyricWasm(LRC, translatedLyric, romanLyric, "LRC", meta);
    } else if (YRC && YRC.lyric) {
      return this.parseNeteaseLyricWasm(YRC, translatedLyric, romanLyric, "YRC", meta);
    }
    return {
      full: [],
      raw: [],
      tl: [],
      rm: []
    };
  }
}

export const Lyric = new (class {
  Parser = new Parser();

  async requestLyric(id: number, versionPreference?: LyricVersionType) {
    const response = await getYRCLyric(id);
    const lyric = this.handleLyricResponse(response);
    const version = this.chooseLyricResponseVersion(lyric, versionPreference);
    return {
      lyric,
      version,
      response
    };
  }

  getLyricVersionInfo(lyric: FullVersionLyricLine) {
    const hasRm = lyric.rm.length > 0;
    const hasTl = lyric.tl.length > 0;
    const hasFull = lyric.full.length > 0;
    const hasRaw = lyric.raw.length > 0;
    return {
      hasRm,
      hasTl,
      hasFull,
      hasRaw
    };
  }

  private handleLyricResponse(response: NeteaseLyricResponseNew): FullVersionLyricLine {
    if (
      !response.lrc?.lyric &&
      !response.klyric?.lyric &&
      !response.romalrc?.lyric &&
      !response.tlyric?.lyric &&
      !response.yrc
    ) {
      return {
        full: [noLyricPreset],
        rm: [noLyricPreset],
        tl: [noLyricPreset],
        raw: [noLyricPreset]
      };
    }
    const parsedLyric = this.Parser.parseNeteaseLyricResponse(response);
    if (!parsedLyric)
      return {
        full: [noLyricPreset],
        rm: [noLyricPreset],
        tl: [noLyricPreset],
        raw: [noLyricPreset]
      };
    if (parsedLyric.raw.length === 0) {
      return {
        full: [pureMusicLyricPreset],
        rm: [pureMusicLyricPreset],
        tl: [pureMusicLyricPreset],
        raw: [pureMusicLyricPreset]
      };
    } else {
      return parsedLyric;
    }
  }

  private chooseLyricResponseVersion(
    lyric: FullVersionLyricLine,
    versionPreference?: LyricVersionType
  ) {
    const { hasRm, hasTl } = this.getLyricVersionInfo(lyric);
    if (!versionPreference) {
      if (hasTl) {
        return "tl";
      }
      if (hasRm) {
        return "rm";
      }
      return "raw";
    }
    if (versionPreference === "raw" && hasTl) {
      return "tl";
    }
    if (versionPreference === "full") {
      if (!hasRm && !hasTl) {
        return "raw";
      } else if (!hasRm && hasTl) {
        return "tl";
      } else if (hasRm && !hasTl) {
        return "rm";
      }
    } else if (versionPreference === "rm" && !hasRm) {
      if (hasTl) {
        return "tl";
      } else {
        return "raw";
      }
    } else if (versionPreference === "tl" && !hasTl) {
      if (hasRm) {
        return "rm";
      } else {
        return "raw";
      }
    }
    return versionPreference;
  }
})();

export type LyricVersionType = "raw" | "full" | "tl" | "rm";

export type FullVersionLyricLine = {
  full: LyricLine[];
  raw: LyricLine[];
  tl: LyricLine[];
  rm: LyricLine[];
};

const noLyricPreset = {
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
};

const pureMusicLyricPreset = {
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
};
