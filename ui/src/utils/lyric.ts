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

  async requestLyric(id: number, preference?: Optional<LyricVersionType>) {
    const response = await getYRCLyric(id);
    const lyric = this.handleLyricResponse(response);
    const version = this.chooseLyricVersionWithPreference(lyric, preference);
    return {
      lyric,
      version,
      response
    };
  }

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

  handleLyricResponse(response: NeteaseLyricResponseNew): FullVersionLyricLine {
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

  chooseLyric(lyric: Optional<FullVersionLyricLine>, version: Optional<LyricVersionType>) {
    if (lyric) {
      const chosenVersion = this.checkLyricVersion(lyric, version, null);
      return lyric[chosenVersion];
    } else {
      return [];
    }
  }

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
