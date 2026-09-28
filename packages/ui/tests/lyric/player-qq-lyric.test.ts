import { vi } from "vitest";
import { RendererNet } from "@mahiru/ui/common/lib/net";
import { QQMusicLyric } from "@mahiru/ui/common/lib/qq-music-lyric";
import { NeteaseLyric, type NeteaseTrack } from "@mahiru/ui/common/netease/models";
import NeteaseServicesLyric from "@mahiru/ui/common/netease/services/lyric";
import type { QQSong, QQLyricResponse } from "@mahiru/ui/common/lib/qq-music-lyric/model";

import japaneseLyricJSON from "./fixtures/qq-lyric-japanese.json";

vi.unmock("@applemusic-like-lyrics/lyric");
vi.mock("@/common/lib/net", () => ({ RendererNet: { requestFromNode: vi.fn() } }));
vi.mock("@/common/lib/cache", () => ({
  RendererCache: {
    service: {
      object: {
        getOne: vi.fn().mockResolvedValue(null),
        setOne: vi.fn().mockResolvedValue(undefined)
      }
    }
  }
}));
vi.mock("@/common/netease/api", () => ({
  NeteaseAPILyric: {
    getTTM: vi.fn().mockResolvedValue(null),
    getYRC: vi.fn().mockResolvedValue({ lrc: { lyric: "" } })
  }
}));
vi.mock("@/common/store/user", () => ({ userStoreSnapshot: vi.fn() }));
vi.mock("@/common/store/settings", () => ({ settingsStoreSnapshot: vi.fn() }));
vi.mock("@/common/components/display/toast", () => ({ default: {} }));
vi.mock("@/common/netease/services/auth", () => ({ Status: {} }));
const response = japaneseLyricJSON satisfies QQLyricResponse;
const track = {
  id: 42,
  name: "打上花火",
  dt: 218_000,
  artist: ["Daoko", "米津玄師"],
  al: { name: "打上花火" }
} as NeteaseTrack;
const song: QQSong = {
  id: response.lyric.data.songID,
  mid: "",
  title: track.name,
  interval: 218,
  singer: []
};
const loadLyric = (controller = new AbortController()): Promise<NeteaseLyric> =>
  NeteaseServicesLyric.track(track, controller);

beforeEach(() => {
  vi.spyOn(QQMusicLyric, "search").mockResolvedValue([song]);
  vi.mocked(RendererNet.requestFromNode).mockResolvedValue(Response.json(response));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(RendererNet.requestFromNode).mockReset();
});

describe("player QQ lyrics", () => {
  it("returns a display model merging real Japanese QRC and LRC responses", async () => {
    const lyric = await loadLyric();
    expect(lyric).toBeInstanceOf(NeteaseLyric);
    expect(lyric.id).toBe(track.id);
    expect(lyric.tips).toBe("歌词来源：QQ音乐");
    expect(lyric.rmExisted).toBe(true);
    expect(lyric.tlExisted).toBe(true);
    expect(
      lyric.data.filter((line) => line.romanLyric && line.translatedLyric).length
    ).toBeGreaterThan(40);
    expect(lyric.data.some((line) => line.words.length > 1)).toBe(true);
  });

  it("matches sparse translations and romanizations by time instead of array index", async () => {
    vi.spyOn(QQMusicLyric, "get").mockResolvedValue({
      raw: response.lyric.data,
      lyric: {
        type: "qrc",
        text: "[1000,500]one(1000,500)\n[2000,500]two(2000,500)\n[3000,500]three(3000,500)"
      },
      roma: { type: "qrc", text: "[2100,500]second(2100,500)\n[3100,500]third(3100,500)" },
      translation: { type: "lrc", text: "[00:01.10]第一句\n[00:03.10]第三句" }
    });
    const lyric = await loadLyric();
    const lines = lyric.data.filter((line) => !line.isBlank);
    expect(lines.map((line) => [line.translatedLyric, line.romanLyric])).toEqual([
      ["第一句", ""],
      ["", "second"],
      ["第三句", "third"]
    ]);
    expect(lyric.rmExisted).toBe(true);
    expect(lyric.tlExisted).toBe(true);
  });

  it.each([
    { type: "lrc", text: "[00:01.10]罗马字" },
    { type: "qrc", text: "[1100,600]罗(1100,200)马(1300,200)字(1500,200)" }
  ] as const)(
    "merges multiword QRC original/roman lyrics with $type translation",
    async (translation) => {
      vi.spyOn(QQMusicLyric, "get").mockResolvedValue({
        raw: response.lyric.data,
        lyric: { type: "qrc", text: "[1000,600]a(1000,200)b(1200,200)c(1400,200)" },
        roma: { type: "qrc", text: "[1100,600]ro (1100,200)ma (1300,200)ji(1500,200)" },
        translation
      });

      const lyric = await loadLyric();
      const line = lyric.data.find((line) => !line.isBlank)!;
      expect(
        line.words.map(({ word, endTime, startTime }) => ({ word, startTime, endTime }))
      ).toEqual([
        { word: "a", startTime: 1000, endTime: 1200 },
        { word: "b", startTime: 1200, endTime: 1400 },
        { word: "c", startTime: 1400, endTime: 1600 }
      ]);
      expect(line.romanLyric).toBe("ro ma ji");
      expect(line.translatedLyric).toBe("罗马字");
      expect(lyric.rmExisted).toBe(true);
      expect(lyric.tlExisted).toBe(true);
    }
  );

  it("falls back to NetEase when QQ has no usable original lyrics", async () => {
    vi.spyOn(QQMusicLyric, "get").mockResolvedValue({
      raw: response.lyric.data,
      lyric: null,
      roma: null,
      translation: null
    });
    const controller = new AbortController();
    const lyric = await loadLyric(controller);
    expect(lyric).toBeInstanceOf(NeteaseLyric);
    expect(lyric.tips).not.toBe("歌词来源：QQ音乐");
  });

  it("falls back to NetEase when the QQ lyric request fails", async () => {
    vi.spyOn(QQMusicLyric, "get").mockRejectedValue(new Error("QQ unavailable"));
    const lyric = await loadLyric();
    expect(lyric).toBeInstanceOf(NeteaseLyric);
    expect(lyric.tips).not.toBe("歌词来源：QQ音乐");
  });

  it("ignores a QQ song whose title does not match", async () => {
    vi.mocked(QQMusicLyric.search).mockResolvedValue([{ ...song, title: "another song" }]);
    const lyric = await loadLyric();
    expect(lyric).toBeInstanceOf(NeteaseLyric);
    expect(lyric.tips).not.toBe("歌词来源：QQ音乐");
    expect(RendererNet.requestFromNode).not.toHaveBeenCalled();
  });

  it("does not return stale lyrics or start a fallback after cancellation", async () => {
    const controller = new AbortController();
    vi.spyOn(QQMusicLyric, "get").mockImplementation(async () => {
      controller.abort();
      throw new Error("request interrupted");
    });
    await expect(loadLyric(controller)).rejects.toMatchObject({ name: "AbortError" });
  });
});
