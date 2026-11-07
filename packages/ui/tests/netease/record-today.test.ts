import RecordAPI from "@mahiru/ui/common/netease/api/record";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/common/netease/api/request", () => ({ apiRequest }));

afterEach(() => vi.restoreAllMocks());

it("returns the today song DTOs unchanged and forwards cancellation", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1793975035868);
  const response: Awaited<ReturnType<typeof RecordAPI.today>> = {
    code: 200,
    message: "",
    data: {
      songDTOs: [
        {
          songId: 501468000,
          songName: "Sacred Play Secret Place",
          aliasName: null,
          picId: 109951163013755200,
          picUrl: "https://example.com/cover.jpg",
          artists: [{ artistId: 12283, artistName: "Matryoshka" }],
          redStar: true,
          lastPlayTime: 1793975001
        }
      ]
    }
  };
  apiRequest.mockResolvedValue(response);
  const controller = new AbortController();
  const result = await RecordAPI.today(controller.signal);

  expectTypeOf(result).toEqualTypeOf<Awaited<ReturnType<typeof RecordAPI.today>>>();
  expect(apiRequest).toHaveBeenCalledExactlyOnceWith(
    "/listen/data/today/song?timestamp=1793975035868",
    { signal: controller.signal }
  );
  expect(result).toBe(response);
});
