import { NeteaseLyric } from "@mahiru/ui/common/source/netease/models/netease-lyric";
import { setTTMLMock } from "../mocks/amll-lyric";

type AMLLyricLine = {
  words: {
    word: string;
    romanWord: string;
    startTime: number;
    endTime: number;
  }[];
  translatedLyric: string;
  romanLyric: string;
  isBG: boolean;
  isDuet: boolean;
  startTime: number;
  endTime: number;
};

describe("NeteaseLyric TTML parsing", () => {
  beforeEach(() => {
    setTTMLMock({ lines: [], metadata: [] });
  });

  it("enables extra lyric flags only when at least half of nonblank lines have content", () => {
    const lyric = parseTTMLLines([
      ttmlLine(0, "line 1", { translatedLyric: "translated 1" }),
      ttmlLine(1000, "line 2", { translatedLyric: "translated 2" }),
      ttmlLine(2000, "line 3", { translatedLyric: "translated 3" }),
      ttmlLine(3000, "line 4", { romanLyric: "roman 4" })
    ]);

    expect(lyric.tlExisted).toBe(true);
    expect(lyric.rmExisted).toBe(false);
  });

  it("ignores blank TTML spacer lines when computing extra lyric availability", () => {
    const lyric = parseTTMLLines([
      ttmlLine(0, "line 1", { translatedLyric: "translated 1" }),
      ttmlLine(500, ""),
      ttmlLine(1000, "line 2", { translatedLyric: "translated 2" }),
      ttmlLine(1500, ""),
      ttmlLine(2000, "line 3")
    ]);

    expect(lyric.tlExisted).toBe(true);
    expect(lyric.data.filter((line) => line.isBlank)).toHaveLength(2);
  });

  it("maps TTML duet and background lines to back chorus lines", () => {
    const lyric = parseTTMLLines([
      ttmlLine(0, "duet line", { isDuet: true }),
      ttmlLine(1000, "background line", { isBG: true }),
      ttmlLine(2000, "main line")
    ]);

    expect(lyric.data[0]?.isBackChorus).toBe(true);
    expect(lyric.data[1]?.isBackChorus).toBe(true);
    expect(lyric.data[2]?.isBackChorus).toBe(false);
  });

  it("enables inline notes when ruby-like pairs are common enough", () => {
    const lyric = parseTTMLLines([
      ttmlLine(0, ["声", "（こえ）"]),
      ttmlLine(1000, ["光", "（ひかり）"]),
      ttmlLine(2000, ["夢", "（ゆめ）"])
    ]);

    expect(lyric.noteExisted).toBe(true);
    expect(lyric.data.every((line) => line.words.some((word) => word.inlineNote))).toBe(true);
  });

  it("does not enable inline notes when only one line looks like ruby", () => {
    const lyric = parseTTMLLines([
      ttmlLine(0, ["声", "（こえ）"]),
      ttmlLine(1000, "plain 1"),
      ttmlLine(2000, "plain 2"),
      ttmlLine(3000, "plain 3")
    ]);

    expect(lyric.noteExisted).toBe(false);
    expect(lyric.data[0]?.words.some((word) => word.inlineNote)).toBe(false);
  });
});

function parseTTMLLines(lines: AMLLyricLine[]) {
  setTTMLMock({ lines, metadata: [] });
  return NeteaseLyric.fromTTMLyric("<tt />");
}

function ttmlLine(
  startTime: number,
  words: string | string[],
  props: Partial<AMLLyricLine> = {}
): AMLLyricLine {
  const wordList = Array.isArray(words) ? words : [words];

  return {
    words: wordList.map((word, index) => ({
      word,
      romanWord: "",
      startTime: startTime + index * 100,
      endTime: startTime + (index + 1) * 100
    })),
    translatedLyric: "",
    romanLyric: "",
    isBG: false,
    isDuet: false,
    startTime,
    endTime: startTime + Math.max(wordList.length, 1) * 100,
    ...props
  };
}
