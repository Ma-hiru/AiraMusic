import {
  LyricLine as RawLyricLine,
  LyricWord as RawLyricWord,
  parseLrc,
  parseQrc
} from "@applemusic-like-lyrics/lyric";
import { LyricLine, LyricWord } from "@applemusic-like-lyrics/core";
import { parseNeteaseLyric, parseTranslatedLRC, parseExternalLrc } from "@mahiru/wasm";
import { EqError, Log } from "@mahiru/ui/utils/dev";

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
  raw: NeteaseLrc | NeteaseKlyric,
  ts: NeteaseTlyric | undefined,
  rm: NeteaseRomalrc | undefined,
  type: "LRC" | "QRC",
  mt?: NeteaseTransUser
) {
  try {
    const mainLyric = type === "LRC" ? externalParseLrc(raw.lyric) : parseQrc(raw.lyric);
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
    Log.error(
      new EqError({
        raw: err,
        label: "ui/lyric.ts:parseNeteaseLyricWasm",
        message: "Failed to parse Netease lyric with wasm parser"
      })
    );
    return {
      full: [],
      raw: [],
      tl: [],
      rm: []
    } as FullVersionLyricLine;
  }
}

export function handleNeteaseLyricResponse(response: NeteaseLyricResponse): FullVersionLyricLine {
  const translatedLyric = response.tlyric;
  const romanLyric = response.romalrc;
  const meta = response.transUser;
  const LRC = response.lrc;
  const QRC = response.klyric;
  if (QRC && QRC.lyric) {
    return parseNeteaseLyricWasm(QRC, translatedLyric, romanLyric, "QRC", meta);
  } else if (LRC && LRC.lyric) {
    return parseNeteaseLyricWasm(LRC, translatedLyric, romanLyric, "LRC", meta);
  }
  return {
    full: [],
    raw: [],
    tl: [],
    rm: []
  };
}
