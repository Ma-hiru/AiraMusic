import { apiRequest } from "@mahiru/ui/common/netease/api/request";
import NeteaseAPIHome from "@mahiru/ui/common/netease/api/home";
import NeteaseAPILyric from "@mahiru/ui/common/netease/api/lyric";
import NeteaseAPITrack from "@mahiru/ui/common/netease/api/track";
import NeteaseAPIComment from "@mahiru/ui/common/netease/api/comment";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(() => Promise.resolve({}))
}));

vi.mock("@/common/netease/api/request", () => ({
  apiRequest: mocks.apiRequest
}));

describe("agent NetEase API cancellation", () => {
  beforeEach(() => {
    mocks.apiRequest.mockClear();
  });

  it("writes the AbortSignal into object-style axios requests", () => {
    const signal = new AbortController().signal;

    void NeteaseAPITrack.detail([1, 2], signal);

    expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/song/detail",
        signal
      })
    );
  });

  it("writes the AbortSignal into URL-style axios requests", () => {
    const signal = new AbortController().signal;

    void NeteaseAPIHome.toplists(signal);

    expect(vi.mocked(apiRequest)).toHaveBeenCalledWith("/toplist", { signal });
  });

  it("preserves request params while forwarding the AbortSignal", () => {
    const signal = new AbortController().signal;

    void NeteaseAPIComment.get(
      {
        id: 42,
        type: 0,
        pageNo: 1,
        pageSize: 20,
        sortType: 2
      },
      signal
    );

    expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
      "/comment/new",
      expect.objectContaining({
        params: expect.objectContaining({ id: 42, pageNo: 1, pageSize: 20 }),
        signal
      })
    );
  });

  it("forwards the AbortSignal to direct fetch requests", async () => {
    const signal = new AbortController().signal;
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({})
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await NeteaseAPILyric.getYRC(42, signal);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("id=42"),
      expect.objectContaining({ signal })
    );
    vi.unstubAllGlobals();
  });
});
