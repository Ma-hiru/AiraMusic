import { extendLyric } from "@mahiru/ui/common/components/display/lyric/utils";
import { TimeManager } from "@mahiru/ui/common/components/display/lyric/time-manager";

const line = (startTime: number, endTime: number, text = "歌词"): LyricLine => ({
  startTime,
  endTime,
  words: [{ word: text, startTime, endTime }],
  translatedLyric: "",
  romanLyric: ""
});

describe("extendLyric", () => {
  it("handles empty lyrics and lyrics consisting only of blank lines", () => {
    expect(extendLyric([])).toEqual([]);
    expect(extendLyric([line(0, 1000, ""), line(1000, 2000, " ")])).toEqual([]);
  });

  it("leaves the original model untouched across repeated extension and TimeManager normalization", () => {
    const original = [line(1000, 3000)];
    original[0]!.words = [
      { word: "后", startTime: 2000, endTime: 3000 },
      { word: "先", startTime: 1000, endTime: 2000 }
    ];
    original[0]!.words.forEach(Object.freeze);
    Object.freeze(original[0]!.words);
    Object.freeze(original[0]);
    Object.freeze(original);
    const snapshot = JSON.stringify(original);
    const first = extendLyric(original);
    expect(extendLyric(original)).toEqual(first);
    const manager = new TimeManager(first);
    manager.update(1100);
    expect(manager.getCurrentLine()[0]?.words.map((word) => word.word)).toEqual(["先", "后"]);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("inserts an opening wait for a long intro without inserting one for a single lyric line", () => {
    const rows = extendLyric([line(8000, 8500), line(9000, 10000)]);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.wait).toMatchObject({ total: 3 });
    expect(rows[0]?.endTime).toBe(7999);
    expect(extendLyric([line(8000, 8500)])).toHaveLength(1);
  });

  it("merges consecutive blank rows into one three-step wait bounded by the vocals", () => {
    const rows = extendLyric([
      line(0, 1000),
      line(1200, 5000, ""),
      line(6000, 8000, " "),
      line(9000, 10000)
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({ startTime: 1001, endTime: 8999, wait: { total: 3 } });
    const wait = rows[1]!.wait;
    expect(wait && wait.steps.every((step) => step.endTime > step.startTime)).toBe(true);
    const manager = new TimeManager(rows);
    manager.update(2000);
    expect(manager.getCurrentLineIndex()).toEqual([1]);
    manager.update(7000);
    expect(manager.getCurrentLineIndex()).toEqual([2]);
  });

  it("keeps short gaps free of countdown dots and omits trailing blank rows", () => {
    const rows = extendLyric([
      line(0, 1000),
      line(1200, 2000, ""),
      line(2500, 3000),
      line(4000, 10000, "")
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({ startTime: 1001, endTime: 2499, wait: false });
    expect(
      rows[1]?.words
        .map((word) => word.word)
        .join("")
        .trim()
    ).toBe("");
    expect(rows[2]?.startTime).toBe(2500);
  });

  it("groups simultaneous credits in source order while retaining overlapping vocals and their languages", () => {
    const main = line(1000, 3500);
    const duet = {
      ...line(1000, 3200),
      isDuet: true,
      translations: [{ language: "en", text: "Duet" }]
    };
    const credits: LyricEmbed[] = [
      { t: 1000, position: 5, c: [{ tx: "后" }] },
      { t: 1000, position: 1, c: [{ tx: "先" }] },
      { t: 4000, position: 9, c: [{ tx: "末尾" }] }
    ];
    const rows = extendLyric([main, duet], credits, 5000);
    expect(rows.map((row) => row.startTime)).toEqual([1000, 1000, 1000, 4000]);
    expect(rows[0]?.embeds?.map((embed) => embed.position)).toEqual([1, 5]);
    expect(credits.map((embed) => embed.position)).toEqual([5, 1, 9]);
    expect(rows[2]).toMatchObject({ isDuet: true, endTime: 3200, translations: duet.translations });
    const manager = new TimeManager(rows);
    manager.update(1200);
    expect(manager.getCurrentLineIndex()).toEqual([0, 1, 2]);
  });

  it("keeps missing or short song durations from producing invalid final credit intervals", () => {
    const credits: LyricEmbed[] = [{ t: 4000, position: 1, c: [{ tx: "制作" }] }];
    for (const duration of [undefined, 3000]) {
      const rows = extendLyric([line(1000, 59_999_999)], credits, duration);
      expect(rows.map((row) => [row.startTime, row.endTime])).toEqual([
        [1000, 3999],
        [4000, 4000]
      ]);
    }
    expect(extendLyric([], credits, 5000)[0]).toMatchObject({
      startTime: 4000,
      endTime: 5000,
      embeds: credits
    });
  });
});
