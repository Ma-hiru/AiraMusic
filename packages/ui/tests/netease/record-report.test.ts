import RecordAPI from "@mahiru/ui/common/netease/api/record";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/common/netease/api/request", () => ({ apiRequest }));

const requestWeekReport = () => RecordAPI.report("week");
type WeekReportResponse = Awaited<ReturnType<typeof requestWeekReport>>;

beforeEach(() => apiRequest.mockReset());
afterEach(() => vi.restoreAllMocks());

it("requests a historical week and preserves its daily duration distribution", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1794218000000);
  const endTime = 1793980800000;
  const response = {
    code: 200,
    message: "",
    data: {
      type: "week",
      startTime: 1793462400000,
      endTime,
      listenTimeDistributionBlock: {
        playDuration: 3408,
        durationDetails: [
          { period: "2026-11-06", duration: 419 },
          { period: "2026-11-07", duration: 1283 }
        ]
      }
    }
  } as WeekReportResponse;
  apiRequest.mockResolvedValue(response);
  const controller = new AbortController();
  const result = await RecordAPI.report("week", endTime, controller.signal);

  expect(apiRequest).toHaveBeenCalledExactlyOnceWith(
    "/listen/data/report?timestamp=1794218000000",
    { params: { type: "week", endTime }, signal: controller.signal }
  );
  expect(result).toBe(response);
  expect(result.data.listenTimeDistributionBlock.durationDetails).toEqual([
    { period: "2026-11-06", duration: 419 },
    { period: "2026-11-07", duration: 1283 }
  ]);
  expectTypeOf(result).toEqualTypeOf<WeekReportResponse>();
  expectTypeOf(result.data.listenTimeDistributionBlock.playDuration).toEqualTypeOf<number>();
});

it("keeps report calls without an end time or cancellation signal compatible", async () => {
  const response = { code: 200, message: "" };
  apiRequest.mockResolvedValue(response);
  const result = await requestWeekReport();

  expect(apiRequest).toHaveBeenCalledExactlyOnceWith(
    expect.stringContaining("/listen/data/report?timestamp="),
    { params: { type: "week", endTime: undefined }, signal: undefined }
  );
  expect(result).toBe(response);
});

it.each(["month", "year"] as const)("keeps the %s report response contract", async (type) => {
  const response: Awaited<ReturnType<typeof RecordAPI.report>> = { code: 200, message: "" };
  apiRequest.mockResolvedValue(response);
  const controller = new AbortController();
  const result = await RecordAPI.report(type, 1793980800000, controller.signal);

  expect(apiRequest).toHaveBeenCalledExactlyOnceWith(
    expect.stringContaining("/listen/data/report?timestamp="),
    { params: { type, endTime: 1793980800000 }, signal: controller.signal }
  );
  expect(result).toBe(response);
  expectTypeOf(result).toEqualTypeOf<Awaited<ReturnType<typeof RecordAPI.report>>>();
});
