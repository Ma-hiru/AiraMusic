import { act, render, within, cleanup, waitFor, fireEvent } from "@testing-library/react";
import PlayListStats from "@mahiru/ui/common/components/page/play-list/stats";
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

function weekResponse(total = 45.5, durations = [20, 25.5, 0]) {
  return {
    data: {
      weekTodayListenBlock: { songCount: 3 },
      listenTimeDistributionBlock: {
        playDuration: total,
        durationDetails: durations.map((duration, index) => ({
          period: `2026-11-${String(index + 2).padStart(2, "0")}`,
          duration
        }))
      }
    }
  } as WeekResponse;
}

function monthResponse(total = 240) {
  return {
    data: { listenTimeDistributionBlock: { playDuration: total, durationDetails: [] } }
  } as unknown as MonthResponse;
}

beforeEach(() => {
  mocks.user = { userId: 11, isLoggedIn: true };
  mocks.week.mockReset().mockResolvedValue(weekResponse());
  mocks.month.mockReset().mockResolvedValue(monthResponse());
});
afterEach(cleanup);

it("requests only while active and logged in, then shows actual minutes and daily records", async () => {
  const view = render(<PlayListStats active={false} />);
  expect(mocks.week).not.toHaveBeenCalled();
  expect(mocks.month).not.toHaveBeenCalled();

  mocks.user = null;
  view.rerender(<PlayListStats active />);
  expect(view.getByText("登录后查看听歌足迹")).toBeInTheDocument();
  expect(mocks.week).not.toHaveBeenCalled();

  mocks.user = { userId: 11, isLoggedIn: true };
  view.rerender(<PlayListStats className="logged-in" active />);
  await waitFor(() => expect(view.getByRole("button", { name: "刷新听歌统计" })).toBeEnabled());
  expect(view.getByText("今日").nextElementSibling).toHaveTextContent("0分钟");
  expect(view.getByText("本周").nextElementSibling).toHaveTextContent("45.5分钟");
  expect(view.getByText("本月").nextElementSibling).toHaveTextContent("240分钟");
  const records = within(view.getByRole("list", { name: "本周每日收听时长" }));
  expect(records.getAllByRole("listitem")).toHaveLength(3);
  expect(records.getByRole("listitem", { name: "2026-11-03，25.5分钟" })).toBeInTheDocument();
  expect(mocks.week.mock.calls[0]![0]).toBe(mocks.month.mock.calls[0]![0]);
});

it("refreshes on revision changes and ignores earlier or inactive requests", async () => {
  let resolvePrevious!: (response: WeekResponse) => void;
  mocks.week.mockReturnValueOnce(new Promise((resolve) => (resolvePrevious = resolve)));
  const view = render(<PlayListStats statsRevision={0} />);
  const previousSignal = mocks.week.mock.calls[0]![0] as AbortSignal;
  mocks.week.mockResolvedValue(weekResponse(81, [81]));
  view.rerender(<PlayListStats statsRevision={1} />);
  expect(previousSignal.aborted).toBe(true);
  await waitFor(() =>
    expect(view.getByText("本周").nextElementSibling).toHaveTextContent("81分钟")
  );

  await act(async () => resolvePrevious(weekResponse(999, [999])));
  expect(view.getByText("本周").nextElementSibling).toHaveTextContent("81分钟");
  const currentSignal = mocks.week.mock.calls[1]![0] as AbortSignal;
  view.rerender(<PlayListStats active={false} statsRevision={2} />);
  expect(currentSignal.aborted).toBe(true);
  expect(mocks.week).toHaveBeenCalledTimes(2);
  expect(mocks.month).toHaveBeenCalledTimes(2);
});

it("retains successful statistics when one request fails and allows a refresh", async () => {
  mocks.month.mockRejectedValueOnce(new Error("month unavailable"));
  const view = render(<PlayListStats />);
  expect(await view.findByText("部分听歌数据暂不可用")).toBeInTheDocument();
  expect(view.getByText("本周").nextElementSibling).toHaveTextContent("45.5分钟");
  expect(view.getByText("本月").nextElementSibling).toHaveTextContent("—");

  mocks.month.mockResolvedValue(monthResponse(360));
  fireEvent.click(view.getByRole("button", { name: "刷新听歌统计" }));
  await waitFor(() =>
    expect(view.getByText("本月").nextElementSibling).toHaveTextContent("360分钟")
  );
  expect(view.queryByText("部分听歌数据暂不可用")).not.toBeInTheDocument();
  expect(mocks.week).toHaveBeenCalledTimes(2);
  expect(mocks.month).toHaveBeenCalledTimes(2);
});

it("hides statistics from the previous account while switching and after logout", async () => {
  const view = render(<PlayListStats />);
  await waitFor(() =>
    expect(view.getByText("本周").nextElementSibling).toHaveTextContent("45.5分钟")
  );
  let resolveCurrent!: (response: WeekResponse) => void;
  mocks.week.mockReturnValueOnce(new Promise((resolve) => (resolveCurrent = resolve)));
  mocks.user = { userId: 22, isLoggedIn: true };
  view.rerender(<PlayListStats className="account-22" />);
  expect(view.getByText("本周").nextElementSibling).toHaveTextContent("—");
  await act(async () => resolveCurrent(weekResponse(70, [70])));
  expect(view.getByText("本周").nextElementSibling).toHaveTextContent("70分钟");

  const signal = mocks.week.mock.calls[1]![0] as AbortSignal;
  mocks.user = null;
  view.rerender(<PlayListStats className="logged-out" />);
  expect(signal.aborted).toBe(true);
  expect(view.getByText("登录后查看听歌足迹")).toBeInTheDocument();
  expect(view.queryByText("本周")).not.toBeInTheDocument();
  expect(mocks.week).toHaveBeenCalledTimes(2);
});

it("waits for fresh statistics when the same account logs in again", async () => {
  const view = render(<PlayListStats />);
  await waitFor(() =>
    expect(view.getByText("本周").nextElementSibling).toHaveTextContent("45.5分钟")
  );

  mocks.user = null;
  view.rerender(<PlayListStats className="logged-out" />);
  expect(view.getByText("登录后查看听歌足迹")).toBeInTheDocument();

  let resolveCurrent!: (response: WeekResponse) => void;
  mocks.week.mockReturnValueOnce(new Promise((resolve) => (resolveCurrent = resolve)));
  mocks.user = { userId: 11, isLoggedIn: true };
  view.rerender(<PlayListStats className="logged-in-again" />);
  expect(view.getByText("本周").nextElementSibling).toHaveTextContent("—");
  expect(view.getByRole("button", { name: "刷新听歌统计" })).toBeDisabled();

  await act(async () => resolveCurrent(weekResponse(8, [8])));
  expect(view.getByText("本周").nextElementSibling).toHaveTextContent("8分钟");
  expect(view.getByRole("button", { name: "刷新听歌统计" })).toBeEnabled();
  expect(mocks.week).toHaveBeenCalledTimes(2);
  expect(mocks.month).toHaveBeenCalledTimes(2);
});
