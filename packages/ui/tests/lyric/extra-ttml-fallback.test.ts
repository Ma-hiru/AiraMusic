import { it, vi, expect, describe, beforeEach } from "vitest";
import { NeteaseLyric } from "@mahiru/ui/common/netease/models/netease-lyric";

import { setTTMLMock } from "../mock/amll-lyric";

vi.mock("@applemusic-like-lyrics/ttml", async () => await import("../mock/amll-ttml"));
vi.unmock("@applemusic-like-lyrics/lyric");

const mocks = vi.hoisted(() => ({
  getTTML: vi.fn(),
  getTTMLByLocal: vi.fn(),
  getYRC: vi.fn(),
  getQRC: vi.fn(),
  getOne: vi.fn(),
  hasLocalTTML: vi.fn(),
  setOne: vi.fn(),
  useExtraTTML: false
}));

vi.mock("@/common/lib/apple-music-lyric", () => ({
  AppleMusicLyric: {
    getTTML: mocks.getTTML,
    getTTMLByLocal: mocks.getTTMLByLocal,
    hasLocalTTML: mocks.hasLocalTTML
  }
}));
vi.mock("@/common/netease/api", () => ({
  NeteaseAPILyric: { getYRC: mocks.getYRC }
}));
vi.mock("@/common/lib/qq-music-lyric", () => ({
  QQMusicLyric: { getQRC: mocks.getQRC }
}));
vi.mock("@/common/lib/cache", () => ({
  RendererCache: { service: { object: { getOne: mocks.getOne, setOne: mocks.setOne } } }
}));
vi.mock("@/common/store/settings", () => ({
  settingsStoreSnapshot: () => ({
    _settings: { preference: { useExtraTTML: mocks.useExtraTTML } }
  })
}));

const { default: lyricService } = await import("@mahiru/ui/common/netease/services/lyric");

const CACHE_PREFIX = "netease_lyric_v28";
const TTML = `<tt xmlns="http://www.w3.org/ns/ttml" itunes:timing="Line" xmlns:itunes="http://music.apple.com/lyric-ttml-internal"><head><metadata/></head><body dur="10s"><div begin="1.000" end="9.000"><p begin="1.000" end="9.000" itunes:key="L1"><span begin="1.000" end="2.000">补</span><span begin="2.000" end="3.000">充</span></p></div></body></tt>`;

describe("歌词来源回退链", () => {
  beforeEach(() => {
    mocks.getTTML.mockReset().mockResolvedValue(null);
    mocks.getTTMLByLocal.mockReset().mockResolvedValue(TTML);
    mocks.getYRC.mockReset().mockResolvedValue({ lrc: { lyric: "" } });
    mocks.getQRC.mockReset().mockResolvedValue(null);
    mocks.getOne.mockReset().mockResolvedValue(null);
    mocks.hasLocalTTML.mockReset().mockReturnValue(false);
    mocks.setOne.mockReset();
    mocks.useExtraTTML = false;
    setTTMLMock({
      lines: [
        {
          words: [{ word: "补", startTime: 1000, endTime: 2000, romanWord: "" }],
          translatedLyric: "",
          romanLyric: "",
          isBG: false,
          isDuet: false,
          startTime: 1000,
          endTime: 2000
        }
      ],
      metadata: []
    });
  });

  it("开关关闭时不会请求补充库", async () => {
    await lyricService.id(1001);
    expect(mocks.getTTML).toHaveBeenCalledTimes(1);
    expect(mocks.getTTMLByLocal).not.toHaveBeenCalled();
  });

  it("开关打开且内置库没有时，回退到补充库", async () => {
    mocks.useExtraTTML = true;
    await lyricService.id(1002);
    expect(mocks.getTTML).toHaveBeenCalledTimes(1);
    expect(mocks.getTTMLByLocal).toHaveBeenCalledTimes(1);
  });

  it("补充库有该曲但还没缓存时，不复用常规缓存", async () => {
    mocks.useExtraTTML = true;
    mocks.hasLocalTTML.mockReturnValue(true);
    // _0 有旧缓存，_1 为空
    mocks.getOne.mockImplementation(async (key: string) =>
      key.endsWith("_0")
        ? {
            data: [
              {
                words: [{ word: "旧", startTime: 0, endTime: 1000, romanWord: "" }],
                translatedLyric: "",
                romanLyric: "",
                startTime: 0,
                endTime: 1000
              }
            ]
          }
        : null
    );

    await lyricService.id(1004);
    expect(mocks.getTTMLByLocal).toHaveBeenCalledTimes(1);
  });

  it("内置库命中时不再请求补充库", async () => {
    mocks.useExtraTTML = true;
    mocks.getTTML.mockResolvedValue(TTML);
    await lyricService.id(1003);
    expect(mocks.getTTMLByLocal).not.toHaveBeenCalled();
  });

  it.each(["YRC", "QRC"])("普通 localTTML 不能覆盖逐字 %s", async (source) => {
    mocks.useExtraTTML = true;
    if (source === "YRC")
      mocks.getYRC.mockResolvedValue({ yrc: { lyric: "[1000,1000](1000,500,0)逐(1500,500,0)字" } });
    else mocks.getQRC.mockResolvedValue(timedLyric());
    const result = await lyricService.id(2001);
    expect(result.hasWordTiming()).toBe(true);
    expect(
      result.data
        .flatMap((line) => line.words)
        .map((word) => word.word)
        .join("")
    ).toBe("逐字");
    expect(mocks.setOne).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringMatching(/_2001_1$/), data: result })
    );
  });

  it("QRC/YRC 均无逐字效果时可以选用普通 localTTML", async () => {
    mocks.useExtraTTML = true;
    mocks.getYRC.mockResolvedValue({ lrc: { lyric: "[00:01.00]逐行歌词" } });
    const result = await lyricService.id(2002);
    expect(result.data[0]?.words[0]?.word).toBe("补");
  });

  it.each(["external", "duet", "word", "overlap"])(
    "%s TTML 与外部 TTML 同级优先",
    async (effect) => {
      mocks.useExtraTTML = true;
      if (effect === "external") mocks.getTTML.mockResolvedValue(TTML);
      const base = {
        words: [{ word: "补", startTime: 1000, endTime: 2000, romanWord: "" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: effect === "duet",
        startTime: 1000,
        endTime: 2000
      };
      setTTMLMock({
        lines: [
          {
            ...base,
            ...(effect === "word"
              ? {
                  words: [
                    { word: "补", startTime: 1000, endTime: 1500, romanWord: "" },
                    { word: "充", startTime: 1500, endTime: 2000, romanWord: "" }
                  ]
                }
              : {})
          },
          ...(effect === "overlap"
            ? [
                {
                  ...base,
                  startTime: 1500,
                  endTime: 2500,
                  words: [{ word: "和", startTime: 1500, endTime: 2500, romanWord: "" }]
                }
              ]
            : [])
        ],
        metadata: []
      });
      mocks.getQRC.mockResolvedValue(timedLyric());
      const result = await lyricService.id(2003);
      expect(result.data[0]?.words[0]?.word).toBe("补");
    }
  );

  it("来源全部失败时不缓存错误占位歌词", async () => {
    mocks.getTTML.mockRejectedValue(new Error("offline"));
    mocks.getYRC.mockRejectedValue(new Error("offline"));
    mocks.getQRC.mockRejectedValue(new Error("offline"));
    await lyricService.id(2004);
    expect(mocks.setOne).not.toHaveBeenCalled();
  });

  it("关闭开关时只读常规缓存，不受补充缓存影响", async () => {
    const cache = useMemoryCache();
    cache.set(`${CACHE_PREFIX}_3001_0`, cachedLyric("常规"));
    cache.set(`${CACHE_PREFIX}_3001_1`, cachedLyric("补充"));
    const result = await lyricService.id(3001);
    expect(result.data[0]?.words[0]?.word).toBe("常规");
    expect(mocks.getOne.mock.calls.map(([key]) => key)).toEqual([`${CACHE_PREFIX}_3001_0`]);
    expect(mocks.getTTML).not.toHaveBeenCalled();
  });

  it("打开开关但没有 localTTML 时，缺少补充缓存会继续读常规缓存", async () => {
    const cache = useMemoryCache();
    mocks.useExtraTTML = true;
    cache.set(`${CACHE_PREFIX}_3002_0`, cachedLyric("常规"));
    const result = await lyricService.id(3002);
    expect(result.data[0]?.words[0]?.word).toBe("常规");
    expect(mocks.getOne.mock.calls.map(([key]) => key)).toEqual([
      `${CACHE_PREFIX}_3002_1`,
      `${CACHE_PREFIX}_3002_0`
    ]);
    expect(mocks.getTTML).not.toHaveBeenCalled();
  });

  it("打开开关且两份缓存均为空、没有 localTTML 时，缓存兜底并供下次复用", async () => {
    useMemoryCache();
    mocks.useExtraTTML = true;
    mocks.getTTMLByLocal.mockResolvedValue(null);
    mocks.getYRC.mockResolvedValue({ lrc: { lyric: "[00:01.00]兜底歌词" } });
    const first = await lyricService.id(3003);
    const second = await lyricService.id(3003);
    expect(first.data[0]?.words[0]?.word).toBe("兜底歌词");
    expect(second.data).toEqual(first.data);
    expect(mocks.getTTMLByLocal).toHaveBeenCalledOnce();
    expect(mocks.getYRC).toHaveBeenCalledOnce();
    expect(mocks.setOne).toHaveBeenCalledExactlyOnceWith({
      id: `${CACHE_PREFIX}_3003_0`,
      data: first
    });
  });

  it("索引有 localTTML 但实际缺失时，确认缺失后复用常规兜底缓存", async () => {
    useMemoryCache();
    mocks.useExtraTTML = true;
    mocks.hasLocalTTML.mockReturnValue(true);
    mocks.getTTMLByLocal.mockImplementation(async () => {
      // 模拟 AppleMusicLyric 收到 404 后更新缺失集合。
      mocks.hasLocalTTML.mockReturnValue(false);
      return null;
    });
    mocks.getQRC.mockResolvedValue(timedLyric());
    const first = await lyricService.id(3004);
    const second = await lyricService.id(3004);
    expect(second.data).toEqual(first.data);
    expect(mocks.getTTMLByLocal).toHaveBeenCalledOnce();
    expect(mocks.getQRC).toHaveBeenCalledOnce();
  });

  it("普通 localTTML 让位于逐字歌词后，不会每次都因缺少补充缓存重新请求", async () => {
    useMemoryCache();
    mocks.useExtraTTML = true;
    mocks.hasLocalTTML.mockReturnValue(true);
    mocks.getQRC.mockResolvedValue(timedLyric());
    const first = await lyricService.id(3005);
    const second = await lyricService.id(3005);
    expect(first.hasWordTiming()).toBe(true);
    expect(second.data).toEqual(first.data);
    expect(mocks.getTTMLByLocal).toHaveBeenCalledOnce();
    expect(mocks.getQRC).toHaveBeenCalledOnce();
    expect(mocks.setOne).toHaveBeenCalledExactlyOnceWith({
      id: `${CACHE_PREFIX}_3005_1`,
      data: first
    });
  });

  it("关闭、打开、再关闭和再打开时，分别复用正确结果", async () => {
    useMemoryCache();
    mocks.hasLocalTTML.mockReturnValue(true);
    mocks.getQRC.mockResolvedValue(timedLyric());
    setTTMLMock({
      lines: [
        {
          words: [{ word: "对唱", startTime: 1000, endTime: 2000, romanWord: "" }],
          translatedLyric: "",
          romanLyric: "",
          isBG: false,
          isDuet: true,
          startTime: 1000,
          endTime: 2000
        }
      ],
      metadata: []
    });
    const normal = await lyricService.id(3006);
    mocks.useExtraTTML = true;
    const special = await lyricService.id(3006);
    mocks.useExtraTTML = false;
    const closed = await lyricService.id(3006);
    mocks.useExtraTTML = true;
    const reopened = await lyricService.id(3006);
    expect(special.data[0]?.words[0]?.word).toBe("对唱");
    expect(closed.data).toEqual(normal.data);
    expect(reopened.data).toEqual(special.data);
    expect(mocks.getTTML).toHaveBeenCalledTimes(2);
    expect(mocks.getTTMLByLocal).toHaveBeenCalledOnce();
  });
});

function useMemoryCache() {
  const cache = new Map<string, NeteaseLyricModel>();
  mocks.getOne.mockImplementation(async (key: string) => cache.get(key) ?? null);
  mocks.setOne.mockImplementation(async ({ id, data }: { id: string; data: NeteaseLyricModel }) => {
    cache.set(id, data);
  });
  return cache;
}

function cachedLyric(word: string) {
  return new NeteaseLyric({
    data: [
      {
        startTime: 1000,
        endTime: 2000,
        translatedLyric: "",
        romanLyric: "",
        words: [{ word, startTime: 1000, endTime: 2000 }]
      }
    ]
  });
}

function timedLyric() {
  return new NeteaseLyric({
    data: [
      {
        startTime: 1000,
        endTime: 2000,
        translatedLyric: "",
        romanLyric: "",
        words: [
          { word: "逐", startTime: 1000, endTime: 1500 },
          { word: "字", startTime: 1500, endTime: 2000 }
        ]
      }
    ]
  });
}
