import { act, cleanup, waitFor, renderHook } from "@testing-library/react";
import { useLikedListening } from "@mahiru/ui/common/hooks/use-liked-listening";
import type { NeteaseAPIUser } from "@mahiru/ui/common/netease/api";
import type { ListeningRange } from "@mahiru/ui/common/hooks/use-liked-listening";

type PlayHistoryResponse = Awaited<ReturnType<typeof NeteaseAPIUser.playHistory>>;

const mocks = vi.hoisted(() => ({ playHistory: vi.fn(), recentSongs: vi.fn() }));

vi.mock("@/common/netease/api", () => ({
  NeteaseAPIUser: { playHistory: mocks.playHistory },
  NeteaseAPIRecord: { recentSongs: mocks.recentSongs }
}));

function response(range: ListeningRange, id: number): PlayHistoryResponse {
  const records: NonNullable<PlayHistoryResponse["weekData"]> = [
    {
      playCount: 20,
      score: 100,
      song: {
        id,
        name: `${range} song`,
        ar: [{ id: id + 100, name: `${range} artist` }],
        al: { id: id + 200, name: `${range} album` }
      }
    }
  ];
  return {
    code: 200,
    ...(range === "week" ? { weekData: records } : { allData: records })
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mocks.playHistory.mockReset().mockResolvedValue(response("week", 1));
  mocks.recentSongs.mockReset().mockResolvedValue({ code: 200, data: { list: [] } });
});
afterEach(cleanup);

it("does not label weekly records as all-time data while loading or after a failed request", async () => {
  const pending = deferred<PlayHistoryResponse>();
  mocks.playHistory.mockResolvedValueOnce(response("week", 1)).mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => useLikedListening(11, true));
  await waitFor(() => expect(result.current.songs[0]?.name).toBe("week song"));

  act(() => result.current.setRange("all"));
  expect(result.current).toMatchObject({ range: "all", loading: true, songs: [], artists: [] });
  expect(mocks.playHistory).toHaveBeenLastCalledWith({ uid: 11, type: 0 }, expect.any(AbortSignal));
  await act(async () => pending.reject(new Error("all-time records unavailable")));
  expect(result.current).toMatchObject({ range: "all", loading: false, songs: [], artists: [] });

  act(() => result.current.setRange("week"));
  expect(result.current.songs[0]?.name).toBe("week song");
  expect(result.current.artists[0]?.name).toBe("week artist");
  expect(mocks.playHistory).toHaveBeenCalledTimes(2);
});

it("does not reuse cached all-time records when retrying a failed weekly request", async () => {
  const pending = deferred<PlayHistoryResponse>();
  mocks.playHistory
    .mockRejectedValueOnce(new Error("weekly records unavailable"))
    .mockResolvedValueOnce(response("all", 2))
    .mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => useLikedListening(11, true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.setRange("all"));
  await waitFor(() => expect(result.current.songs[0]?.name).toBe("all song"));

  act(() => result.current.setRange("week"));
  expect(result.current).toMatchObject({ range: "week", loading: true, songs: [], artists: [] });
  await act(async () => pending.reject(new Error("weekly records still unavailable")));
  expect(result.current).toMatchObject({ range: "week", loading: false, songs: [], artists: [] });
});

it("finishes loading when returning to a cached range and ignores the aborted range response", async () => {
  const pending = deferred<PlayHistoryResponse>();
  mocks.playHistory.mockResolvedValueOnce(response("week", 1)).mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => useLikedListening(11, true));
  await waitFor(() => expect(result.current.songs[0]?.id).toBe(1));

  act(() => result.current.setRange("all"));
  const signal = mocks.playHistory.mock.calls[1]![1] as AbortSignal;
  expect(result.current.loading).toBe(true);
  act(() => result.current.setRange("week"));
  expect(signal.aborted).toBe(true);
  expect(result.current.loading).toBe(false);
  expect(result.current.songs[0]?.id).toBe(1);
  expect(mocks.playHistory).toHaveBeenCalledTimes(2);

  await act(async () => pending.resolve(response("all", 2)));
  expect(result.current).toMatchObject({ range: "week", loading: false });
  expect(result.current.songs[0]?.id).toBe(1);
});
