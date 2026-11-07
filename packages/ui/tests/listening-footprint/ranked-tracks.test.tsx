import { act, cleanup, waitFor, renderHook } from "@testing-library/react";
import useRankedTracks from "@mahiru/ui/common/components/page/listening-footprint/use-ranked-tracks";

const mocks = vi.hoisted(() => ({
  user: { userId: 11, isLoggedIn: true } as null | { userId: number; isLoggedIn: boolean },
  songRank: vi.fn(),
  ids: vi.fn()
}));
vi.mock("@/common/store/user", () => ({ useUser: () => mocks.user }));
vi.mock("@/common/netease/api", () => ({ NeteaseAPIRecord: { songRank: mocks.songRank } }));
vi.mock("@/common/netease/services", () => ({ NeteaseServicesTrack: { ids: mocks.ids } }));

const response = (...ids: number[]) => ({
  data: { songItems: ids.map((songId) => ({ songId, playCount: 2 })) }
});
const detail = (id: number) => ({ id, name: `Song ${id}` });
type Props = Parameters<typeof useRankedTracks>[0];
const initialProps: Props = { active: true, period: "week", revision: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { userId: 11, isLoggedIn: true };
  mocks.songRank.mockReset().mockResolvedValue(response(3, 1));
  mocks.ids.mockReset().mockResolvedValue([detail(1), detail(3)]);
});
afterEach(cleanup);

it("gates period requests and hydrates the rank in server order with one detail batch", async () => {
  const { result, rerender } = renderHook((props: Props) => useRankedTracks(props), {
    initialProps: { ...initialProps, active: false }
  });
  expect(mocks.songRank).not.toHaveBeenCalled();
  mocks.user = null;
  rerender({ ...initialProps, active: true });
  expect(mocks.songRank).not.toHaveBeenCalled();
  mocks.user = { userId: 11, isLoggedIn: true };
  rerender({ ...initialProps, active: true, period: "month" });
  await waitFor(() => expect(result.current.tracks).toHaveLength(2));
  expect(mocks.songRank).toHaveBeenCalledWith("month", undefined, expect.any(AbortSignal));
  expect(mocks.ids).toHaveBeenCalledWith([3, 1], 100, 5, mocks.songRank.mock.calls[0]![2]);
  expect(result.current.tracks.map((track) => track.id)).toEqual([3, 1]);
  expect(result.current.tracks.every((track) => track.sourceName === "other")).toBe(true);
});

it("limits the displayed and playable rank to the first twenty entries", async () => {
  const ids = Array.from({ length: 24 }, (_, index) => index + 1);
  mocks.songRank.mockResolvedValue(response(...ids));
  mocks.ids.mockImplementation(async (requested: number[]) => requested.map(detail));
  const { result } = renderHook(() => useRankedTracks(initialProps));
  await waitFor(() => expect(result.current.tracks).toHaveLength(20));
  expect(result.current.tracks.map((track) => track.id)).toEqual(ids.slice(0, 20));
  expect(mocks.ids).toHaveBeenCalledOnce();
});

it("cancels the previous period and ignores its delayed response", async () => {
  let resolveWeek!: (value: ReturnType<typeof response>) => void;
  mocks.songRank.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveWeek = resolve;
      })
  );
  const { result, rerender } = renderHook((props: Props) => useRankedTracks(props), {
    initialProps
  });
  const weekSignal = mocks.songRank.mock.calls[0]![2] as AbortSignal;
  mocks.songRank.mockResolvedValue(response(8));
  mocks.ids.mockResolvedValue([detail(8)]);
  rerender({ ...initialProps, period: "month" });
  expect(weekSignal.aborted).toBe(true);
  expect(result.current.tracks).toEqual([]);
  await waitFor(() => expect(result.current.tracks.map((track) => track.id)).toEqual([8]));
  await act(async () => resolveWeek(response(3, 1)));
  expect(result.current.tracks.map((track) => track.id)).toEqual([8]);
  expect(mocks.ids).toHaveBeenCalledOnce();
});

it("keeps a rank during refresh failure and retries without replacing it with another period", async () => {
  const { result, rerender } = renderHook((props: Props) => useRankedTracks(props), {
    initialProps
  });
  await waitFor(() => expect(result.current.tracks).toHaveLength(2));
  const previous = result.current.tracks;
  mocks.songRank.mockRejectedValueOnce(new Error("temporary"));
  rerender({ ...initialProps, revision: 1 });
  expect(result.current.tracks).toBe(previous);
  await waitFor(() => expect(result.current.failed).toBe(true));
  expect(result.current.tracks).toBe(previous);
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.failed).toBe(false));
  expect(mocks.songRank).toHaveBeenCalledTimes(3);
});

it("handles empty ranks and partially missing song details", async () => {
  mocks.ids.mockResolvedValue([detail(3)]);
  const { result, rerender } = renderHook((props: Props) => useRankedTracks(props), {
    initialProps
  });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.tracks.map((track) => track.id)).toEqual([3]);
  expect(result.current.failed).toBe(true);
  mocks.songRank.mockResolvedValue(response());
  rerender({ ...initialProps, period: "month" });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.tracks).toEqual([]);
  expect(result.current.failed).toBe(false);
  expect(mocks.ids).toHaveBeenCalledOnce();
});

it("clears ranks when accounts change or logout and cleans up pending hydration", async () => {
  let resolveOld!: (value: ReturnType<typeof detail>[]) => void;
  mocks.ids.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      })
  );
  const { result, unmount, rerender } = renderHook((props: Props) => useRankedTracks(props), {
    initialProps
  });
  await waitFor(() => expect(mocks.ids).toHaveBeenCalledOnce());
  const oldSignal = mocks.songRank.mock.calls[0]![2] as AbortSignal;
  mocks.user = { userId: 22, isLoggedIn: true };
  mocks.songRank.mockResolvedValue(response(9));
  mocks.ids.mockResolvedValue([detail(9)]);
  rerender({ ...initialProps, revision: 1 });
  expect(oldSignal.aborted).toBe(true);
  expect(result.current.tracks).toEqual([]);
  await waitFor(() => expect(result.current.tracks.map((track) => track.id)).toEqual([9]));
  await act(async () => resolveOld([detail(3), detail(1)]));
  expect(result.current.tracks.map((track) => track.id)).toEqual([9]);
  mocks.user = null;
  rerender({ ...initialProps, revision: 2 });
  expect(result.current.tracks).toEqual([]);
  expect(result.current.loading).toBe(false);
  unmount();
  expect((mocks.songRank.mock.calls.at(-1)![2] as AbortSignal).aborted).toBe(true);
});
