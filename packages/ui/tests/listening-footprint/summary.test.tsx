import { act, cleanup, waitFor, renderHook } from "@testing-library/react";
import {
  useListeningFootprint,
  formatListeningDuration
} from "@mahiru/ui/common/hooks/use-listening-footprint";
import type { NeteaseAPIRecord } from "@mahiru/ui/common/netease/api";

type WeekResponse = Awaited<ReturnType<typeof NeteaseAPIRecord.week>>;
type MonthResponse = Awaited<ReturnType<typeof NeteaseAPIRecord.month>>;

const mocks = vi.hoisted(() => ({
  week: vi.fn(),
  month: vi.fn(),
  user: { userId: 11, isLoggedIn: true } as null | { userId: number; isLoggedIn: boolean }
}));

vi.mock("@/common/netease/api", () => ({
  NeteaseAPIRecord: { week: mocks.week, month: mocks.month }
}));
vi.mock("@/common/store/user", () => ({ useUser: () => mocks.user }));

function weekResponse(total = 283): WeekResponse {
  return {
    data: {
      weekTodayListenBlock: { songCount: 11 },
      listenTimeDistributionBlock: {
        playDuration: total,
        durationDetails: [{ period: "2026-11-06", duration: total }]
      }
    }
  } as WeekResponse;
}

function monthResponse(total = 900): MonthResponse {
  return {
    data: {
      listenTimeDistributionBlock: {
        playDuration: total,
        durationDetails: [{ period: "2026-11-06", duration: total }]
      }
    }
  } as MonthResponse;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mocks.user = { userId: 11, isLoggedIn: true };
  mocks.week.mockReset().mockResolvedValue(weekResponse());
  mocks.month.mockReset().mockResolvedValue(monthResponse());
});
afterEach(cleanup);

it.each([
  [undefined, "—"],
  [null, "—"],
  [NaN, "—"],
  [Infinity, "—"],
  [-Infinity, "—"],
  [-0, "0分钟"],
  [-0.4, "0分钟"],
  [-5, "0分钟"],
  [0, "0分钟"],
  [0.6, "1分钟"],
  [59.5, "1小时"],
  [60, "1小时"],
  [283, "4小时43分"],
  [283.6, "4小时44分"]
])("formats %s minutes as %s", (value, expected) => {
  expect(formatListeningDuration(value)).toBe(expected);
});

it("skips requests while logged out or inactive and keeps zero listening values", async () => {
  mocks.user = null;
  const view = renderHook(({ active }) => useListeningFootprint(0, active), {
    initialProps: { active: true }
  });
  expect(view.result.current).toMatchObject({
    week: null,
    month: null,
    loading: false,
    failed: false,
    loggedIn: false
  });
  expect(mocks.week).not.toHaveBeenCalled();

  mocks.user = { userId: 11, isLoggedIn: true };
  view.rerender({ active: false });
  expect(view.result.current.loading).toBe(false);
  expect(view.result.current.loggedIn).toBe(true);
  expect(mocks.week).not.toHaveBeenCalled();
  expect(mocks.month).not.toHaveBeenCalled();

  mocks.week.mockResolvedValue(weekResponse(0));
  mocks.month.mockResolvedValue(monthResponse(0));
  view.rerender({ active: true });
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  expect(view.result.current.week?.total).toBe(0);
  expect(view.result.current.week?.today?.duration).toBe(0);
  expect(view.result.current.week?.todayTrackCount).toBe(11);
  expect(view.result.current.month?.total).toBe(0);
  expect(view.result.current.failed).toBe(false);
});

it("loads week and month in parallel, preserves partial success, and finishes failed refreshes", async () => {
  const week = deferred<WeekResponse>();
  const month = deferred<MonthResponse>();
  mocks.week.mockReturnValueOnce(week.promise);
  mocks.month.mockReturnValueOnce(month.promise);
  const { result } = renderHook(() => useListeningFootprint());
  expect(mocks.week).toHaveBeenCalledOnce();
  expect(mocks.month).toHaveBeenCalledOnce();
  expect(mocks.week.mock.calls[0]![0]).toBe(mocks.month.mock.calls[0]![0]);

  await act(async () => week.resolve(weekResponse()));
  expect(result.current.loading).toBe(true);
  await act(async () => month.reject(new Error("month unavailable")));
  expect(result.current).toMatchObject({ loading: false, failed: true, month: null });
  expect(result.current.week?.total).toBe(283);

  mocks.week.mockRejectedValueOnce(new Error("week unavailable"));
  mocks.month.mockRejectedValueOnce(new Error("month unavailable"));
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current).toMatchObject({ week: null, month: null, failed: true });
});

it("keeps old statistics visible during refresh and ignores superseded revisions", async () => {
  const { result, rerender } = renderHook(({ revision }) => useListeningFootprint(revision), {
    initialProps: { revision: 0 }
  });
  await waitFor(() => expect(result.current.loading).toBe(false));
  const initialWeek = result.current.week;
  const initialMonth = result.current.month;
  const reload = result.current.reload;
  const staleWeek = deferred<WeekResponse>();
  mocks.week.mockReturnValueOnce(staleWeek.promise);
  act(() => result.current.reload());
  expect(result.current.loading).toBe(true);
  expect(result.current.week).toBe(initialWeek);
  expect(result.current.month).toBe(initialMonth);
  expect(result.current.reload).toBe(reload);

  const signal = mocks.week.mock.calls[1]![0] as AbortSignal;
  mocks.week.mockResolvedValueOnce(weekResponse(700));
  mocks.month.mockResolvedValueOnce(monthResponse(2000));
  rerender({ revision: 1 });
  expect(signal.aborted).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.week?.total).toBe(700);
  expect(result.current.month?.total).toBe(2000);
  await act(async () => staleWeek.resolve(weekResponse(999)));
  expect(result.current.week?.total).toBe(700);
});

it("reuses loaded data while inactive and aborts hidden or unmounted requests", async () => {
  const view = renderHook(({ active }) => useListeningFootprint(0, active), {
    initialProps: { active: true }
  });
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  const previousWeek = view.result.current.week;
  view.rerender({ active: false });
  expect(view.result.current.week).toBe(previousWeek);
  expect(view.result.current.loading).toBe(false);
  expect(mocks.week).toHaveBeenCalledOnce();

  const pending = deferred<WeekResponse>();
  mocks.week.mockReturnValueOnce(pending.promise);
  view.rerender({ active: true });
  expect(view.result.current.loading).toBe(true);
  expect(view.result.current.week).toBe(previousWeek);
  const hiddenSignal = mocks.week.mock.calls[1]![0] as AbortSignal;
  view.rerender({ active: false });
  expect(hiddenSignal.aborted).toBe(true);
  expect(view.result.current.loading).toBe(false);
  await act(async () => pending.resolve(weekResponse(999)));
  expect(view.result.current.week).toBe(previousWeek);

  mocks.week.mockReturnValueOnce(deferred<WeekResponse>().promise);
  view.rerender({ active: true });
  const unmountedSignal = mocks.week.mock.calls[2]![0] as AbortSignal;
  view.unmount();
  expect(unmountedSignal.aborted).toBe(true);
});

it("isolates accounts and clears results immediately when logging out", async () => {
  const { result, rerender } = renderHook(() => useListeningFootprint());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.week?.total).toBe(283);

  const anotherAccount = deferred<WeekResponse>();
  mocks.week.mockReturnValueOnce(anotherAccount.promise);
  mocks.user = { userId: 22, isLoggedIn: true };
  rerender();
  expect(result.current).toMatchObject({ week: null, month: null, loading: true });
  const accountSignal = mocks.week.mock.calls[1]![0] as AbortSignal;
  mocks.user = null;
  rerender();
  expect(accountSignal.aborted).toBe(true);
  expect(result.current).toMatchObject({
    week: null,
    month: null,
    loggedIn: false,
    loading: false,
    failed: false
  });
  await act(async () => anotherAccount.resolve(weekResponse(999)));
  expect(result.current.week).toBeNull();
  act(() => result.current.reload());
  expect(mocks.week).toHaveBeenCalledTimes(2);
});
