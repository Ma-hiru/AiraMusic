import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { it, vi, expect, describe, afterEach, beforeEach } from "vitest";
import {
  TTMLDatabase,
  TTMLIndexEntrySchema
} from "@mahiru/ui/common/lib/apple-music-lyric/ttml-db";

const mocks = vi.hoisted(() => ({ getOne: vi.fn(), setOne: vi.fn() }));

vi.mock("@/common/lib/cache", () => ({
  RendererCache: { service: { object: { getOne: mocks.getOne, setOne: mocks.setOne } } }
}));

// 真实数据：从 amll-ttml-db 的 ncm-lyrics/index.jsonl 原样摘录
const sampleJSONL = readFileSync(
  resolve(import.meta.dirname, "fixtures/ttml-index-sample.jsonl"),
  "utf8"
);

const SAMPLE_IDS = [
  "1987638572", // 6 字段标准顺序
  "1921983207", // 多值 artists
  "2091667481", // 缺 album，metadata[3] 是作者 GitHub ID
  "1983292457", // 含 appleMusicId / isrc / 多值 ncmMusicId
  "1942064163", // 制作人信息排在 album 之前
  "526464331" // 顶层 id 与 ncmMusicId 首项不同
];

const asTextResponse = (body: string, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, text: async () => body }) as Response;

beforeEach(() => {
  TTMLDatabase.reset();
  mocks.getOne.mockReset();
  mocks.setOne.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TTMLDatabase.parseTTMLIndex", () => {
  it("解析真实索引样本的每一行", () => {
    const entries = TTMLDatabase.parseTTMLIndex(sampleJSONL);

    expect(entries.map((entry) => entry.id)).toEqual(SAMPLE_IDS);
    expect(entries[0]).toEqual({
      id: "1987638572",
      metadata: [
        ["album", ["かくれんぼ"]],
        ["artists", ["RUQOA"]],
        ["musicName", ["かくれんぼ"]],
        ["ncmMusicId", ["1987638572"]],
        ["ttmlAuthorGithub", ["39523898"]],
        ["ttmlAuthorGithubLogin", ["Steve-xmh"]]
      ],
      rawLyricFile: "1689087424000-39523898-47876155.ttml"
    });
  });

  it("metadata 顺序不固定，不能用下标推导歌曲 ID", () => {
    const entries = TTMLDatabase.parseTTMLIndex(sampleJSONL);

    // 缺 album 的条目：下标 3 是 ttmlAuthorGithub，旧实现会把 50747104 当成歌曲 ID
    const noAlbum = entries.find((entry) => entry.id === "2091667481")!;
    expect(noAlbum.metadata[3]).toEqual(["ttmlAuthorGithub", ["50747104"]]);

    // 带 isrc 的条目：下标 3 是 isrc，旧实现会把 ISRC 当成歌曲 ID
    const withISRC = entries.find((entry) => entry.id === "1983292457")!;
    expect(withISRC.metadata[3]).toEqual(["isrc", ["JPP302200613"]]);

    // 制作人信息在前的条目：下标 3 是 album
    const credits = entries.find((entry) => entry.id === "1942064163")!;
    expect(credits.metadata[3]?.[0]).toBe("album");
  });

  it("多值字段保留全部取值", () => {
    const entries = TTMLDatabase.parseTTMLIndex(sampleJSONL);
    const multi = entries.find((entry) => entry.id === "1921983207")!;
    const artists = multi.metadata.find(([key]) => key === "artists");
    expect(artists?.[1]).toEqual(["稲葉曇", "歌愛ユキ"]);
  });

  it("跳过空行与不合法的行，不影响其余数据", () => {
    const jsonl = [
      "",
      "  ",
      "not json",
      '{"id":"abc","metadata":[]}',
      '{"metadata":[]}',
      '{"id":"123","metadata":[["album","不是数组"]]}',
      '{"id":"456","metadata":[["album",["ok"]]],"rawLyricFile":7}',
      '{"id":"789","metadata":[["album",["ok"]]]}',
      sampleJSONL.trim()
    ].join("\n");

    const entries = TTMLDatabase.parseTTMLIndex(jsonl);
    expect(entries.map((entry) => entry.id)).toEqual(["789", ...SAMPLE_IDS]);
  });

  it("空输入返回空数组", () => {
    expect(TTMLDatabase.parseTTMLIndex("")).toEqual([]);
  });
});

describe("TTMLIndexEntrySchema", () => {
  it("接受合法条目并拒绝结构不符的数据", () => {
    expect(TTMLIndexEntrySchema.safeParse({ id: "789", metadata: [] }).success).toBe(true);
    expect(
      TTMLIndexEntrySchema.safeParse({ id: "789", metadata: [], rawLyricFile: "a.ttml" }).success
    ).toBe(true);

    expect(TTMLIndexEntrySchema.safeParse(null).success).toBe(false);
    expect(TTMLIndexEntrySchema.safeParse([]).success).toBe(false);
    expect(TTMLIndexEntrySchema.safeParse({ id: 789, metadata: [] }).success).toBe(false);
    expect(TTMLIndexEntrySchema.safeParse({ id: "78a", metadata: [] }).success).toBe(false);
    expect(TTMLIndexEntrySchema.safeParse({ id: "789", metadata: [["album", [1]]] }).success).toBe(
      false
    );
    expect(
      TTMLIndexEntrySchema.safeParse({ id: "789", metadata: [["album", [], "extra"]] }).success
    ).toBe(false);
    expect(
      TTMLIndexEntrySchema.safeParse({ id: "789", metadata: [], rawLyricFile: null }).success
    ).toBe(false);
  });

  it("校验真实索引样本全部通过，且结果与原始 JSON 一致", () => {
    for (const line of sampleJSONL.trim().split("\n")) {
      const parsed = TTMLIndexEntrySchema.safeParse(JSON.parse(line));
      expect(parsed.success).toBe(true);
      expect(parsed.data).toEqual(JSON.parse(line));
    }
  });
});

describe("TTMLDatabase.collectTTMLIDs", () => {
  it("以顶层 id 作为文件集合，不混入 GitHub ID 或 ISRC", () => {
    const ids = TTMLDatabase.collectTTMLIDs(TTMLDatabase.parseTTMLIndex(sampleJSONL));

    expect(ids.size).toBe(SAMPLE_IDS.length);
    for (const id of SAMPLE_IDS) expect(ids.has(Number(id))).toBe(true);

    // 旧实现按 metadata[3] 取值时会把这些写进白名单
    expect(ids.has(50747104)).toBe(false);
    expect(ids.has(39523898)).toBe(false);
  });
});

describe("TTMLDatabase", () => {
  it("索引未就绪时为未知状态，加载后给出确定结论并写入缓存", async () => {
    const fetchMock = vi.fn().mockResolvedValue(asTextResponse(sampleJSONL));
    vi.stubGlobal("fetch", fetchMock);

    expect(TTMLDatabase.has(1987638572)).toBeUndefined();

    await TTMLDatabase.load();

    expect(TTMLDatabase.has(1987638572)).toBe(true);
    expect(TTMLDatabase.has(50747104)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("ncm-lyrics/index.jsonl");
    expect(mocks.setOne).toHaveBeenCalledWith({
      id: "ttml_index",
      data: SAMPLE_IDS.map(Number)
    });
  });

  it("并发加载只发起一次请求", async () => {
    const fetchMock = vi.fn().mockResolvedValue(asTextResponse(sampleJSONL));
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([TTMLDatabase.load(), TTMLDatabase.load(), TTMLDatabase.load()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(TTMLDatabase.has(1987638572)).toBe(true);
  });

  it("加载失败不抛异常，保持未知状态以便回退到直接探测", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(asTextResponse("", 500)));

    await expect(TTMLDatabase.load()).resolves.toBeUndefined();
    expect(TTMLDatabase.has(1987638572)).toBeUndefined();
  });

  it("空索引按失败处理，不会把全部曲目判成没有歌词", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(asTextResponse("\n\n")));

    await TTMLDatabase.load();
    expect(TTMLDatabase.has(1987638572)).toBeUndefined();
  });

  it("失败后冷却期内不重复下载", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    await TTMLDatabase.load();
    await TTMLDatabase.load();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("有效期内的缓存直接复用，不再下载索引", async () => {
    mocks.getOne.mockResolvedValue(SAMPLE_IDS.map(Number));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await TTMLDatabase.loadCache();

    expect(mocks.getOne).toHaveBeenCalledWith("ttml_index", 24 * 60 * 60 * 1_000);
    expect(TTMLDatabase.has(1987638572)).toBe(true);

    await TTMLDatabase.load();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("缓存过期时不拿旧索引作判断，直接重新下载", async () => {
    // store 侧按 timeLimit 过滤后为空：过期数据不参与白名单
    mocks.getOne.mockResolvedValue(null);
    const fetchMock = vi.fn().mockResolvedValue(asTextResponse(sampleJSONL));
    vi.stubGlobal("fetch", fetchMock);

    await TTMLDatabase.loadCache();

    expect(mocks.getOne).toHaveBeenCalledTimes(1);
    expect(TTMLDatabase.has(1987638572)).toBeUndefined();

    await TTMLDatabase.load();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(TTMLDatabase.has(1987638572)).toBe(true);
  });
});
