import { it, vi, expect, describe, beforeEach } from "vitest";
import { AppleMusicLyric } from "@mahiru/ui/common/lib/apple-music-lyric";
import { TTMLExtraDatabase } from "@mahiru/ui/common/lib/apple-music-lyric/ttml-extra-db";

vi.mock("@/common/lib/idle", () => ({
  RendererIdle: { normal: vi.fn() }
}));

vi.mock("@/common/lib/cache", () => ({
  RendererCache: {
    service: { object: { getOne: vi.fn(), setOne: vi.fn().mockResolvedValue(undefined) } }
  }
}));

const asTextResponse = (body: string, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, text: async () => body }) as Response;

// 与真实 index.jsonl 同构：id + metadata 二元组数组
const INDEX = [
  JSON.stringify({ id: "123", metadata: [["musicName", ["测试"]]] }),
  JSON.stringify({ id: "789", metadata: [] })
].join("\n");

const isTtmlRequest = (url: unknown) =>
  String(url).includes("/ncm-lyrics/") && !String(url).endsWith("index.jsonl");
const ttmlCalls = (mock: { mock: { calls: unknown[][] } }) =>
  mock.mock.calls.map((call) => String(call[0])).filter(isTtmlRequest);

describe("AppleMusicLyric.getTTMLByLocal", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    // 清掉跨用例的负缓存与索引缓存
    Reflect.set(AppleMusicLyric, "extraTtmlMissing", new Set<number>());
    TTMLExtraDatabase.reset();
  });

  it("索引加载后 has() 给出确定结论", async () => {
    const fetchMock = vi.fn(async () => asTextResponse(INDEX));
    vi.stubGlobal("fetch", fetchMock);

    expect(TTMLExtraDatabase.has(123)).toBeUndefined();
    await TTMLExtraDatabase.load();
    expect(TTMLExtraDatabase.has(123)).toBe(true);
    expect(TTMLExtraDatabase.has(456)).toBe(false);
  });

  it("hasLocalTTML 反映索引结论", async () => {
    const fetchMock = vi.fn(async () => asTextResponse(INDEX));
    vi.stubGlobal("fetch", fetchMock);

    await TTMLExtraDatabase.load();
    expect(AppleMusicLyric.hasLocalTTML(123)).toBe(true);
    expect(AppleMusicLyric.hasLocalTTML(456)).toBe(false);
  });

  it("索引命中时从自建 ttml 分支取文件", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).endsWith("index.jsonl") ? asTextResponse(INDEX) : asTextResponse("<tt>local</tt>")
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(AppleMusicLyric.getTTMLByLocal(123)).resolves.toBe("<tt>local</tt>");
    const urls = ttmlCalls(fetchMock);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("raw.githubusercontent.com/Ma-hiru/AiraMusic");
    expect(urls[0]).toContain("/ttml/ttml/ncm-lyrics/123.ttml");
  });

  it("索引里没有该曲目时直接返回 null，不发单曲请求", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).endsWith("index.jsonl") ? asTextResponse(INDEX) : asTextResponse("Not Found", 404)
    );
    vi.stubGlobal("fetch", fetchMock);

    // 先让索引加载完成
    await AppleMusicLyric.getTTMLByLocal(123);
    const before = ttmlCalls(fetchMock).length;

    await expect(AppleMusicLyric.getTTMLByLocal(456)).resolves.toBeNull();
    expect(ttmlCalls(fetchMock)).toHaveLength(before);
  });

  it("索引不可用时退化为逐首试探，404 记入负缓存", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).endsWith("index.jsonl")
        ? asTextResponse("", 500)
        : asTextResponse("Not Found", 404)
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(AppleMusicLyric.getTTMLByLocal(456)).resolves.toBeNull();
    const after404 = ttmlCalls(fetchMock).length;
    expect(after404).toBeGreaterThan(0);

    await expect(AppleMusicLyric.getTTMLByLocal(456)).resolves.toBeNull();
    expect(ttmlCalls(fetchMock)).toHaveLength(after404);
  });

  it("网络异常时返回 null 而不是抛出", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(AppleMusicLyric.getTTMLByLocal(789)).resolves.toBeNull();
  });
});
