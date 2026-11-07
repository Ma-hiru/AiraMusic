import { BLANK_LYRIC_TEXT, resolveMenuLyricLine } from "@mahiru/app/lib/tray/menu-lyric";

const word = (text: string, startTime: number, endTime: number): LyricWord => ({
  word: text,
  startTime,
  endTime
});

const line = (
  startTime: number,
  endTime: number,
  words: LyricWord[],
  extra?: Partial<LyricLine>
): LyricLine => ({
  startTime,
  endTime,
  words,
  translatedLyric: "",
  romanLyric: "",
  ...extra
});

const lyric = (data: LyricLine[]): NeteaseLyricModel => ({
  data,
  rmExisted: false,
  tlExisted: false,
  noteExisted: false
});

describe("resolveMenuLyricLine", () => {
  it("把逐词时间折算成相对行首，并保持文本与词表一致", () => {
    const model = lyric([
      line(10_000, 13_000, [
        word("沿着", 10_000, 10_800),
        word("城市", 10_800, 11_500),
        word("向前", 11_500, 13_000)
      ])
    ]);

    const result = resolveMenuLyricLine(model, 11_000);

    expect(result).toEqual({
      startTime: 10_000,
      text: "沿着城市向前",
      words: [
        { startMs: 0, endMs: 800, text: "沿着" },
        { startMs: 800, endMs: 1500, text: "城市" },
        { startMs: 1500, endMs: 3000, text: "向前" }
      ]
    });
  });

  it("剔除内嵌注音，并裁掉行首尾空白", () => {
    const model = lyric([
      line(0, 2000, [
        word(" 君", 0, 400),
        word("の", 400, 600),
        word("名", 600, 1000),
        word("は", 1000, 2000)
      ])
    ]);
    // 第 2 个词为假名注音
    model.data[0]!.words[1]!.inlineNote = true;
    model.data[0]!.words[3]!.word = "は ";

    const result = resolveMenuLyricLine(model, 500);

    expect(result?.text).toBe("君名は");
    expect(result?.words.map((item) => item.text)).toEqual(["君", "名", "は"]);
    expect(result?.words.map((item) => item.startMs)).toEqual([0, 600, 1000]);
  });

  it("逐行时间轴没有词级信息时铺满整行", () => {
    const model = lyric([
      line(5000, 5000, [word("一句没有逐词时间的歌词", 5000, 5000)]),
      line(9000, 12_000, [word("下一行", 9000, 12_000)])
    ]);

    const result = resolveMenuLyricLine(model, 6000);

    expect(result?.words).toEqual([{ startMs: 0, endMs: 4000, text: "一句没有逐词时间的歌词" }]);
  });

  it("空行退化成静态占位文本，不再做逐字高亮", () => {
    const model = lyric([line(0, 3000, [word("   ", 0, 3000)])]);

    const result = resolveMenuLyricLine(model, 1000);

    expect(result).toEqual({ startTime: 0, text: BLANK_LYRIC_TEXT, words: [] });
  });

  it("按时间取最后一行匹配，首行之前与空歌词都返回 null", () => {
    const model = lyric([
      line(1000, 2000, [word("第一行", 1000, 2000)]),
      line(2000, 4000, [word("第二行", 2000, 4000)])
    ]);

    expect(resolveMenuLyricLine(model, 2500)?.text).toBe("第二行");
    expect(resolveMenuLyricLine(model, 999)).toBeNull();
    expect(resolveMenuLyricLine(null, 1000)).toBeNull();
    expect(resolveMenuLyricLine(lyric([]), 1000)).toBeNull();
  });

  it("行时长缺失时用下一行起点补齐", () => {
    const model = lyric([
      line(0, 0, [word("第一行", 0, 0)]),
      line(2500, 5000, [word("第二行", 2500, 5000)])
    ]);

    const result = resolveMenuLyricLine(model, 500);

    expect(result?.words).toEqual([{ startMs: 0, endMs: 2500, text: "第一行" }]);
  });

  it("乱序的行与词也能按时间归一化", () => {
    const model = lyric([
      line(2000, 4000, [word("第二行", 2000, 4000)]),
      line(1000, 2000, [word("后", 800, 1000), word("先", 0, 800)])
    ]);

    const first = resolveMenuLyricLine(model, 1500);

    expect(first?.startTime).toBe(1000);
    expect(first?.text).toBe("先后");
    expect(first?.words.map((item) => item.text)).toEqual(["先", "后"]);
    expect(resolveMenuLyricLine(model, 2500)?.text).toBe("第二行");
  });

  it("对唱/背景行同时激活时让位主歌词", () => {
    const model = lyric([
      line(1000, 5000, [word("主歌词", 1000, 5000)]),
      line(2000, 5000, [word("和声", 2000, 5000)], { isBackChorus: true })
    ]);

    // 时间落在两行区间内，主歌词行先开始、和声行后开始，仍取主歌词
    expect(resolveMenuLyricLine(model, 3000)?.text).toBe("主歌词");
    // 主歌词行结束后只剩和声行在区间内
    expect(resolveMenuLyricLine(model, 6000)?.text).toBe("和声");
  });
});
