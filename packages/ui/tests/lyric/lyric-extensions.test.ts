import { extendLyric } from "@mahiru/ui/common/components/display/lyric/utils";
import { TimeManager } from "@mahiru/ui/common/components/display/lyric/time-manager";
import { NeteaseLyric, NeteaseLyricSchema } from "@mahiru/ui/common/netease/models/netease-lyric";

vi.unmock("@applemusic-like-lyrics/lyric");

const line = (startTime = 1000, endTime = 2000): LyricLine => ({
  startTime,
  endTime,
  words: [{ word: "歌词", startTime, endTime }],
  translatedLyric: "",
  romanLyric: ""
});

describe("歌词扩展字段", () => {
  it("keeps YRC word timing and its translation when supplementing romanization from LRC", () => {
    const lyric = NeteaseLyric.fromNeteaseAPIResponse({
      yrc: { lyric: "[1000,1000](1000,500,0)逐(1500,500,0)字" },
      ytlrc: { lyric: "[00:01.00]YRC translation" },
      lrc: { lyric: "[00:01.00]逐字" },
      romalrc: { lyric: "[00:01.00]zhu zi" }
    } as Parameters<typeof NeteaseLyric.fromNeteaseAPIResponse>[0]);
    expect(lyric.hasWordTiming()).toBe(true);
    expect(lyric.data[0]?.translatedLyric).toBe("YRC translation");
    expect(lyric.data[0]?.romanLyric).toBe("zhu zi");
  });

  it("keeps NetEase JSON credits and source positions outside the lyric text", () => {
    const header = { t: -1000, c: [{ tx: "作曲：测试" }] };
    const tail = {
      t: 4000,
      c: [
        {
          tx: "歌手",
          li: "https://example.com/avatar.jpg",
          or: "orpheus://nm/artist/home?id=17301&type=artist"
        }
      ]
    };
    const lyric = NeteaseLyric.fromNeteaseAPIResponse({
      lrc: {
        lyric: [
          JSON.stringify(header),
          "[00:01.00]第一句",
          "[00:03.00]最后一句",
          JSON.stringify(tail)
        ].join("\n")
      }
    } as Parameters<typeof NeteaseLyric.fromNeteaseAPIResponse>[0]);
    expect(lyric.embeds).toEqual([
      { ...header, position: 0 },
      { ...tail, position: 3 }
    ]);
    expect(
      lyric.data
        .flatMap((row) => row.words)
        .map((word) => word.word)
        .join("")
    ).not.toContain('"t":');
    expect(NeteaseLyricSchema.parse(JSON.parse(JSON.stringify(lyric))).embeds).toEqual(
      lyric.embeds
    );
  });

  it("positions headers and tail credits without mutating the shared lyric model", () => {
    const original = [line(1000, 59_999_999)];
    const embeds: LyricEmbed[] = [
      { t: -1000, position: 0, c: [{ tx: "作词" }] },
      { t: -500, position: 1, c: [{ tx: "作曲" }] },
      { t: 4000, position: 3, c: [{ tx: "制作" }] },
      { t: 4500, position: 4, c: [{ tx: "发行" }] }
    ];
    const rows = extendLyric(original, embeds, 5000);
    expect(rows.map((row) => [row.startTime, row.endTime])).toEqual([
      [0, 999],
      [1000, 3999],
      [4000, 4499],
      [4500, 5000]
    ]);
    expect(rows[0]?.embeds).toEqual(embeds.slice(0, 2));
    expect(original[0]?.endTime).toBe(59_999_999);
    expect(original[0]?.words[0]?.endTime).toBe(59_999_999);
    const manager = new TimeManager(rows);
    manager.update(4200);
    expect(manager.getCurrentLineIndex()).toEqual([2]);
  });

  it("retains every TTML language on main and background vocals through normalization and schema", () => {
    const lyric = NeteaseLyric.fromTTMLyric(
      `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word" xml:lang="ja">
      <head><metadata><ttm:agent type="person" xml:id="v1"/><ttm:agent type="other" xml:id="v2"/>
      <iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><translations>
        <translation type="subtitle" xml:lang="en"><text for="L1">Main English<span xmlns="http://www.w3.org/ns/ttml" ttm:role="x-bg">Background English</span></text><text for="L2">Second English</text></translation>
        <translation type="subtitle" xml:lang="zh-Hans"><text for="L1">中文主唱<span xmlns="http://www.w3.org/ns/ttml" ttm:role="x-bg">中文和声</span></text><text for="L2">中文第二行</text></translation>
      </translations></iTunesMetadata></metadata></head>
      <body dur="5s"><div><p begin="1s" end="3s" itunes:key="L1" ttm:agent="v1"><span begin="1s" end="2s">主</span><span begin="2s" end="3s">唱</span><span ttm:role="x-bg"><span begin="1.5s" end="2.5s">和声</span></span></p><p begin="3s" end="4s" itunes:key="L2" ttm:agent="v2">对唱</p></div></body></tt>`,
      false
    );
    const roundtrip = new NeteaseLyric(NeteaseLyricSchema.parse(JSON.parse(JSON.stringify(lyric))));
    expect(roundtrip.translationLanguages).toEqual(["en", "zh-Hans"]);
    expect(
      roundtrip.data.map((row) => row.translations?.map((translation) => translation.text))
    ).toEqual([
      ["Main English", "中文主唱"],
      ["Background English", "中文和声"],
      ["Second English", "中文第二行"]
    ]);
    expect(roundtrip.data.map((row) => row.translatedLyric)).toEqual([
      "中文主唱",
      "中文和声",
      "中文第二行"
    ]);
    expect(roundtrip.data[1]?.isBG).toBe(true);
    expect(roundtrip.data[2]?.isDuet).toBe(true);
  });
});

describe("localTTML 特殊效果判定", () => {
  it("requires real independent word timing", () => {
    const row = line();
    row.words = [
      { word: "逐", startTime: 1000, endTime: 1500 },
      { word: "字", startTime: 1500, endTime: 2000 }
    ];
    expect(new NeteaseLyric({ data: [row] }).hasSpecialEffects()).toBe(true);
    row.words[1]!.startTime = 1000;
    expect(new NeteaseLyric({ data: [row] }).hasSpecialEffects()).toBe(false);
  });

  it("recognizes duets and overlapping vocals, ignoring mere chorus punctuation and unknown ends", () => {
    expect(new NeteaseLyric({ data: [{ ...line(), isDuet: true }] }).hasSpecialEffects()).toBe(
      true
    );
    expect(
      new NeteaseLyric({ data: [line(1000, 2200), line(2000, 3000)] }).hasSpecialEffects()
    ).toBe(true);
    expect(
      new NeteaseLyric({
        data: [{ ...line(), isBackChorus: true }, line(2000, 3000)]
      }).hasSpecialEffects()
    ).toBe(false);
    expect(
      new NeteaseLyric({ data: [line(1000, 59_999_999), line(2000, 3000)] }).hasSpecialEffects()
    ).toBe(false);
  });
});
