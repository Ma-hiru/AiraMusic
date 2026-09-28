import { fetchFromNode } from "@mahiru/app/lib/net-fetch";
import type { NetFetchRequest } from "@mahiru/ipc/types";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("node fetch IPC response", () => {
  it("returns cloneable status, headers and bytes instead of a Response instance", async () => {
    const input: NetFetchRequest = {
      input: "https://u.y.qq.com/cgi-bin/musicu.fcg",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: new TextEncoder().encode('{"query":"晴天"}').buffer
      }
    };
    fetchMock.mockResolvedValue(Response.json({ code: 0, lyric: "歌词" }));
    const result = structuredClone(await fetchFromNode(structuredClone(input)));
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toContain("application/json");
    expect(JSON.parse(new TextDecoder().decode(result.body!))).toEqual({ code: 0, lyric: "歌词" });
    expect(fetchMock).toHaveBeenCalledWith(input.input, input.init);
  });

  it("preserves HTTP error bodies", async () => {
    fetchMock.mockResolvedValue(
      new Response("rate limited", { status: 429, statusText: "Too Many Requests" })
    );
    const result = structuredClone(
      await fetchFromNode({ input: "https://y.qq.com", init: { headers: {} } })
    );
    expect(result.status).toBe(429);
    expect(result.statusText).toBe("Too Many Requests");
    expect(new TextDecoder().decode(result.body!)).toBe("rate limited");
  });

  it("preserves null bodies for HEAD/204 responses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const result = await fetchFromNode({ input: "https://y.qq.com", init: { headers: {} } });
    expect(result.body).toBeNull();
    expect(result.status).toBe(204);
  });

  it("propagates network errors without converting them to empty HTTP 500 responses", async () => {
    fetchMock.mockRejectedValue(new Error("connection refused"));
    await expect(
      fetchFromNode({ input: "https://y.qq.com", init: { headers: {} } })
    ).rejects.toThrow("connection refused");
  });
});
