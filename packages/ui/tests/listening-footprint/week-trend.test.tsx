import "dayjs/locale/zh-cn";

import { act, cleanup, waitFor, renderHook } from "@testing-library/react";
import { useListeningWeekTrend } from "@mahiru/ui/common/hooks/use-listening-week-trend";
import dayjs from "dayjs";
import type { RendererFormat } from "@mahiru/ui/common/lib/format";

type Week = ReturnType<typeof RendererFormat.weekRecord>;

const mocks = vi.hoisted(() => ({
  report: vi.fn(),
  user: { userId: 11, isLoggedIn: true } as null | { userId: number; isLoggedIn: boolean }
}));

vi.mock("@/common/netease/api", () => ({
  NeteaseAPIRecord: { report: mocks.report }
}));
vi.mock("@/common/store/user", () => ({ useUser: () => mocks.user }));

function detail(period: string, duration?: number): Week["details"][number] {
  return { period, duration, reachLimit: false, podcastDuration: 0, audiobookDuration: 0 };
}

function week(details: Week["details"]): Week {
  return {
    details,
    today: details.at(-1),
    total: details.reduce((sum, item) => sum + (item.duration ?? 0), 0),
    weekDays: details.length,
    todayTrackCount: 4
  };
}

function history(details: Week["details"]) {
  return { data: { listenTimeDistributionBlock: { durationDetails: details } } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const previousWeek = Array.from({ length: 7 }, (_, index) =>
  detail(`2026-11-0${index + 1}`, (index + 1) * 10)
);
const currentWeek = week([detail("2026-11-08", 80), detail("2026-11-09", 90)]);

beforeEach(() => {
  mocks.user = { userId: 11, isLoggedIn: true };
  mocks.report.mockReset().mockResolvedValue(history(previousWeek));
});
afterEach(cleanup);

it.each([
  {
    date: "2026-11-08",
    week: week([detail("2026-11-08", 80)]),
    dates: ["02", "03", "04", "05", "06", "07", "08"],
    durations: [20, 30, 40, 50, 60, 70, 80],
    previousDays: 6
  },
  {
    date: "2026-11-09",
    week: currentWeek,
    dates: ["03", "04", "05", "06", "07", "08", "09"],
    durations: [30, 40, 50, 60, 70, 80, 90],
    previousDays: 5
  }
])(
  "fills the seven calendar days ending $date from the previous Sunday-based week",
  async (sample) => {
    const { result } = renderHook(() =>
      useListeningWeekTrend({ date: sample.date, week: sample.week })
    );
    expect(mocks.report).toHaveBeenCalledOnce();
    expect(mocks.report).toHaveBeenCalledWith(
      "week",
      new Date(2026, 10, 7).getTime(),
      expect.any(AbortSignal)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.details.map((item) => item.period)).toEqual(
      sample.dates.map((day) => `2026-11-${day}`)
    );
    expect(result.current.details.map((item) => item.duration)).toEqual(sample.durations);
    expect(result.current.details.filter((item) => item.previousWeek)).toHaveLength(
      sample.previousDays
    );
    expect(result.current.failed).toBe(false);
  }
);

it("does not request history on Saturday when the current natural week already spans seven days", () => {
  const { result } = renderHook(() =>
    useListeningWeekTrend({ date: "2026-11-07", week: week(previousWeek) })
  );
  expect(mocks.report).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
  expect(result.current.details.map((item) => item.period)).toEqual(
    previousWeek.map((item) => item.period)
  );
  expect(result.current.details.every((item) => !item.previousWeek)).toBe(true);
});

it("keeps Sunday as the boundary when the active locale starts weeks on Monday", async () => {
  const previousLocale = dayjs.locale();
  dayjs.locale("zh-cn");
  try {
    const { result } = renderHook(() =>
      useListeningWeekTrend({ date: "2026-11-09", week: currentWeek })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.report).toHaveBeenCalledWith(
      "week",
      new Date(2026, 10, 7).getTime(),
      expect.any(AbortSignal)
    );
    expect(result.current.details.filter((item) => item.previousWeek)).toHaveLength(5);
  } finally {
    dayjs.locale(previousLocale);
  }
});

it.each([
  {
    date: "2026-11-01",
    endTime: new Date(2026, 9, 31).getTime(),
    expected: [
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01"
    ]
  },
  {
    date: "2027-01-01",
    endTime: new Date(2026, 11, 26).getTime(),
    expected: [
      "2026-12-26",
      "2026-12-27",
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01"
    ]
  }
])(
  "uses local calendar dates and the prior Saturday across the boundary at $date",
  async (sample) => {
    mocks.report.mockResolvedValue(history([detail(sample.expected[0]!, 15)]));
    const { result } = renderHook(() =>
      useListeningWeekTrend({ date: sample.date, week: week([detail(sample.date, 20)]) })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.report).toHaveBeenCalledWith("week", sample.endTime, expect.any(AbortSignal));
    expect(result.current.details.map((item) => item.period)).toEqual(sample.expected);
    expect(result.current.details.at(-1)).toMatchObject({
      period: sample.date,
      duration: 20,
      previousWeek: false
    });
  }
);

it("sorts and deduplicates by date, prefers current data, and preserves zero and missing values", async () => {
  mocks.report.mockResolvedValue(
    history([
      detail("2026-11-08", 999),
      detail("2026-11-07", 70),
      detail("2026-11-04", 0),
      detail("2026-11-03", 30),
      detail("2026-11-03", 31),
      detail("2026-11-01", 10),
      detail("2026-11-10", 100)
    ])
  );
  const { result } = renderHook(() =>
    useListeningWeekTrend({
      date: "2026-11-09",
      week: week([detail("2026-11-09", 90), detail("2026-11-08", 80)])
    })
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.details).toHaveLength(7);
  expect(new Set(result.current.details.map((item) => item.period)).size).toBe(7);
  expect(result.current.details.map((item) => item.period)).toEqual([
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
    "2026-11-08",
    "2026-11-09"
  ]);
  expect(result.current.details.find((item) => item.period === "2026-11-04")?.duration).toBe(0);
  expect(
    result.current.details.find((item) => item.period === "2026-11-05")?.duration
  ).toBeUndefined();
  expect(result.current.details.find((item) => item.period === "2026-11-08")?.duration).toBe(80);
  expect(result.current.details.at(-1)?.duration).toBe(90);
});

it("retains current dates when history fails instead of inventing zero-duration historical bars", async () => {
  mocks.report.mockRejectedValue(new Error("history unavailable"));
  const { result } = renderHook(() =>
    useListeningWeekTrend({ date: "2026-11-09", week: currentWeek })
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.failed).toBe(true);
  expect(result.current.details.map((item) => item.duration)).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    80,
    90
  ]);
});

it("keeps loaded history during refresh and does not refetch when the current week or date updates within one week", async () => {
  const view = renderHook(
    ({ date, week: current }) => useListeningWeekTrend({ date, week: current }),
    {
      initialProps: { date: "2026-11-09", week: currentWeek }
    }
  );
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  const reload = view.result.current.reload;
  view.rerender({
    date: "2026-11-10",
    week: week([...currentWeek.details, detail("2026-11-10", 100)])
  });
  expect(mocks.report).toHaveBeenCalledOnce();
  expect(view.result.current.details.map((item) => item.period)).toEqual([
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
    "2026-11-08",
    "2026-11-09",
    "2026-11-10"
  ]);
  const pending = deferred<ReturnType<typeof history>>();
  mocks.report.mockReturnValueOnce(pending.promise);
  act(() => view.result.current.reload());
  expect(view.result.current.loading).toBe(true);
  expect(view.result.current.details[0]?.duration).toBe(40);
  expect(view.result.current.reload).toBe(reload);
  await act(async () => pending.resolve(history([detail("2026-11-04", 44)])));
  expect(view.result.current.loading).toBe(false);
  expect(view.result.current.details[0]?.duration).toBe(44);
});

it("discards the previous period immediately and aborts its request when the natural week changes", async () => {
  const stale = deferred<ReturnType<typeof history>>();
  mocks.report.mockReturnValueOnce(stale.promise);
  const view = renderHook(
    ({ date, week: current }) => useListeningWeekTrend({ date, week: current }),
    {
      initialProps: { date: "2026-11-09", week: currentWeek }
    }
  );
  const oldSignal = mocks.report.mock.calls[0]![2] as AbortSignal;
  const next = deferred<ReturnType<typeof history>>();
  mocks.report.mockReturnValueOnce(next.promise);
  view.rerender({ date: "2026-11-15", week: week([detail("2026-11-15", 150)]) });
  expect(oldSignal.aborted).toBe(true);
  expect(mocks.report.mock.calls.at(-1)![1]).toBe(new Date(2026, 10, 14).getTime());
  expect(view.result.current.details.map((item) => item.duration)).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    150
  ]);
  await act(async () => stale.resolve(history(previousWeek)));
  expect(view.result.current.details[0]?.duration).toBeUndefined();
  await act(async () => next.resolve(history([detail("2026-11-09", 91)])));
  expect(view.result.current.details[0]?.duration).toBe(91);
});

it("skips unauthenticated, inactive, or missing-current-week work and aborts on hiding or unmounting", () => {
  mocks.user = null;
  const view = renderHook(
    ({ active, week: current }) =>
      useListeningWeekTrend({ date: "2026-11-09", active, week: current }),
    {
      initialProps: { active: true, week: currentWeek as null | Week }
    }
  );
  expect(view.result.current.details).toEqual([]);
  expect(view.result.current.loading).toBe(false);
  expect(mocks.report).not.toHaveBeenCalled();
  mocks.user = { userId: 11, isLoggedIn: true };
  view.rerender({ active: false, week: currentWeek });
  expect(view.result.current.details).toEqual([]);
  expect(mocks.report).not.toHaveBeenCalled();
  view.rerender({ active: true, week: null });
  expect(view.result.current.details).toEqual([]);
  expect(mocks.report).not.toHaveBeenCalled();
  mocks.report.mockReturnValue(deferred<ReturnType<typeof history>>().promise);
  view.rerender({ active: true, week: currentWeek });
  const hiddenSignal = mocks.report.mock.calls.at(-1)![2] as AbortSignal;
  view.rerender({ active: false, week: currentWeek });
  expect(hiddenSignal.aborted).toBe(true);
  expect(view.result.current.details).toEqual([]);
  expect(view.result.current.loading).toBe(false);
  view.rerender({ active: true, week: currentWeek });
  const unmountedSignal = mocks.report.mock.calls.at(-1)![2] as AbortSignal;
  view.unmount();
  expect(unmountedSignal.aborted).toBe(true);
});

it("isolates account history and ignores a response arriving after logout", async () => {
  const view = renderHook(() => useListeningWeekTrend({ date: "2026-11-09", week: currentWeek }));
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  expect(view.result.current.details[0]?.duration).toBe(30);
  const pending = deferred<ReturnType<typeof history>>();
  mocks.report.mockReturnValueOnce(pending.promise);
  mocks.user = { userId: 22, isLoggedIn: true };
  view.rerender();
  expect(view.result.current.details[0]?.duration).toBeUndefined();
  expect(view.result.current.loading).toBe(true);
  const signal = mocks.report.mock.calls.at(-1)![2] as AbortSignal;
  mocks.user = null;
  view.rerender();
  expect(signal.aborted).toBe(true);
  expect(view.result.current).toMatchObject({ details: [], loading: false, failed: false });
  await act(async () => pending.resolve(history(previousWeek)));
  expect(view.result.current.details).toEqual([]);
});
