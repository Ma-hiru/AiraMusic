import { TimeManager } from "@mahiru/ui/common/components/display/lyric/time-manager";
import type { LyricLineExtended } from "@mahiru/ui/common/components/display/lyric/utils";

describe("TimeManager line focus", () => {
  it("keeps the previous line focused between lyrics and after the final line", () => {
    const manager = new TimeManager([line(1000, 1200), line(2000, 2200)]);

    manager.update(500);
    expect(manager.getCurrentLineIndex()).toEqual([-1]);

    manager.update(500);
    expect(manager.getCurrentLineIndex()).toEqual([0]);

    manager.update(500);
    expect(manager.getCurrentLineIndex()).toEqual([0]);

    manager.update(500);
    expect(manager.getCurrentLineIndex()).toEqual([1]);

    manager.update(500);
    expect(manager.getCurrentLineIndex()).toEqual([1]);
  });
});

function line(startTime: number, endTime: number): LyricLineExtended {
  return {
    startTime,
    endTime,
    words: [{ word: "lyric", startTime, endTime }],
    translatedLyric: "",
    romanLyric: "",
    isBlank: false,
    isBackChorus: false,
    wait: false
  };
}
