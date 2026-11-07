import RecordAPI from "@mahiru/ui/common/netease/api/record";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/common/netease/api/request", () => ({ apiRequest }));

beforeEach(() => apiRequest.mockReset());
afterEach(() => vi.restoreAllMocks());

it.each(["week", "month"] as const)(
  "requests the current %s ranking and preserves item-level play counts",
  async (type) => {
    vi.spyOn(Date, "now").mockReturnValue(1793975035868);
    const response: Awaited<ReturnType<typeof RecordAPI.songRank>> = {
      code: 200,
      message: "",
      data: { songItems: [{ songId: 501468000, playCount: 12 }] }
    };
    apiRequest.mockResolvedValue(response);
    const controller = new AbortController();
    const result = await RecordAPI.songRank(type, undefined, controller.signal);

    expect(apiRequest).toHaveBeenCalledExactlyOnceWith(
      "/listen/data/song/play/rank?timestamp=1793975035868",
      { params: { type, endTime: undefined }, signal: controller.signal }
    );
    expect(result).toBe(response);
    expectTypeOf(result.data.songItems[0]!.playCount).toEqualTypeOf<number>();
  }
);

it("forwards a historical report boundary and preserves an empty ranking", async () => {
  const response: Awaited<ReturnType<typeof RecordAPI.songRank>> = {
    code: 200,
    message: "",
    data: { songItems: [] }
  };
  apiRequest.mockResolvedValue(response);
  const controller = new AbortController();
  const endTime = 1748620800000;
  const result = await RecordAPI.songRank("month", endTime, controller.signal);

  expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining("/listen/data/song/play/rank?"), {
    params: { type: "month", endTime },
    signal: controller.signal
  });
  expect(result.data.songItems).toEqual([]);
});
