import { act, render, within, cleanup, waitFor, fireEvent } from "@testing-library/react";
import {
  createListeningFootprintDrawer,
  createPlayerListeningFootprintDrawer,
  type PlayerListeningFootprintDrawerProps
} from "@mahiru/ui/common/components/display/drawer/listening-footprint-drawer";
import AppDrawer from "@mahiru/ui/common/components/display/drawer/use";
import ListeningFootprint, {
  type ListeningFootprintProps
} from "@mahiru/ui/common/components/page/listening-footprint";
import type RendererPlayer from "@mahiru/ui/common/player/core";
import type { useListeningFootprint } from "@mahiru/ui/common/hooks/use-listening-footprint";
import type { useListeningWeekTrend } from "@mahiru/ui/common/hooks/use-listening-week-trend";
import type { NeteaseTrackRecord, NeteaseHistoryRecord } from "@mahiru/ui/common/netease/models";

const mocks = vi.hoisted(() => ({
  today: vi.fn(),
  ranked: vi.fn(),
  rankReload: vi.fn(),
  summary: vi.fn(),
  close: vi.fn(),
  todayReload: vi.fn(),
  summaryReload: vi.fn(),
  contextProps: vi.fn(),
  contextMenu: vi.fn(),
  weekTrend: vi.fn(),
  trendReload: vi.fn()
}));
vi.mock("@/common/hooks/use-listening-week-trend", () => ({
  useListeningWeekTrend: mocks.weekTrend
}));

vi.mock("@/common/hooks/use-listening-footprint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mahiru/ui/common/hooks/use-listening-footprint")>()),
  useListeningFootprint: mocks.summary
}));
vi.mock("@/common/components/page/listening-footprint/use-today-tracks", () => ({
  default: mocks.today
}));
vi.mock("@/common/components/page/listening-footprint/use-ranked-tracks", () => ({
  default: mocks.ranked
}));
vi.mock("@/common/components/display/drawer/use", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@mahiru/ui/common/components/display/drawer/use")>();
  actual.default.close = mocks.close;
  return actual;
});
vi.mock("@/common/hooks/use-user-track-manager", () => ({
  useUserTrackManager: () => ({ heartManager: undefined, playableManager: undefined })
}));
vi.mock("@/common/hooks/use-track-add-to-playlist", () => ({ openTrackAddToPlaylist: vi.fn() }));
vi.mock("@/common/hooks/use-track-context-menu", () => ({
  useTrackContextMenu: (props: unknown) => {
    mocks.contextProps(props);
    return { onContextMenu: mocks.contextMenu };
  }
}));
vi.mock("@/common/components/display/track_list", () => ({
  default: ({
    onClick,
    onContext,
    onClickAlbum,
    onClickArtist,
    tracks,
    activeID,
    emptyTips
  }: {
    activeID?: number;
    emptyTips: string;
    tracks: NeteaseTrackRecord[];
    onClickAlbum: (id: number) => void;
    onClickArtist: (id: number) => void;
    onClick: (track: NeteaseTrackRecord, index: number) => void;
    onContext: (event: { clientX: number; clientY: number }, track: NeteaseTrackRecord) => void;
  }) => (
    <div role="list" aria-label="足迹歌曲列表" data-active-id={activeID}>
      {tracks.length === 0 ? (
        <p>{emptyTips}</p>
      ) : (
        <>
          <button onClick={() => onClick(tracks[0]!, 0)}>播放列表歌曲</button>
          <button onClick={() => onClickAlbum(17)}>查看歌曲专辑</button>
          <button onClick={() => onClickArtist(27)}>查看歌曲歌手</button>
          <button onClick={() => onContext({ clientX: 10, clientY: 20 }, tracks[0]!)}>
            打开歌曲菜单
          </button>
        </>
      )}
    </div>
  )
}));

const track = { id: 7, detail: { name: "Today's song" } } as NeteaseTrackRecord;
const tracks = [track];
const rankTrack = { id: 8, detail: { name: "Ranked song" } } as NeteaseTrackRecord;
const rankTracks = [rankTrack];
const localTrack = {
  id: 9,
  detail: { name: "Local song" },
  time: new Date(2026, 10, 5, 14).getTime()
} as NeteaseHistoryRecord;
const detail = (period: string, duration: number) => ({
  period,
  duration,
  reachLimit: false,
  podcastDuration: 0,
  audiobookDuration: 0
});
const rollingWeekDetails = [
  { period: "2026-11-03", duration: 276, previousWeek: true },
  { period: "2026-11-04", duration: 503, previousWeek: true },
  { period: "2026-11-05", duration: 389, previousWeek: true },
  { period: "2026-11-06", duration: 419, previousWeek: true },
  { period: "2026-11-07", duration: 1283, previousWeek: true },
  { period: "2026-11-08", duration: 232, previousWeek: false },
  { period: "2026-11-09", duration: 198, previousWeek: false }
];

function rollingAcrossMidnight() {
  mocks.weekTrend.mockImplementation(({ date }: Parameters<typeof useListeningWeekTrend>[0]) => ({
    details:
      date === "2026-11-10"
        ? [
            ...rollingWeekDetails.slice(1),
            { period: "2026-11-10", duration: 210, previousWeek: false }
          ]
        : rollingWeekDetails,
    loading: false,
    failed: false,
    reload: mocks.trendReload
  }));
}

function summary(overrides: Partial<ReturnType<typeof useListeningFootprint>> = {}) {
  const weekDetails = [detail("2026-11-05", 160), detail("2026-11-06", 123)];
  const monthDetails = [
    detail("2026-11-01", 160),
    detail("2026-11-02", 160),
    detail("2026-11-03", 160)
  ];
  return {
    week: {
      total: 283,
      today: weekDetails[1],
      details: weekDetails,
      weekDays: 2,
      todayTrackCount: 11
    },
    month: { total: 480, today: monthDetails[2]!, details: monthDetails, days: 3 },
    loading: false,
    failed: false,
    loggedIn: true,
    reload: mocks.summaryReload,
    ...overrides
  } satisfies ReturnType<typeof useListeningFootprint>;
}

function reportProps(overrides: Partial<ListeningFootprintProps> = {}) {
  const historyRecords = [localTrack];
  const props: ListeningFootprintProps = {
    historyRecords,
    historyRevision: 0,
    activeTrackID: track.id,
    variant: "drawer",
    onPlay: vi.fn(),
    onClickAlbum: vi.fn(),
    onClickArtist: vi.fn(),
    openComment: vi.fn(),
    addToPlaylistLast: vi.fn(),
    addToPlaylistNext: vi.fn(),
    onTracksLoaded: vi.fn(),
    onScopeChange: vi.fn(),
    ...overrides
  };
  return { props, historyRecords };
}

function openReport(overrides: Partial<ListeningFootprintProps> = {}) {
  const setup = reportProps(overrides);
  return { ...render(<ListeningFootprint {...setup.props} />), ...setup };
}

function playerDrawerProps(overrides: Partial<PlayerListeningFootprintDrawerProps> = {}) {
  const { props, historyRecords } = reportProps();
  const historyListeners = new Set<() => void>();
  const player = {
    addListener: () => () => {},
    current: { track },
    history: {
      list: historyRecords,
      addListener: (callback: () => void) => {
        historyListeners.add(callback);
        return () => historyListeners.delete(callback);
      }
    }
  } as unknown as RendererPlayer;
  return {
    props: {
      player,
      initialPeriod: props.initialPeriod,
      initialDay: props.initialDay,
      onPlay: props.onPlay,
      onClickAlbum: props.onClickAlbum,
      onClickArtist: props.onClickArtist,
      openComment: props.openComment,
      addToPlaylistLast: props.addToPlaylistLast,
      addToPlaylistNext: props.addToPlaylistNext,
      onTracksLoaded: props.onTracksLoaded,
      ...overrides
    } satisfies PlayerListeningFootprintDrawerProps,
    historyRecords,
    historyListeners
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 6, 12));
  mocks.summary.mockReturnValue(summary());
  mocks.weekTrend.mockImplementation(({ week }: Parameters<typeof useListeningWeekTrend>[0]) => ({
    details: week?.details.map((item) => ({ ...item, previousWeek: false })) ?? [],
    loading: false,
    failed: false,
    reload: mocks.trendReload
  }));
  mocks.today.mockReturnValue({ tracks, loading: false, failed: false, reload: mocks.todayReload });
  mocks.ranked.mockReturnValue({
    tracks: rankTracks,
    loading: false,
    failed: false,
    reload: mocks.rankReload
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("switches period ranks and selects local daily songs without requiring a player", () => {
  const view = openReport();
  expect(view.getByRole("tab", { name: "今日" })).toHaveAttribute("aria-selected", "true");
  expect(view.getByLabelText("累计收听时长")).toHaveTextContent("2小时3分");
  expect(view.getByLabelText("今日歌曲数量")).toHaveTextContent("11 首");
  expect(view.getByRole("list", { name: "足迹歌曲列表" })).toHaveAttribute("data-active-id", "7");
  expect(view.queryByRole("figure", { name: "每日收听时长" })).not.toBeInTheDocument();
  fireEvent.click(view.getByRole("tab", { name: "本周" }));
  expect(view.getByLabelText("累计收听时长")).toHaveTextContent("4小时43分");
  expect(view.getByLabelText("日均收听时长")).toHaveTextContent("2小时22分");
  expect(view.getByText("本周播放排行")).toBeInTheDocument();
  expect(view.getByText("前20首")).toBeInTheDocument();
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith(rankTracks);
  expect(mocks.ranked.mock.calls.at(-1)![0]).toMatchObject({ active: true, period: "week" });
  const callsBeforeHover = mocks.today.mock.calls.length;
  const bar = view.getByRole("button", { name: "11月5日，2小时40分" });
  fireEvent.mouseEnter(bar);
  expect(view.getByRole("tooltip", { name: "11月5日收听时长" })).toHaveTextContent(
    "11月5日2小时40分"
  );
  expect(mocks.today).toHaveBeenCalledTimes(callsBeforeHover);
  fireEvent.click(bar);
  fireEvent.mouseLeave(bar.closest("ol")!);
  expect(bar).toHaveAttribute("aria-pressed", "true");
  expect(view.getByText("11月5日的本机记录")).toBeInTheDocument();
  expect(view.getByText("本机保留记录")).toBeInTheDocument();
  expect(view.getByLabelText("选中日期数据")).toHaveTextContent("11月5日 · 2小时40分");
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith([localTrack]);
  fireEvent.click(view.getByRole("button", { name: "播放列表歌曲" }));
  expect(view.props.onPlay).toHaveBeenLastCalledWith(localTrack, 0);
  expect(mocks.today.mock.calls.at(-1)![0]).toMatchObject({ active: false });
  expect(mocks.ranked.mock.calls.at(-1)![0]).toMatchObject({ active: false });
  fireEvent.click(view.getByRole("tab", { name: "本月" }));
  expect(view.getByLabelText("累计收听时长")).toHaveTextContent("8小时");
  expect(view.getByLabelText("日均收听时长")).toHaveTextContent("2小时40分");
  expect(view.getByText("本月播放排行")).toBeInTheDocument();
  expect(mocks.ranked.mock.calls.at(-1)![0]).toMatchObject({ active: true, period: "month" });
});

it("preserves callbacks while leaving navigation lifecycle to its host", () => {
  const view = openReport();
  expect(view.props.onTracksLoaded).toHaveBeenCalledWith(tracks);
  fireEvent.click(view.getByRole("button", { name: "播放列表歌曲" }));
  expect(view.props.onPlay).toHaveBeenCalledWith(track, 0);
  fireEvent.click(view.getByRole("button", { name: "查看歌曲专辑" }));
  expect(view.props.onClickAlbum).toHaveBeenCalledWith(17);
  fireEvent.click(view.getByRole("button", { name: "查看歌曲歌手" }));
  expect(view.props.onClickArtist).toHaveBeenCalledWith(27);
  expect(mocks.close).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "打开歌曲菜单" }));
  expect(mocks.contextMenu).toHaveBeenCalledWith({ clientX: 10, clientY: 20 }, track);
  expect(mocks.contextProps.mock.calls.at(-1)![0]).toMatchObject({
    onPlay: view.props.onPlay,
    openComment: view.props.openComment,
    addToPlaylistLast: view.props.addToPlaylistLast,
    addToPlaylistNext: view.props.addToPlaylistNext
  });
});

it("keeps tabs and the empty list available while logged out", () => {
  mocks.summary.mockReturnValue(summary({ loggedIn: false, week: null, month: null }));
  const view = openReport({ variant: "page" });
  expect(view.getAllByRole("tab")).toHaveLength(3);
  expect(view.getByText("登录后查看听歌足迹")).toBeInTheDocument();
  expect(view.getByRole("button", { name: "刷新听歌足迹" })).toBeDisabled();
  fireEvent.click(view.getByRole("tab", { name: "本月" }));
  expect(view.getByRole("tab", { name: "本月" })).toHaveAttribute("aria-selected", "true");
  expect(view.getByRole("list", { name: "足迹歌曲列表" })).toBeInTheDocument();
  expect(mocks.today.mock.calls.every(([props]) => props.active === false)).toBe(true);
  expect(mocks.ranked.mock.calls.every(([props]) => props.active === false)).toBe(true);
});

it("retains available statistics during partial failure and supports report and song retries", () => {
  mocks.summary.mockReturnValue(summary({ failed: true, month: null }));
  mocks.today.mockReturnValue({
    tracks: [],
    loading: false,
    failed: true,
    reload: mocks.todayReload
  });
  const view = openReport({ initialPeriod: "week", variant: "page" });
  expect(view.getByLabelText("累计收听时长")).toHaveTextContent("4小时43分");
  expect(view.getByText("统计暂未完整更新")).toBeInTheDocument();
  fireEvent.click(view.getByRole("button", { name: "刷新听歌足迹" }));
  expect(mocks.summaryReload).toHaveBeenCalledOnce();
  expect(mocks.rankReload).toHaveBeenCalledOnce();
  expect(mocks.todayReload).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("tab", { name: "今日" }));
  expect(view.getByText("暂时无法获取歌曲，可重试")).toBeInTheDocument();
  fireEvent.click(view.getByRole("button", { name: "重试今日歌曲" }));
  expect(mocks.todayReload).toHaveBeenCalledOnce();
});

it("uses today's API for today's bar and returns to the period rank", () => {
  const view = openReport({ initialPeriod: "week" });
  fireEvent.click(view.getByRole("button", { name: "11月6日，2小时3分" }));
  expect(view.getByText("今日听过的歌曲")).toBeInTheDocument();
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith(tracks);
  expect(mocks.today.mock.calls.at(-1)![0]).toMatchObject({ active: true });
  expect(mocks.ranked.mock.calls.at(-1)![0]).toMatchObject({ active: false });
  expect(view.queryByText("前20首")).not.toBeInTheDocument();
  fireEvent.click(view.getByRole("button", { name: "查看整周" }));
  expect(view.getByText("本周播放排行")).toBeInTheDocument();
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith(rankTracks);
  fireEvent.click(view.getByRole("button", { name: "11月5日，2小时40分" }));
  fireEvent.click(view.getByRole("tab", { name: "今日" }));
  expect(view.queryByRole("button", { name: "查看整周" })).not.toBeInTheDocument();
  expect(view.queryByRole("figure", { name: "每日收听时长" })).not.toBeInTheDocument();
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith(tracks);
});

it("uses history revision to refresh a selected local day and labels an empty local date", () => {
  const view = openReport({ initialPeriod: "week" });
  fireEvent.click(view.getByRole("button", { name: "11月5日，2小时40分" }));
  const secondLocal = { ...localTrack, id: 10 } as NeteaseHistoryRecord;
  view.historyRecords.push(secondLocal);
  view.rerender(<ListeningFootprint {...view.props} historyRevision={1} />);
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith([localTrack, secondLocal]);
  fireEvent.click(view.getByRole("tab", { name: "本月" }));
  fireEvent.click(view.getByRole("button", { name: "11月1日，2小时40分" }));
  expect(view.getByText("11月1日的本机记录")).toBeInTheDocument();
  expect(view.getByText("没有该日的本机保留记录")).toBeInTheDocument();
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith([]);
  fireEvent.click(view.getByRole("button", { name: "查看整月" }));
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith(rankTracks);
});

it("uses the full today list for a single-day month without drawing a multi-day chart", () => {
  const oneDay = summary();
  oneDay.month!.details = [detail("2026-11-06", 123)];
  oneDay.month!.total = 123;
  oneDay.month!.days = 1;
  mocks.summary.mockReturnValue(oneDay);
  const allTodayTracks = Array.from({ length: 25 }, (_, index) => ({ ...track, id: index + 100 }));
  mocks.today.mockReturnValue({
    tracks: allTodayTracks,
    loading: false,
    failed: false,
    reload: mocks.todayReload
  });
  const view = openReport({ initialPeriod: "month" });
  expect(view.queryByRole("figure", { name: "每日收听时长" })).not.toBeInTheDocument();
  expect(view.getByText("今日听过的歌曲")).toBeInTheDocument();
  expect(view.queryByText("前20首")).not.toBeInTheDocument();
  expect(view.queryByRole("button", { name: "查看整月" })).not.toBeInTheDocument();
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith(allTodayTracks);
  expect(view.props.onScopeChange).toHaveBeenLastCalledWith({ period: "month", day: "2026-11-06" });
  expect(mocks.today.mock.calls.at(-1)![0]).toMatchObject({ active: true });
  expect(mocks.ranked.mock.calls.at(-1)![0]).toMatchObject({ active: false });
});

it("initializes and publishes the current scope for page handoff", () => {
  const view = openReport({ initialPeriod: "week", initialDay: "2026-11-05", variant: "page" });
  expect(view.getByText("11月5日的本机记录")).toBeInTheDocument();
  expect(view.getByText("该日展示本机保留记录")).toBeInTheDocument();
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith([localTrack]);
  expect(view.props.onScopeChange).toHaveBeenLastCalledWith({ period: "week", day: "2026-11-05" });
  fireEvent.click(view.getByRole("button", { name: "查看整周" }));
  expect(view.props.onScopeChange).toHaveBeenLastCalledWith({ period: "week" });
  fireEvent.click(view.getByRole("tab", { name: "本月" }));
  expect(view.props.onScopeChange).toHaveBeenLastCalledWith({ period: "month" });
});

it("renders a rolling week and selects previous-week songs while keeping natural-week statistics", () => {
  vi.setSystemTime(new Date(2026, 10, 9, 12));
  const currentWeek = [detail("2026-11-08", 232), detail("2026-11-09", 198)];
  const currentSummary = summary({
    week: {
      total: 430,
      today: currentWeek[1],
      details: currentWeek,
      weekDays: 2,
      todayTrackCount: 50
    }
  });
  mocks.summary.mockReturnValue(currentSummary);
  mocks.weekTrend.mockReturnValue({
    details: rollingWeekDetails,
    loading: false,
    failed: false,
    reload: mocks.trendReload
  });
  const previousTrack = {
    ...localTrack,
    time: new Date(2026, 10, 3, 14).getTime()
  } as NeteaseHistoryRecord;
  const view = openReport({
    initialPeriod: "week",
    historyRecords: [previousTrack],
    variant: "page"
  });

  expect(mocks.weekTrend.mock.calls.at(-1)![0]).toMatchObject({
    date: "2026-11-09",
    week: currentSummary.week,
    active: true
  });
  const chart = within(view.getByRole("figure", { name: "每日收听时长" }));
  expect(chart.getAllByRole("button")).toHaveLength(7);
  expect(chart.getAllByRole("button", { name: /（上周）/ })).toHaveLength(5);
  expect(chart.getByText("近7天收听")).toBeInTheDocument();
  expect(chart.getByText("浅色为上周")).toBeInTheDocument();
  expect(view.getByLabelText("日均收听时长")).toHaveTextContent("本周日均 3小时35分");
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith(rankTracks);
  const previousBar = chart.getByRole("button", { name: "11月3日（上周），4小时36分" });
  fireEvent.mouseEnter(previousBar);
  expect(view.getByRole("tooltip", { name: "11月3日收听时长" })).toHaveTextContent(
    "11月3日上周4小时36分"
  );
  fireEvent.click(previousBar);
  expect(view.getByLabelText("选中日期数据")).toHaveTextContent("11月3日 · 4小时36分");
  expect(view.getByLabelText("累计收听时长")).toHaveTextContent("7小时10分");
  expect(view.getByText("11月3日的本机记录")).toBeInTheDocument();
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith([previousTrack]);
  expect(view.getByRole("button", { name: "11月8日，3小时52分" })).toBeInTheDocument();

  fireEvent.click(view.getByRole("button", { name: "刷新听歌足迹" }));
  expect(mocks.trendReload).toHaveBeenCalledOnce();
  expect(mocks.summaryReload).toHaveBeenCalledOnce();
  expect(view.getByLabelText("选中日期数据")).toHaveTextContent("11月3日 · 4小时36分");
  fireEvent.click(view.getByRole("button", { name: "查看整周" }));
  expect(mocks.weekTrend.mock.calls.at(-1)![0]).toMatchObject({ active: true });
  expect(view.getByLabelText("日均收听时长")).toHaveTextContent("3小时35分");
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith(rankTracks);
  expect(mocks.ranked.mock.calls.at(-1)![0]).toMatchObject({ active: true, period: "week" });
  fireEvent.click(view.getByRole("button", { name: "刷新听歌足迹" }));
  expect(mocks.trendReload).toHaveBeenCalledTimes(2);
  fireEvent.click(view.getByRole("tab", { name: "本月" }));
  expect(mocks.weekTrend.mock.calls.at(-1)![0]).toMatchObject({ active: false });
});

it("reports selected historical duration loading and failure without changing the local song list", () => {
  vi.setSystemTime(new Date(2026, 10, 9, 12));
  mocks.weekTrend.mockReturnValue({
    details: rollingWeekDetails.map((item) => ({
      ...item,
      duration: item.previousWeek ? undefined : item.duration
    })),
    loading: true,
    failed: false,
    reload: mocks.trendReload
  });
  const previousTrack = {
    ...localTrack,
    time: new Date(2026, 10, 3, 14).getTime()
  } as NeteaseHistoryRecord;
  const view = openReport({
    initialPeriod: "week",
    initialDay: "2026-11-03",
    historyRecords: [previousTrack],
    variant: "page"
  });
  expect(view.getByLabelText("选中日期数据")).toHaveTextContent("11月3日 · —补充上周数据中");
  const chart = within(view.getByRole("figure", { name: "每日收听时长" }));
  expect(chart.getAllByRole("button")).toHaveLength(7);
  expect(chart.getByRole("button", { name: "11月3日（上周），暂未获取" })).toBeInTheDocument();
  expect(chart.queryByRole("button", { name: "11月3日（上周），0分钟" })).not.toBeInTheDocument();
  expect(view.getByRole("button", { name: "刷新听歌足迹" })).toBeDisabled();
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith([previousTrack]);
  mocks.weekTrend.mockReturnValue({
    details: rollingWeekDetails.map((item) => ({
      ...item,
      duration: item.previousWeek ? undefined : item.duration
    })),
    loading: false,
    failed: true,
    reload: mocks.trendReload
  });
  view.rerender(<ListeningFootprint {...view.props} />);
  expect(view.getByText("上周统计暂未更新")).toBeInTheDocument();
  expect(view.getByRole("button", { name: "刷新听歌足迹" })).toBeEnabled();
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith([previousTrack]);
});

it("keeps a one-day natural week in the rolling chart instead of auto-selecting the day", () => {
  vi.setSystemTime(new Date(2026, 10, 8, 12));
  const currentDay = detail("2026-11-08", 232);
  mocks.summary.mockReturnValue(
    summary({
      week: {
        total: 232,
        today: currentDay,
        details: [currentDay],
        weekDays: 1,
        todayTrackCount: 50
      }
    })
  );
  mocks.weekTrend.mockReturnValue({
    details: [
      { period: "2026-11-02", duration: 247, previousWeek: true },
      ...rollingWeekDetails.slice(0, 6)
    ],
    loading: false,
    failed: false,
    reload: mocks.trendReload
  });
  const view = openReport({ initialPeriod: "week" });
  expect(
    within(view.getByRole("figure", { name: "每日收听时长" })).getAllByRole("button")
  ).toHaveLength(7);
  expect(view.getByLabelText("日均收听时长")).toHaveTextContent("本周日均 3小时52分");
  expect(view.queryByLabelText("选中日期数据")).not.toBeInTheDocument();
  expect(view.getByText("本周播放排行")).toBeInTheDocument();
  expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith(rankTracks);
  expect(mocks.ranked.mock.calls.at(-1)![0]).toMatchObject({ active: true });
});

it.each([
  { initialPeriod: "today", active: true },
  { initialPeriod: "month", active: true },
  { initialPeriod: "week", active: false }
] as const)(
  "does not enable historical week requests for $initialPeriod when active=$active",
  (scope) => {
    vi.setSystemTime(new Date(2026, 10, 9, 12));
    openReport({ ...scope, initialDay: "2026-11-03" });
    expect(mocks.weekTrend.mock.calls.at(-1)![0]).toMatchObject({ active: false });
  }
);

it("renders a page heading and keeps inactive pages from starting cloud work", () => {
  const view = openReport({ variant: "page", initialPeriod: "week", active: false });
  expect(view.getByRole("heading", { name: "听歌足迹", level: 1 })).toBeInTheDocument();
  expect(view.getByRole("figure", { name: "每日收听时长" })).toHaveClass("h-[150px]");
  expect(view.getByText("近7天收听分布与本周前20首歌曲排行")).toBeInTheDocument();
  expect(mocks.summary.mock.calls.at(-1)![1]).toBe(false);
  expect(mocks.today.mock.calls.at(-1)![0]).toMatchObject({ active: false });
  expect(mocks.ranked.mock.calls.at(-1)![0]).toMatchObject({ active: false });
  view.rerender(<ListeningFootprint {...view.props} variant="page" active />);
  expect(mocks.summary.mock.calls.at(-1)![1]).toBe(true);
  expect(mocks.ranked.mock.calls.at(-1)![0]).toMatchObject({ active: true });
});

it("rolls the active report across midnight and catches up after being inactive", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 7, 23, 59, 59));
  const view = openReport({ initialPeriod: "week" });
  expect(mocks.weekTrend.mock.calls.at(-1)![0]).toMatchObject({ date: "2026-11-07", active: true });
  expect(mocks.summary.mock.calls.at(-1)![0]).toBe(0);
  expect(vi.getTimerCount()).toBe(1);

  act(() => vi.advanceTimersByTime(1_000));
  expect(mocks.weekTrend.mock.calls.at(-1)![0]).toMatchObject({ date: "2026-11-08", active: true });
  expect(mocks.summary.mock.calls.at(-1)![0]).toBe(1);
  expect(vi.getTimerCount()).toBe(1);
  view.rerender(<ListeningFootprint {...view.props} active={false} />);
  expect(vi.getTimerCount()).toBe(0);

  act(() => vi.advanceTimersByTime(86_400_000));
  expect(mocks.summary.mock.calls.at(-1)![0]).toBe(1);
  view.rerender(<ListeningFootprint {...view.props} active />);
  expect(mocks.weekTrend.mock.calls.at(-1)![0]).toMatchObject({ date: "2026-11-09", active: true });
  expect(mocks.summary.mock.calls.at(-1)![0]).toBe(2);
  expect(vi.getTimerCount()).toBe(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it.each([true, false])(
  "returns to the weekly rank when the selected oldest day expires, active across midnight=%s",
  (staysActive) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 9, 23, 59, 59));
    rollingAcrossMidnight();
    const previousTrack = {
      ...localTrack,
      time: new Date(2026, 10, 3, 14).getTime()
    } as NeteaseHistoryRecord;
    const view = openReport({
      initialPeriod: "week",
      historyRecords: [previousTrack]
    });
    fireEvent.click(view.getByRole("button", { name: "11月3日（上周），4小时36分" }));
    expect(view.getByLabelText("选中日期数据")).toHaveTextContent("11月3日 · 4小时36分");
    expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith([previousTrack]);
    if (!staysActive) view.rerender(<ListeningFootprint {...view.props} active={false} />);

    act(() => vi.advanceTimersByTime(1_000));
    if (!staysActive) view.rerender(<ListeningFootprint {...view.props} active />);

    expect(mocks.weekTrend.mock.calls.at(-1)![0]).toMatchObject({ date: "2026-11-10" });
    expect(view.queryByLabelText("选中日期数据")).not.toBeInTheDocument();
    expect(view.queryByText("11月3日的本机记录")).not.toBeInTheDocument();
    expect(view.getByText("本周播放排行")).toBeInTheDocument();
    expect(view.props.onTracksLoaded).toHaveBeenLastCalledWith(rankTracks);
    expect(view.props.onScopeChange).toHaveBeenLastCalledWith({ period: "week" });
    expect(mocks.ranked.mock.calls.at(-1)![0]).toMatchObject({ active: true, period: "week" });
  }
);

it.each([
  { period: "week", selected: "2026-11-04", expected: "11月4日 · 8小时23分" },
  { period: "month", selected: "2026-11-01", expected: "11月1日 · 2小时40分" }
] as const)(
  "retains the valid $period selection across midnight",
  ({ period, expected, selected }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 9, 23, 59, 59));
    rollingAcrossMidnight();
    const view = openReport({ initialPeriod: period, initialDay: selected });
    expect(view.getByLabelText("选中日期数据")).toHaveTextContent(expected);
    act(() => vi.advanceTimersByTime(1_000));
    expect(view.getByLabelText("选中日期数据")).toHaveTextContent(expected);
    expect(view.props.onScopeChange).toHaveBeenLastCalledWith({ period, day: selected });
  }
);

it("keeps a handed-off historical date while the rolling chart is loading", () => {
  vi.setSystemTime(new Date(2026, 10, 9, 12));
  mocks.weekTrend.mockReturnValue({
    details: [],
    loading: true,
    failed: false,
    reload: mocks.trendReload
  });
  const view = openReport({ initialPeriod: "week", initialDay: "2026-11-03" });
  expect(view.getByLabelText("选中日期数据")).toHaveTextContent("11月3日 · —");
  expect(view.props.onScopeChange).toHaveBeenLastCalledWith({ period: "week", day: "2026-11-03" });

  rollingAcrossMidnight();
  view.rerender(<ListeningFootprint {...view.props} />);
  expect(view.getByLabelText("选中日期数据")).toHaveTextContent("11月3日 · 4小时36分");
  expect(view.props.onScopeChange).toHaveBeenLastCalledWith({ period: "week", day: "2026-11-03" });
});

it("does not discard an external historical date that was already outside the rolling window", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 9, 23, 59, 59));
  rollingAcrossMidnight();
  const view = openReport({ initialPeriod: "week", initialDay: "2026-11-01" });
  expect(view.getByLabelText("选中日期数据")).toHaveTextContent("11月1日 · —");
  act(() => vi.advanceTimersByTime(1_000));
  expect(view.getByLabelText("选中日期数据")).toHaveTextContent("11月1日 · —");
  expect(view.props.onScopeChange).toHaveBeenLastCalledWith({ period: "week", day: "2026-11-01" });
});

it("keeps the generic drawer shell independent of players", () => {
  const onPageAction = vi.fn();
  const drawer = createListeningFootprintDrawer({ content: <p>远程实时足迹</p>, onPageAction });
  expect(drawer).toMatchObject({
    title: "听歌足迹",
    width: 480,
    resizable: { minWidth: 420, maxWidth: 640 }
  });
  const view = render(
    <>
      {drawer.content}
      {drawer.headerActions}
    </>
  );
  expect(view.getByText("远程实时足迹")).toBeInTheDocument();
  fireEvent.click(view.getByRole("button", { name: "展开听歌足迹" }));
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(onPageAction).toHaveBeenCalledOnce();
  expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(
    onPageAction.mock.invocationCallOrder[0]!
  );
});

it("refreshes the current drawer scope from its header without resetting the selected date", () => {
  const { props } = playerDrawerProps({ initialPeriod: "week", onPageAction: vi.fn() });
  const drawer = createPlayerListeningFootprintDrawer(props);
  const view = render(
    <>
      <header>{drawer.headerActions}</header>
      <main>{drawer.content}</main>
    </>
  );
  expect(
    [...view.container.querySelectorAll("header button")].map((button) =>
      button.getAttribute("aria-label")
    )
  ).toEqual(["刷新听歌足迹", "展开听歌足迹"]);
  expect(view.container.querySelectorAll("main button[aria-label='刷新听歌足迹']")).toHaveLength(0);
  fireEvent.click(view.getByRole("button", { name: "刷新听歌足迹" }));
  expect(mocks.summaryReload).toHaveBeenCalledOnce();
  expect(mocks.rankReload).toHaveBeenCalledOnce();
  fireEvent.click(view.getByRole("button", { name: "11月5日，2小时40分" }));
  fireEvent.click(view.getByRole("button", { name: "刷新听歌足迹" }));
  expect(mocks.summaryReload).toHaveBeenCalledTimes(2);
  expect(mocks.rankReload).toHaveBeenCalledOnce();
  expect(view.getByLabelText("选中日期数据")).toHaveTextContent("11月5日 · 2小时40分");
  expect(view.getByRole("tab", { name: "本周" })).toHaveAttribute("aria-selected", "true");
});

it("honors period entries when creating the player drawer again through its provider", async () => {
  const { props, historyListeners } = playerDrawerProps();
  const view = render(
    <>
      <button
        onClick={() =>
          AppDrawer._create(createPlayerListeningFootprintDrawer, {
            ...props,
            initialPeriod: "week"
          })
        }>
        从本周打开
      </button>
      <button
        onClick={() =>
          AppDrawer._create(createPlayerListeningFootprintDrawer, {
            ...props,
            initialPeriod: "month"
          })
        }>
        从本月打开
      </button>
      <AppDrawer.Provider />
    </>
  );
  fireEvent.click(view.getByRole("button", { name: "从本周打开" }));
  await waitFor(() =>
    expect(view.getByRole("tab", { name: "本周" })).toHaveAttribute("aria-selected", "true")
  );
  fireEvent.click(view.getByRole("tab", { name: "今日" }));
  fireEvent.click(view.getByRole("button", { name: "从本周打开" }));
  await waitFor(() => expect(view.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(view.getByRole("button", { name: "从本周打开" }));
  await waitFor(() =>
    expect(view.getByRole("tab", { name: "本周" })).toHaveAttribute("aria-selected", "true")
  );
  fireEvent.click(view.getByRole("button", { name: "从本月打开" }));
  await waitFor(() =>
    expect(view.getByRole("tab", { name: "本月" })).toHaveAttribute("aria-selected", "true")
  );
  expect(view.getByText("本月播放排行")).toBeInTheDocument();
  view.unmount();
  expect(historyListeners.size).toBe(0);
});

it("subscribes to real player history in the adapter and expands with its latest daily scope", () => {
  const onPageAction = vi.fn();
  const { props, historyRecords, historyListeners } = playerDrawerProps({
    initialPeriod: "week",
    onPageAction
  });
  const drawer = createPlayerListeningFootprintDrawer(props);
  const view = render(
    <>
      {drawer.content}
      {drawer.headerActions}
    </>
  );
  fireEvent.click(view.getByRole("button", { name: "11月5日，2小时40分" }));
  const secondLocal = { ...localTrack, id: 10 } as NeteaseHistoryRecord;
  act(() => {
    historyRecords.push(secondLocal);
    historyListeners.forEach((listener) => listener());
  });
  expect(props.onTracksLoaded).toHaveBeenLastCalledWith([localTrack, secondLocal]);
  fireEvent.click(view.getByRole("button", { name: "展开听歌足迹" }));
  expect(onPageAction).toHaveBeenCalledWith({ period: "week", day: "2026-11-05" });
  fireEvent.click(view.getByRole("button", { name: "查看歌曲专辑" }));
  expect(props.onClickAlbum).toHaveBeenCalledWith(17);
  expect(mocks.close).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(historyListeners.size).toBe(0);
});
