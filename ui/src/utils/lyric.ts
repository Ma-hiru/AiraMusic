import {
  LyricLine as RawLyricLine,
  LyricWord as RawLyricWord,
  parseLrc
} from "@applemusic-like-lyrics/lyric";
import { LyricLine, LyricWord } from "@applemusic-like-lyrics/core";

export function mapRawLyricLine(line: RawLyricLine): LyricLine {
  return {
    ...line,
    words: line.words.map((word) => ({ obscene: false, ...word }))
  };
}

export function mapRawLyricWord(words: RawLyricWord[]): LyricWord[] {
  return words.map((word) => ({ obscene: false, ...word }));
}

export function handleTranslatedLRC(content: string): LyricLine[] {
  const parsedRawLRC = parseLrc(content);
  let lastMatchedIndex = -1;
  return parsedRawLRC.reduce(
    (final, rawLRC, index) => {
      if (lastMatchedIndex !== index) {
        if (
          rawLRC.startTime === rawLRC.endTime &&
          parsedRawLRC.length - 1 > index + 1 &&
          parsedRawLRC[index + 1]!.startTime === rawLRC.endTime
        ) {
          final.push({
            startTime: rawLRC.startTime,
            endTime: parsedRawLRC[index + 1]!.endTime,
            translatedLyric: parsedRawLRC[index + 1]!.words.map((w) => w.word).join(""),
            romanLyric: "",
            isBG: false,
            isDuet: false,
            words: mapRawLyricWord(rawLRC.words)
          });
          lastMatchedIndex = index + 1;
        } else {
          final.push(mapRawLyricLine(rawLRC));
        }
      } else {
        lastMatchedIndex = -1;
      }
      return final;
    },
    <LyricLine[]>[]
  );
}
