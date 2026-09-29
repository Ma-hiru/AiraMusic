import { vi } from "vitest";
import { parseLrc, parseQrc } from "@applemusic-like-lyrics/lyric";
import { parseNeteaseLyric } from "@mahiru/wasm";
import { RendererNet } from "@mahiru/ui/common/lib/net";
import { QQMusicLyric } from "@mahiru/ui/common/lib/qq-music-lyric";
import { NeteaseLyric, NeteaseLyricSchema } from "@mahiru/ui/common/netease/models/netease-lyric";
import type {
  QQSong,
  QQLyricContent,
  QQLyricResponse,
  QQSearchResponse,
  QQLegacySearchResponse
} from "@mahiru/ui/common/lib/qq-music-lyric/model";

import lyricJSON from "./fixtures/qq-lyric.json";
import legacySearchJSON from "./fixtures/qq-search-legacy.json";
import modernSearchJSON from "./fixtures/qq-search-modern.json";
import japaneseLyricJSON from "./fixtures/qq-lyric-japanese.json";

vi.mock("@/common/lib/net", () => ({
  RendererNet: { requestFromNode: vi.fn() }
}));
// 这个测试验证真实 WASM 解析器，不能使用 setup 中返回空数组的 mock。
vi.unmock("@applemusic-like-lyrics/lyric");

// 2026-09-28 的真实响应；现代接口返回 2001，旧接口成功，歌词为加密 QRC。
const modernResponse = modernSearchJSON satisfies QQSearchResponse;
const legacyResponse = legacySearchJSON satisfies QQLegacySearchResponse;
const lyricResponse = lyricJSON satisfies QQLyricResponse;
const japaneseLyricResponse = japaneseLyricJSON satisfies QQLyricResponse;
const expectedSong: QQSong = {
  id: 97773,
  mid: "0039MnYb0qxYhV",
  title: "晴天",
  interval: 269,
  singer: legacyResponse.data.song.list[0]!.singer,
  album: { id: 8220, mid: "000MkMni19ClKG", name: "叶惠美" }
};

afterEach(() => {
  vi.mocked(RendererNet.requestFromNode).mockReset();
});

describe("QQMusicLyric recorded API responses", () => {
  it("normalizes legacy search fields and decrypts the resulting song's QRC", async () => {
    const request = vi.mocked(RendererNet.requestFromNode);
    request
      .mockResolvedValueOnce(Response.json(modernResponse))
      .mockResolvedValueOnce(Response.json(legacyResponse))
      .mockResolvedValueOnce(Response.json(lyricResponse));

    const songs = await QQMusicLyric["search"]("晴天 周杰伦", 1);
    expect(songs).toEqual([expectedSong]);

    const result = await QQMusicLyric.get(songs[0]!);
    expect(result.raw).toEqual(lyricResponse.lyric.data);
    expect(result.raw.track.singer).toBeNull();
    expect(result.lyric?.text).toContain("<QrcInfos>");
    expect(result.lyric?.text).toContain('<Lyric_1 LyricType="1"');
    expect(result.translation).toBeNull();
    expect(result.roma).toBeNull();

    const body: unknown = JSON.parse(String(request.mock.calls[2]?.[1]?.body));
    expect(body).toMatchObject({
      lyric: { param: { songID: expectedSong.id, songMID: expectedSong.mid } }
    });
  });

  it("rejects a lyric response without data", async () => {
    vi.mocked(RendererNet.requestFromNode).mockResolvedValue(
      Response.json({ code: 0, lyric: { code: 0 } } satisfies QQLyricResponse)
    );
    await expect(QQMusicLyric.get(expectedSong)).rejects.toThrow("GetPlayLyricInfo failed");
  });

  it("parses decrypted QQ lyrics with the real AMLL parseQrc", async () => {
    vi.mocked(RendererNet.requestFromNode).mockResolvedValue(Response.json(lyricResponse));
    const result = await QQMusicLyric.get(expectedSong);
    expect(result.lyric?.type).toBe("qrc");
    const lines = parseContent(result.lyric);
    console.info("[QQMusicLyric parseQrc]", JSON.stringify(lines, null, 2));
    expect(lines).toHaveLength(63);
    const words = lines.flatMap((line) => line.words);
    expect(words).toHaveLength(602);
    expect(words[0]).toMatchObject({ word: "晴", startTime: 0, endTime: 160 });
    expect(lines.at(-1)).toMatchObject({ startTime: 262863, endTime: 265846 });
    expect(words.every((word) => Number.isFinite(word.startTime))).toBe(true);
    expect(words.every((word) => word.endTime > word.startTime)).toBe(true);
    expect(words.some((word) => /[<>]/.test(word.word))).toBe(false);
  });

  it("rejects legacy search errors instead of treating them as empty results", async () => {
    vi.mocked(RendererNet.requestFromNode).mockResolvedValue(
      Response.json({ code: 1000, message: "search failed" } satisfies QQLegacySearchResponse)
    );
    await expect(QQMusicLyric["search_fallback"]("晴天")).rejects.toThrow(
      "QQ fallback search failed"
    );
  });

  it("labels Japanese original/roman lyrics as QRC and translation as LRC", async () => {
    vi.mocked(RendererNet.requestFromNode).mockResolvedValue(Response.json(japaneseLyricResponse));
    const result = await QQMusicLyric.get({
      id: japaneseLyricResponse.lyric.data.songID,
      mid: "",
      title: "打上花火",
      singer: []
    });
    expect(result.lyric?.type).toBe("qrc");
    expect(result.roma?.type).toBe("qrc");
    expect(result.translation?.type).toBe("lrc");
    for (const key of ["lyric", "roma", "translation"] as const) {
      const content = result[key];
      const lines = parseContent(content);
      console.info(`[QQMusicLyric Japanese ${key}]`, content?.type, JSON.stringify(lines, null, 2));
      expect(lines).toHaveLength(57);
    }
  });

  it("keeps the existing lyric output while adding timed roman words through WASM and schema", async () => {
    vi.mocked(RendererNet.requestFromNode).mockResolvedValue(Response.json(japaneseLyricResponse));
    const result = await QQMusicLyric.get({
      id: japaneseLyricResponse.lyric.data.songID,
      mid: "",
      title: "打上花火",
      singer: []
    });
    const raw = parseContent(result.lyric);
    const trans = parseContent(result.translation);
    const roman = parseContent(result.roma);
    const model = NeteaseLyricSchema.parse(parseNeteaseLyric(raw, trans, roman));
    // 同一份音译退化为逐行数据，作为原有输出的对照。
    const lineOnly = roman.map((line) => ({
      ...line,
      words: [
        {
          startTime: line.startTime,
          endTime: line.endTime,
          word: line.words.map((word) => word.word).join(""),
          romanWord: ""
        }
      ]
    }));
    const baseline = NeteaseLyricSchema.parse(parseNeteaseLyric(raw, trans, lineOnly));
    const withoutWordRoman = (lyric: NeteaseLyricModel) => ({
      ...lyric,
      data: lyric.data.map((line) => ({
        ...line,
        words: line.words.map((word) => ({ ...word, romanWord: undefined }))
      }))
    });
    expect(withoutWordRoman(model)).toEqual(withoutWordRoman(baseline));
    expect(
      model.data.flatMap((line) => line.words).filter((word) => word.romanWord?.trim())
    ).toHaveLength(405);
    const first = model.data.find((line) => line.startTime === 19953)!;
    expect(first.words.find((word) => word.word === "渚")?.romanWord).toBe("na gi sa");
    expect(first.words.find((word) => word.word === "渡")?.romanWord).toBe("wa ta");
    const lyric = new NeteaseLyric(model);
    expect(lyric.canShowNotes).toBe(true);
    expect(lyric.priority).toBe(new NeteaseLyric(baseline).priority);
  });

  it.each([
    { text: "[0,500]test(0,500)", type: "qrc" },
    { text: "[00:01.20]test", type: "lrc" },
    { text: "[00:01]test", type: "unknown" },
    { text: "[00:01:200]test", type: "lrc" },
    { text: "untimed lyrics", type: "unknown" },
    { text: "DEADBEEF", type: "unknown" }
  ] as const)("detects $type from each field's content: $text", async ({ text, type }) => {
    vi.mocked(RendererNet.requestFromNode).mockResolvedValue(
      Response.json({
        ...lyricResponse,
        lyric: {
          code: 0,
          data: { ...lyricResponse.lyric.data, lyric: text, roma: text, trans: text }
        }
      } satisfies QQLyricResponse)
    );
    const result = await QQMusicLyric.get(expectedSong);
    for (const content of [result.lyric, result.roma, result.translation]) {
      expect(content).toEqual({ type, text });
      if (type === "qrc" || type === "lrc") expect(parseContent(content)).toHaveLength(1);
    }
  });

  it("returns null for missing or whitespace-only lyrics", async () => {
    vi.mocked(RendererNet.requestFromNode).mockResolvedValue(
      Response.json({
        ...lyricResponse,
        lyric: {
          code: 0,
          data: { ...lyricResponse.lyric.data, lyric: "", roma: "  \n", trans: "\t" }
        }
      } satisfies QQLyricResponse)
    );
    const result = await QQMusicLyric.get(expectedSong);
    expect(result).toMatchObject({ lyric: null, roma: null, translation: null });
  });
});

// QQ_MUSIC_LIVE=1 yarn workspace @mahiru/ui test tests/lyric/qq-music-lyric.test.ts --disableConsoleIntercept
describe.runIf(process.env["QQ_MUSIC_LIVE"] === "1")("QQMusicLyric live API", () => {
  it("prints actual search/lyric JSON and decoded lyrics", async () => {
    vi.mocked(RendererNet.requestFromNode).mockImplementation(async (input, init) => {
      const response = await fetch(input, { ...init, signal: AbortSignal.timeout(20_000) });
      console.info("[QQMusicLyric HTTP]", String(input), response.status);
      console.info("[QQMusicLyric JSON]", await response.clone().text());
      return response;
    });

    const songs = await QQMusicLyric["search"]("晴天 周杰伦", 1);
    console.info("[QQMusicLyric songs]", JSON.stringify(songs, null, 2));
    expect(songs.length).toBeGreaterThan(0);
    const song = songs[0]!;
    expect(song.id).toEqual(expect.any(Number));
    expect(song.mid).toEqual(expect.any(String));
    const result = await QQMusicLyric.get(song);
    console.info("[QQMusicLyric result]", JSON.stringify(result, null, 2));
    expect(result.lyric?.text).toContain("<QrcInfos>");
    expect(result.translation).toBeNull();
    expect(result.roma).toBeNull();
    expect(result.lyric?.type).toBe("qrc");
    const lines = parseContent(result.lyric);
    console.info("[QQMusicLyric live parseQrc]", JSON.stringify(lines, null, 2));
    expect(lines.length).toBeGreaterThan(0);
  }, 65_000);
});

function parseContent(content: null | QQLyricContent) {
  if (content?.type === "qrc") return parseQrc(content.text);
  if (content?.type === "lrc") return parseLrc(content.text);
  return [];
}
