import { NeteaseLyric } from "@mahiru/ui/common/source/netease/models/NeteaseLyric";
import { setTTMLMock } from "../mocks/amllLyric";

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

  it("uses matched translation and roman counts for availability flags", () => {
    setTTMLMock({
      lines: [
        ttmlLine(0, "line 1", { translatedLyric: "translated 1" }),
        ttmlLine(1000, "line 2", { translatedLyric: "translated 2" }),
        ttmlLine(2000, "line 3", { translatedLyric: "translated 3" }),
        ttmlLine(3000, "line 4", { romanLyric: "roman 4" })
      ],
      metadata: []
    });

    const lyric = NeteaseLyric.fromTTMLyric("<tt />");

    expect(lyric.tlExisted).toBe(true);
    expect(lyric.rmExisted).toBe(false);
  });

  it("ignores blank TTML spacer lines for availability flags", () => {
    setTTMLMock({
      lines: [
        ttmlLine(0, "line 1", { translatedLyric: "translated 1" }),
        ttmlLine(500, ""),
        ttmlLine(1000, "line 2", { translatedLyric: "translated 2" }),
        ttmlLine(1500, ""),
        ttmlLine(2000, "line 3")
      ],
      metadata: []
    });

    const lyric = NeteaseLyric.fromTTMLyric("<tt />");

    expect(lyric.tlExisted).toBe(true);
  });

  it("keeps TTML duet lines as back chorus lines", () => {
    setTTMLMock({
      lines: [ttmlLine(0, "duet line", { isDuet: true })],
      metadata: []
    });

    const lyric = NeteaseLyric.fromTTMLyric("<tt />");

    expect(lyric.data[0]?.isBackChorus).toBe(true);
  });

  it("does not enable inline notes when only one line looks like ruby", () => {
    setTTMLMock({
      lines: [
        ttmlLine(0, ["声", "（こえ）"]),
        ttmlLine(1000, "plain 1"),
        ttmlLine(2000, "plain 2"),
        ttmlLine(3000, "plain 3")
      ],
      metadata: []
    });

    const lyric = NeteaseLyric.fromTTMLyric("<tt />");

    expect(lyric.noteExisted).toBe(false);
    expect(lyric.data[0]?.words.some((word) => word.inlineNote)).toBe(false);
  });
});

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
