import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { it, vi, expect, describe, afterEach, beforeEach } from "vitest";
import { AppleMusicLyric } from "@mahiru/ui/common/lib/apple-music-lyric";
import { TTMLDatabase } from "@mahiru/ui/common/lib/apple-music-lyric/ttml-db";

const mocks = vi.hoisted(() => ({ getOne: vi.fn(), setOne: vi.fn() }));

vi.mock("@/common/lib/cache", () => ({
  RendererCache: { service: { object: { getOne: mocks.getOne, setOne: mocks.setOne } } }
}));

const sampleJSONL = readFileSync(
  resolve(import.meta.dirname, "fixtures/ttml-index-sample.jsonl"),
  "utf8"
);

const TTML_TEXT =
  '<?xml version="1.0" encoding="UTF-8"?><tt xmlns="http://www.w3.org/ns/ttml"></tt>';

const asTextResponse = (body: string, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, text: async () => body }) as Response;

const stubFetch = (handler: (url: string) => Response | Promise<Response>) => {
  const fetchMock = vi.fn(async (input: URL | RequestInfo) => handler(String(input)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const ttmlCalls = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.endsWith(".ttml") && !url.endsWith("index.jsonl"));

beforeEach(() => {
  TTMLDatabase.reset();
  mocks.getOne.mockReset();
  mocks.setOne.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppleMusicLyric.getTTM", () => {
  it("索引命中后按 `<id>.ttml` 拉取歌词", async () => {
    const fetchMock = stubFetch((url) => {
      if (url.includes("ncm-lyrics/index.jsonl")) return asTextResponse(sampleJSONL);
      if (url.endsWith("/ncm-lyrics/1987638572.ttml")) return asTextResponse(TTML_TEXT);
      return asTextResponse("", 404);
    });

    await TTMLDatabase.load();

    await expect(AppleMusicLyric.getTTM(1987638572)).resolves.toBe(TTML_TEXT);
    expect(ttmlCalls(fetchMock)).toEqual([
      "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main/ncm-lyrics/1987638572.ttml"
    ]);
  });

  it("索引确认没有歌词时不发请求，直接回退", async () => {
    const fetchMock = stubFetch((url) => {
      if (url.includes("ncm-lyrics/index.jsonl")) return asTextResponse(sampleJSONL);
      return asTextResponse("", 404);
    });

    await TTMLDatabase.load();

    // 50747104 只出现在 metadata 里，是作者 GitHub ID，不是歌曲
    await expect(AppleMusicLyric.getTTM(50747104)).resolves.toBeNull();
    expect(ttmlCalls(fetchMock)).toHaveLength(0);
  });

  it("404 记入负缓存，同一首歌不重复请求", async () => {
    const fetchMock = stubFetch((url) => {
      if (url.includes("ncm-lyrics/index.jsonl")) return asTextResponse(sampleJSONL);
      return asTextResponse("", 404);
    });

    await TTMLDatabase.load();

    await expect(AppleMusicLyric.getTTM(1921983207)).resolves.toBeNull();
    await expect(AppleMusicLyric.getTTM(1921983207)).resolves.toBeNull();

    expect(ttmlCalls(fetchMock)).toHaveLength(1);
  });

  it("索引尚未就绪时回退为直接探测，不被索引下载阻塞", async () => {
    const fetchMock = stubFetch((url) => {
      // 索引请求永不返回，模拟慢网络
      if (url.includes("ncm-lyrics/index.jsonl")) return new Promise<Response>(() => {});
      return asTextResponse(TTML_TEXT);
    });

    expect(TTMLDatabase.has(526464331)).toBeUndefined();

    await expect(AppleMusicLyric.getTTM(526464331)).resolves.toBe(TTML_TEXT);
    expect(ttmlCalls(fetchMock)).toHaveLength(1);
  });
});
