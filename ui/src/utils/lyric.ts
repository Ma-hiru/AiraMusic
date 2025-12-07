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

export function mapRawLyricLine(line: RawLyricLine): LyricLine {
  return {
    ...line,
    words: line.words.map((word) => ({ obscene: false, ...word }))
  };
}

export function mapRawLyricWord(words: RawLyricWord[]): LyricWord[] {
  return words.map((word) => ({ obscene: false, ...word }));
}

export function parseTranslatedLRCWasm(content: string): LyricLine[] {
  const raw = parseLrc(content);
  return parseTranslatedLRC(raw, false) as LyricLine[];
}

export type FullVersionLyricLine = {
  full: LyricLine[];
  raw: LyricLine[];
  tl: LyricLine[];
  rm: LyricLine[];
};

function externalParseLrc(lyric: string) {
  // eg: [00:00.00-1] 作曲 : solfa \n
  lyric = parseExternalLrc(lyric);
  return parseLrc(lyric);
}

function parseNeteaseLyricWasm(
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
          return externalParseLrc(raw.lyric);
      }
    })();
    const translatedLyric = externalParseLrc(ts?.lyric || "");
    const romanLyric = externalParseLrc(rm?.lyric || "");

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

export function handleNeteaseLyricResponse(
  response: NeteaseLyricResponseNew
): FullVersionLyricLine {
  const translatedLyric = response.tlyric;
  const romanLyric = response.romalrc;
  const meta = response.transUser;
  const LRC = response.lrc;
  const QRC = response.klyric;
  const YRC = response.yrc;
  if (QRC && QRC.lyric) {
    return parseNeteaseLyricWasm(QRC, translatedLyric, romanLyric, "QRC", meta);
  } else if (LRC && LRC.lyric) {
    return parseNeteaseLyricWasm(LRC, translatedLyric, romanLyric, "LRC", meta);
  } else if (YRC && YRC.lyric) {
    return parseNeteaseLyricWasm(YRC, translatedLyric, romanLyric, "YRC", meta);
  }
  return {
    full: [],
    raw: [],
    tl: [],
    rm: []
  };
}
