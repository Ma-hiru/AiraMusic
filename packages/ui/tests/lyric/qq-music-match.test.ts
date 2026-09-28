import { QQMusicLyric } from "@mahiru/ui/common/lib/qq-music-lyric";
import type { NeteaseTrack } from "@mahiru/ui/common/netease/models";
import type { QQSong } from "@mahiru/ui/common/lib/qq-music-lyric/model";

const track = {
  name: "晴天",
  dt: 269_000,
  artist: ["周杰伦"],
  al: { name: "叶惠美" }
} as NeteaseTrack;

const song = (overrides: Partial<QQSong> = {}): QQSong => ({
  id: 97773,
  mid: "0039MnYb0qxYhV",
  title: "晴天",
  interval: 269,
  singer: [{ id: 4558, mid: "0025NhlN2yWrP4", name: "周杰伦" }],
  album: { id: 8220, mid: "000MkMni19ClKG", name: "叶惠美" },
  ...overrides
});

describe("matchQQSong", () => {
  it("selects the matching QQ song instead of blindly using the first result", () => {
    const result = QQMusicLyric.match(track, [
      song({ id: 1, title: "稻香", interval: 252 }),
      song()
    ]);

    expect(result?.song.id).toBe(97773);
    expect(result?.score).toBeGreaterThanOrEqual(70);
  });

  it("accepts a version suffix when title, artist and duration agree", () => {
    const result = QQMusicLyric.match(track, [song({ title: "晴天 (现场版)" })]);

    expect(result?.song.title).toBe("晴天 (现场版)");
  });

  it("rejects a same-title result with unrelated artist and duration", () => {
    const result = QQMusicLyric.match(track, [
      song({ singer: [{ name: "另一个歌手" }], interval: 120 })
    ]);

    expect(result).toBeNull();
  });

  it("returns null for an empty search response", () => {
    expect(QQMusicLyric.match(track, [])).toBeNull();
  });
});
