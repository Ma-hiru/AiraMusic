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
import { noLyricPreset, pureMusicLyricPreset } from "@mahiru/ui/public/constants/lyric";

export const LyricParser = new (class {
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
})();
