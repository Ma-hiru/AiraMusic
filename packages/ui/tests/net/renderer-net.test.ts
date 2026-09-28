import { RendererNet } from "@mahiru/ui/common/lib/net";
import { QQMusicLyric } from "@mahiru/ui/common/lib/qq-music-lyric";
import type { NetFetchRequest, NetFetchResponse } from "@mahiru/ipc/types";

import lyricJSON from "../lyric/fixtures/qq-lyric.json";
import legacySearchJSON from "../lyric/fixtures/qq-search-legacy.json";
import modernSearchJSON from "../lyric/fixtures/qq-search-modern.json";

const { send } = vi.hoisted(() => {
  vi.stubGlobal(
    "PerformanceObserver",
    class {
      observe() {}
    }
  );
  const send =
    vi.fn<(event: string, payload: undefined | NetFetchRequest) => Promise<NetFetchResponse>>();
  // Other UI modules can initialize while this file's IPC mock is installed.
  // Return a rejected promise by default so their `.catch(...)` handlers still work.
  send.mockRejectedValue(new Error("unmocked IPC event"));
  return { send };
});

vi.mock("@mahiru/ipc/renderer", () => ({
  RendererIPC: {
    NormalChannel: { send },
    MessageChannel: {
      listen: vi.fn(() => () => undefined),
      send: vi.fn(),
      remove: vi.fn(),
      commit: vi.fn()
    },
    _init: vi.fn()
  }
}));

afterEach(() => send.mockReset());
afterAll(() => vi.unstubAllGlobals());

function responseData(body: null | string, status = 200): NetFetchResponse {
  return structuredClone({
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "content-type": "application/json" },
    body: body === null ? null : new TextEncoder().encode(body).buffer,
    url: "https://y.qq.com/result",
    redirected: true,
    type: "basic"
  } satisfies NetFetchResponse);
}

describe("RendererNet IPC serialization", () => {
  it("serializes URL, Headers and a POST body, then restores a usable Response", async () => {
    send.mockImplementation(async (_event, payload) => {
      const cloned = structuredClone(payload as NetFetchRequest);
      expect(cloned.input).toBe("https://u.y.qq.com/cgi-bin/musicu.fcg");
      expect(cloned.init.method).toBe("POST");
      expect(cloned.init.headers["referer"]).toBe("https://y.qq.com/");
      expect(new TextDecoder().decode(cloned.init.body)).toBe('{"query":"晴天"}');
      expect(cloned.init).not.toHaveProperty("signal");
      return responseData('{"code":0}');
    });
    const result = await RendererNet.requestFromNode(
      new URL("https://u.y.qq.com/cgi-bin/musicu.fcg"),
      {
        method: "POST",
        headers: new Headers({ Referer: "https://y.qq.com/" }),
        body: '{"query":"晴天"}'
      }
    );
    expect(result).toBeInstanceOf(Response);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.url).toBe("https://y.qq.com/result");
    expect(result.redirected).toBe(true);
    expect(result.headers.get("content-type")).toBe("application/json");
    expect(await result.clone().text()).toBe('{"code":0}');
    expect(await result.json()).toEqual({ code: 0 });
  });

  it("supports Request inputs and empty response bodies", async () => {
    send.mockResolvedValue(responseData(null, 204));
    const result = await RendererNet.requestFromNode(
      new Request("https://y.qq.com/", { method: "HEAD" })
    );
    expect(send.mock.calls[0]?.[1]).toMatchObject({
      input: "https://y.qq.com/",
      init: { method: "HEAD" }
    });
    expect(result.status).toBe(204);
    expect(await result.text()).toBe("");
  });

  it("preserves HTTP failures and error text", async () => {
    send.mockResolvedValue(responseData("rate limited", 429));
    const result = await RendererNet.requestFromNode("https://y.qq.com/");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(429);
    expect(await result.text()).toBe("rate limited");
  });

  it("propagates IPC/network errors", async () => {
    send.mockRejectedValue(new Error("fetch failed"));
    await expect(RendererNet.requestFromNode("https://y.qq.com/")).rejects.toThrow("fetch failed");
  });

  it("searches and decrypts QQ lyrics through the real RendererNet and cloneable IPC payloads", async () => {
    const responses = [modernSearchJSON, legacySearchJSON, lyricJSON];
    send.mockImplementation(async (_event, payload) => {
      // 旧搜索的 URL 也必须先转换为字符串，否则 Electron 不能正确克隆。
      expect(typeof structuredClone(payload as NetFetchRequest).input).toBe("string");
      return responseData(JSON.stringify(responses.shift()));
    });
    const songs = await QQMusicLyric.search("晴天 周杰伦", 1);
    expect(songs[0]).toMatchObject({ id: 97773, mid: "0039MnYb0qxYhV", title: "晴天" });
    const result = await QQMusicLyric.get(songs[0]!);
    expect(result.lyric?.type).toBe("qrc");
    expect(result.lyric?.text).toContain("<QrcInfos>");
    expect(send).toHaveBeenCalledTimes(3);
  });
});
