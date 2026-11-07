import { act, render, cleanup, fireEvent } from "@testing-library/react";
import ForYouPanel from "@mahiru/ui/wins/main/pages/home/for-you-panel";
import type { NeteaseTrackRecord } from "@mahiru/ui/common/netease/models";
import type { PlayerListeningFootprintDrawerProps } from "@mahiru/ui/common/components/display/drawer/listening-footprint-drawer";

type WeekSummary = {
  total: number;
  todayTrackCount: number;
  today: { duration: number };
  details: { period: string; duration: number }[];
};

const mocks = vi.hoisted(() => ({
  user: { profile: { nickname: "听众", createTime: 1475366400000 } } as null | {
    profile: { nickname: string; createTime: number };
  },
  report: {
    loggedIn: true,
    loading: false,
    failed: false,
    week: {
      today: { duration: 283 },
      todayTrackCount: 63,
      total: 1989,
      details: [
        { period: "2026-11-05", duration: 160 },
        { period: "2026-11-06", duration: 283 }
      ]
    } as null | WeekSummary,
    month: { total: 4120 } as null | { total: number },
    reload: vi.fn()
  },
  historyListeners: new Set<() => void>(),
  captureTracks: vi.fn(),
  captureRevision: vi.fn(),
  createDrawer: vi.fn(),
  ready: vi.fn(async () => {}),
  display: vi.fn(),
  play: vi.fn(),
  album: vi.fn(),
  artist: vi.fn(),
  comment: vi.fn(),
  addLast: vi.fn(),
  addNext: vi.fn()
}));
const player = {
  history: {
    addListener: (listener: () => void) => {
      mocks.historyListeners.add(listener);
      return () => mocks.historyListeners.delete(listener);
    }
  }
};
vi.mock("@/common/store/user", () => ({ useUser: () => mocks.user }));
vi.mock("@/common/hooks/use-listening-footprint", () => ({
  useListeningFootprint: (revision: number) => {
    mocks.captureRevision(revision);
    return mocks.report;
  },
  formatListeningDuration: (value?: number) => (value == null ? "—" : String(value) + "分钟")
}));
vi.mock("@/common/netease/models", () => ({
  NeteaseNetworkImage: { fromUserAvatar: () => null }
}));
vi.mock("@/common/components/display/image/netease-image", () => ({
  default: () => <span aria-label="用户头像" />
}));
vi.mock("@/common/components/display/drawer", () => ({
  default: { _create: mocks.createDrawer },
  createPlayerListeningFootprintDrawer: vi.fn()
}));
vi.mock("@/common/lib/window", () => ({
  RendererWindow: { display: { reactReadyAwait: mocks.ready } }
}));
vi.mock("@/common/lib/bus", () => ({
  RendererIPCMessageBus: { display: { deliver: mocks.display } }
}));
vi.mock("@/wins/main/lib/handle", () => ({
  default: {
    get player() {
      return player;
    }
  }
}));
vi.mock("@/wins/main/hooks/use-page-jump", () => ({
  usePageJump: () => ({ jumpAlbumPage: mocks.album, jumpArtistPage: mocks.artist })
}));
vi.mock("@/wins/main/hooks/use-player-action-in-list", () => ({
  usePlayerActionInList: (getTracks: () => unknown[]) => {
    mocks.captureTracks(getTracks);
    return {
      player,
      onTrackPlay: mocks.play,
      openTrackComment: mocks.comment,
      addTrackToPlaylistLast: mocks.addLast,
      addTrackToPlaylistNext: mocks.addNext
    };
  }
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 6, 12));
  mocks.user = { profile: { nickname: "听众", createTime: 1475366400000 } };
  mocks.report.loggedIn = true;
  mocks.report.loading = false;
  mocks.report.failed = false;
  mocks.report.week = {
    today: { duration: 283 },
    todayTrackCount: 63,
    total: 1989,
    details: [
      { period: "2026-11-05", duration: 160 },
      { period: "2026-11-06", duration: 283 }
    ]
  };
  mocks.report.month = { total: 4120 };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("keeps account identity and today's date visible while only the statistics refresh", () => {
  const view = render(<ForYouPanel />);
  const avatar = view.getByRole("button", { name: "账号设置" });
  const date = view.getByLabelText("2026年11月06日");
  expect(view.getByText("听众")).toBeInTheDocument();
  expect(view.getByText(/^注册/)).toHaveAttribute("title", expect.stringContaining("注册"));
  fireEvent.click(view.getByRole("button", { name: "刷新听歌足迹" }));
  expect(mocks.report.reload).toHaveBeenCalledOnce();

  mocks.report.loading = true;
  view.rerender(<ForYouPanel className="refreshing" />);
  expect(view.getByRole("button", { name: "账号设置" })).toBe(avatar);
  expect(view.getByLabelText("2026年11月06日")).toBe(date);
  expect(view.getByLabelText("今日收听时长")).toHaveTextContent("283分钟");
  expect(view.getByRole("list", { name: "本周每日收听时长" })).toBeInTheDocument();
  expect(view.getByText("更新中")).toBeInTheDocument();
  expect(view.getByRole("button", { name: "刷新听歌足迹" })).toBeDisabled();
});

it("opens the selected period and provides loaded report tracks to the existing play actions", () => {
  const view = render(<ForYouPanel />);
  for (const [label, period] of [
    ["查看今日听歌足迹", "today"],
    ["查看本周听歌足迹", "week"],
    ["查看本月听歌足迹", "month"],
    ["查看听歌足迹", "week"]
  ]) {
    fireEvent.click(view.getByRole("button", { name: label }));
    expect(mocks.createDrawer.mock.calls.at(-1)![1]).toMatchObject({
      initialPeriod: period,
      player,
      onPlay: mocks.play,
      onClickAlbum: mocks.album,
      onClickArtist: mocks.artist,
      openComment: mocks.comment,
      addToPlaylistLast: mocks.addLast,
      addToPlaylistNext: mocks.addNext
    });
  }
  const props = mocks.createDrawer.mock.calls.at(-1)![1] as PlayerListeningFootprintDrawerProps;
  const tracks = [{ id: 7 }] as NeteaseTrackRecord[];
  props.onTracksLoaded?.(tracks);
  const getTracks = mocks.captureTracks.mock.calls.at(-1)![0] as () => NeteaseTrackRecord[];
  expect(getTracks()).toBe(tracks);
  fireEvent.click(view.getByRole("button", { name: "查看今日听歌足迹" }));
  expect(mocks.createDrawer.mock.calls.at(-1)![1].initialPeriod).toBe("today");
  expect(getTracks()).toEqual([]);
});

it("renders the weekly trend without an extra today action and handles missing trend data", () => {
  const view = render(<ForYouPanel />);
  expect(view.queryByText("查看今日记录")).not.toBeInTheDocument();
  expect(view.getByRole("list", { name: "本周每日收听时长" })).toBeInTheDocument();
  fireEvent.click(view.getByRole("button", { name: "11月6日，283分钟" }));
  expect(mocks.createDrawer.mock.calls.at(-1)![1]).toMatchObject({
    initialPeriod: "week",
    initialDay: "2026-11-06"
  });

  mocks.report.week!.details = [];
  view.rerender(<ForYouPanel className="empty-trend" />);
  expect(view.queryByRole("list", { name: "本周每日收听时长" })).not.toBeInTheDocument();
  expect(view.getByText("本周暂无趋势")).toBeInTheDocument();
});

it("preserves zero counts and sends the logged-out account action to the existing settings entry", async () => {
  mocks.report.week!.today.duration = 0;
  mocks.report.week!.todayTrackCount = 0;
  const view = render(<ForYouPanel />);
  expect(view.getByLabelText("今日收听时长")).toHaveTextContent("0分钟");
  expect(view.getByLabelText("今日歌曲数量")).toHaveTextContent("0首歌曲");
  mocks.user = null;
  mocks.report.loggedIn = false;
  view.rerender(<ForYouPanel className="logged-out" />);
  expect(view.getByLabelText("今日收听时长")).toHaveTextContent("—");
  expect(view.getByLabelText("今日歌曲数量")).toHaveTextContent("—首歌曲");
  expect(view.queryByRole("list", { name: "本周每日收听时长" })).not.toBeInTheDocument();
  expect(view.getByText("登录后查看趋势")).toBeInTheDocument();
  await act(async () => fireEvent.click(view.getByRole("button", { name: "登录查看听歌足迹" })));
  expect(mocks.createDrawer).not.toHaveBeenCalled();
  expect(mocks.ready).toHaveBeenCalledOnce();
  expect(mocks.display).toHaveBeenCalledWith({ type: "settings" });
});

it("shows loading placeholders without presenting missing statistics as zero", () => {
  mocks.report.loading = true;
  mocks.report.week = null;
  mocks.report.month = null;
  const view = render(<ForYouPanel />);
  expect(view.getByRole("complementary", { name: "听歌足迹" })).toHaveAttribute(
    "aria-busy",
    "true"
  );
  expect(view.getByLabelText("今日收听时长")).toHaveTextContent("—");
  expect(view.getByLabelText("今日歌曲数量")).toHaveTextContent("—首歌曲");
  expect(view.getByLabelText("本周收听时长")).toHaveTextContent("—");
  expect(view.getByLabelText("本月收听时长")).toHaveTextContent("—");
  expect(view.queryByText("0分钟")).not.toBeInTheDocument();
  expect(view.queryByRole("list", { name: "本周每日收听时长" })).not.toBeInTheDocument();
  expect(view.getByText("正在同步趋势")).toBeInTheDocument();
  expect(view.getByRole("button", { name: "刷新听歌足迹" })).toBeDisabled();
});

it("renders a successful zero week as an empty listening state rather than a fake chart", () => {
  mocks.report.week = {
    today: { duration: 0 },
    todayTrackCount: 0,
    total: 0,
    details: [
      { period: "2026-11-05", duration: 0 },
      { period: "2026-11-06", duration: 0 }
    ]
  };
  mocks.report.month = { total: 0 };
  const view = render(<ForYouPanel />);
  expect(view.getByLabelText("今日收听时长")).toHaveTextContent("0分钟");
  expect(view.getByLabelText("今日歌曲数量")).toHaveTextContent("0首歌曲");
  expect(view.getByLabelText("本周收听时长")).toHaveTextContent("0分钟");
  expect(view.getByLabelText("本月收听时长")).toHaveTextContent("0分钟");
  expect(view.queryByRole("list", { name: "本周每日收听时长" })).not.toBeInTheDocument();
  expect(view.getByText("本周还没有收听记录")).toBeInTheDocument();
});

it("distinguishes unavailable week statistics from an empty week and allows refresh", () => {
  mocks.report.failed = true;
  mocks.report.week = null;
  const view = render(<ForYouPanel />);
  expect(view.getByText("本周统计暂不可用")).toBeInTheDocument();
  expect(view.queryByText("本周暂无趋势")).not.toBeInTheDocument();
  expect(view.queryByRole("list", { name: "本周每日收听时长" })).not.toBeInTheDocument();
  expect(view.getByLabelText("本月收听时长")).toHaveTextContent("4120分钟");
  const refresh = view.getByRole("button", { name: "刷新听歌足迹" });
  expect(refresh).toBeEnabled();
  fireEvent.click(refresh);
  expect(mocks.report.reload).toHaveBeenCalledOnce();
});

it("keeps an available week chart when only the monthly statistics failed", () => {
  mocks.report.failed = true;
  mocks.report.month = null;
  const view = render(<ForYouPanel />);
  expect(view.getByRole("list", { name: "本周每日收听时长" })).toBeInTheDocument();
  expect(view.getByLabelText("今日收听时长")).toHaveTextContent("283分钟");
  expect(view.getByLabelText("本周收听时长")).toHaveTextContent("1989分钟");
  expect(view.getByLabelText("本月收听时长")).toHaveTextContent("—");
  expect(view.queryByText("本周统计暂不可用")).not.toBeInTheDocument();
});

it("refreshes after history changes and midnight, and removes its history listener on unmount", () => {
  vi.setSystemTime(new Date(2026, 10, 6, 23, 59, 59));
  const view = render(<ForYouPanel />);
  expect(mocks.historyListeners.size).toBe(1);
  act(() => mocks.historyListeners.forEach((listener) => listener()));
  expect(mocks.captureRevision).toHaveBeenLastCalledWith(1);
  act(() => vi.advanceTimersByTime(1_000));
  expect(view.getByLabelText("2026年11月07日")).toBeInTheDocument();
  expect(mocks.captureRevision).toHaveBeenLastCalledWith(2);
  view.unmount();
  expect(mocks.historyListeners.size).toBe(0);
});
