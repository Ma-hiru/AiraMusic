import { act, cleanup, waitFor, renderHook } from "@testing-library/react";
import useTodayTracks from "@mahiru/ui/common/components/page/listening-footprint/use-today-tracks";

const mocks = vi.hoisted(() => ({
  user: { userId: 11, isLoggedIn: true } as null | { userId: number; isLoggedIn: boolean },
  today: vi.fn(),
  ids: vi.fn()
}));

vi.mock("@/common/store/user", () => ({ useUser: () => mocks.user }));
vi.mock("@/common/netease/api", () => ({ NeteaseAPIRecord: { today: mocks.today } }));
vi.mock("@/common/netease/services", () => ({ NeteaseServicesTrack: { ids: mocks.ids } }));

const dtoResponse = (...ids: number[]) => ({
  data: { songDTOs: ids.map((songId) => ({ songId })) }
});
const detail = (id: number) => ({ id, name: `Song ${id}` });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { userId: 11, isLoggedIn: true };
  mocks.today.mockReset().mockResolvedValue(dtoResponse(2, 1));
  mocks.ids.mockReset().mockResolvedValue([detail(1), detail(2)]);
});
afterEach(cleanup);

it("loads only an active logged-in today tab and hydrates one batch in DTO order", async () => {
  const { result, rerender } = renderHook(
    (active: boolean) => useTodayTracks({ active, revision: 0 }),
    { initialProps: false }
  );
  expect(mocks.today).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
  mocks.user = null;
  rerender(true);
  expect(mocks.today).not.toHaveBeenCalled();

  mocks.user = { userId: 11, isLoggedIn: true };
  mocks.today.mockResolvedValue(dtoResponse(2, 1, 2));
  rerender(true);
  await waitFor(() => expect(result.current.tracks).toHaveLength(2));
  expect(result.current.tracks.map((track) => track.id)).toEqual([2, 1]);
  expect(
    result.current.tracks.every((track) => track.sourceID === 0 && track.sourceName === "other")
  ).toBe(true);
  expect(mocks.ids).toHaveBeenCalledOnce();
  expect(mocks.ids).toHaveBeenCalledWith([2, 1], 100, 5, mocks.today.mock.calls[0]![0]);
  expect(result.current.failed).toBe(false);
});

it("keeps today's list visible through refresh and a recoverable request failure", async () => {
  const { result, rerender } = renderHook(
    (revision: number) => useTodayTracks({ active: true, revision }),
    { initialProps: 0 }
  );
  await waitFor(() => expect(result.current.tracks).toHaveLength(2));
  const previous = result.current.tracks;
  let rejectRefresh!: (reason: Error) => void;
  mocks.today.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectRefresh = reject;
      })
  );
  rerender(1);
  expect(result.current.tracks).toBe(previous);
  expect(result.current.loading).toBe(true);
  await act(async () => rejectRefresh(new Error("temporary")));
  expect(result.current.tracks).toBe(previous);
  expect(result.current.failed).toBe(true);
  expect(result.current.loading).toBe(false);

  act(() => result.current.reload());
  await waitFor(() => expect(result.current.failed).toBe(false));
  expect(mocks.today).toHaveBeenCalledTimes(3);
});

it("does not hydrate an empty today response", async () => {
  mocks.today.mockResolvedValue(dtoResponse());
  const { result } = renderHook(() => useTodayTracks({ active: true, revision: 0 }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.tracks).toEqual([]);
  expect(result.current.failed).toBe(false);
  expect(mocks.ids).not.toHaveBeenCalled();
});

it("keeps available detailed tracks while reporting a partial hydration failure", async () => {
  mocks.ids.mockResolvedValue([detail(2)]);
  const { result } = renderHook(() => useTodayTracks({ active: true, revision: 0 }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.tracks.map((track) => track.id)).toEqual([2]);
  expect(result.current.failed).toBe(true);
});

it("aborts and ignores an old today request after leaving the tab", async () => {
  let resolveOld!: (value: ReturnType<typeof dtoResponse>) => void;
  mocks.today.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      })
  );
  const { result, unmount, rerender } = renderHook(
    (active: boolean) => useTodayTracks({ active, revision: 0 }),
    { initialProps: true }
  );
  const signal = mocks.today.mock.calls[0]![0] as AbortSignal;
  rerender(false);
  expect(signal.aborted).toBe(true);
  expect(result.current.loading).toBe(false);
  await act(async () => resolveOld(dtoResponse(7)));
  expect(result.current.tracks).toEqual([]);
  expect(mocks.ids).not.toHaveBeenCalled();
  unmount();
});

it("isolates accounts, ignores stale hydration and clears the list after logout", async () => {
  let resolveOld!: (value: ReturnType<typeof detail>[]) => void;
  mocks.ids.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      })
  );
  const { result, rerender } = renderHook(
    (revision: number) => useTodayTracks({ active: true, revision }),
    { initialProps: 0 }
  );
  await waitFor(() => expect(mocks.ids).toHaveBeenCalledOnce());
  const previousSignal = mocks.today.mock.calls[0]![0] as AbortSignal;
  mocks.user = { userId: 22, isLoggedIn: true };
  mocks.today.mockResolvedValue(dtoResponse(9));
  mocks.ids.mockResolvedValue([detail(9)]);
  rerender(1);
  expect(previousSignal.aborted).toBe(true);
  expect(result.current.tracks).toEqual([]);
  await waitFor(() => expect(result.current.tracks.map((track) => track.id)).toEqual([9]));
  await act(async () => resolveOld([detail(1), detail(2)]));
  expect(result.current.tracks.map((track) => track.id)).toEqual([9]);

  mocks.user = null;
  rerender(2);
  expect(result.current.tracks).toEqual([]);
  expect(result.current.loading).toBe(false);
  expect(result.current.failed).toBe(false);
});

it("cleans up the pending request when the modal unmounts", () => {
  mocks.today.mockImplementation(() => new Promise(() => {}));
  const { unmount } = renderHook(() => useTodayTracks({ active: true, revision: 0 }));
  const signal = mocks.today.mock.calls[0]![0] as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
});
