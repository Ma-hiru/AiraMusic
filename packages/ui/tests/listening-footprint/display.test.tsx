import { useImperativeHandle } from "react";
import { useLocation, RouterProvider, createMemoryRouter } from "react-router-dom";
import { act, render, within, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/common/routes";
import { useDisplayListeningFootprint } from "@mahiru/ui/wins/display/hooks/use-display-listening-footprint";
import {
  NeteaseTrack,
  NeteaseTrackRecord,
  NeteaseHistoryRecord
} from "@mahiru/ui/common/netease/models";
import LayoutDisplay from "@mahiru/ui/wins/display/pages/layout";
import AppDrawer from "@mahiru/ui/common/components/display/drawer/use";
import ListeningFootprint from "@mahiru/ui/common/components/page/listening-footprint";
import ListeningFootprintDisplay from "@mahiru/ui/wins/display/pages/listening-footprint";
import ListeningFootprintControl from "@mahiru/ui/wins/display/pages/layout/listening-footprint-control";
import type { ReactNode } from "react";
import type { MessageData } from "@mahiru/ipc/types";
import type { ListeningFootprintProps } from "@mahiru/ui/common/components/page/listening-footprint";

const mocks = vi.hoisted(() => {
  const channel = <T,>(type: string) => ({
    type,
    data: null as T | null,
    listeners: new Set<() => void>(),
    deliver: vi.fn(),
    addListener(callback: () => void) {
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
    },
    publish(data: T) {
      this.data = data;
      for (const callback of this.listeners) callback();
    }
  });
  const focusListeners = new Set<() => void>();
  const bus = {
    trackMeta: channel<MessageData<"bus_deliver_track_meta">>("trackMeta"),
    history: channel<MessageData<"bus_deliver_history">>("history"),
    display: channel<MessageData<"bus_display">[]>("display"),
    modified: channel<MessageData<"bus_modify_source">[]>("modified"),
    updater: { deliver: vi.fn() },
    playlistAction: { deliver: vi.fn() },
    comment: { deliver: vi.fn() },
    consume: vi.fn((type: string) => {
      if (type === "display") bus.display.data = [];
      if (type === "modified") bus.modified.data = [];
    })
  };
  return {
    bus,
    focusListeners,
    focusSubscription: vi.fn((type: string, callback: () => void) => {
      if (type === "focus") focusListeners.add(callback);
      return () => focusListeners.delete(callback);
    }),
    focus: vi.fn(),
    commentReady: vi.fn(),
    contentRender: vi.fn(),
    refresh: vi.fn(),
    registerTitle: vi.fn(),
    setTitle: vi.fn()
  };
});

vi.mock("@/common/lib/bus", () => ({ RendererIPCMessageBus: mocks.bus }));
vi.mock("@/common/lib/window", () => ({
  RendererWindow: {
    current: { addEventListener: mocks.focusSubscription, focus: mocks.focus },
    comment: { reactReadyAwait: mocks.commentReady }
  }
}));
vi.mock("@/common/lib/device", () => ({ RendererDevice: { platform: Promise.resolve("darwin") } }));
vi.mock("@/common/lib/modified", () => ({ RendererModified: { mark: vi.fn() } }));
vi.mock("@/common/components/display/toast", () => ({
  default: { show: vi.fn(), Provider: () => null }
}));
vi.mock("@/common/components/display/menu/track-menu", () => ({ createTrackContextMenu: vi.fn() }));
vi.mock("@/wins/display/hooks/use-display-title", () => ({
  useDisplayTitleRegister: (page: string, title: string) => {
    mocks.registerTitle(page, title);
    return { setTitle: mocks.setTitle };
  }
}));
vi.mock("@/common/components/page/listening-footprint", () => ({
  default: function MockListeningFootprint(props: ListeningFootprintProps) {
    useImperativeHandle(props.actionsRef, () => ({ refresh: mocks.refresh }));
    mocks.contentRender(props);
    return (
      <section aria-label="远程听歌足迹" data-variant={props.variant}>
        <output aria-label="当前歌曲">{props.activeTrackID ?? "无"}</output>
        <button onClick={() => props.onScopeChange?.({ period: "month", day: "2026-11-02" })}>
          选择足迹日期
        </button>
      </section>
    );
  }
}));
vi.mock("@/wins/display/pages/layout/title", () => ({ default: () => null }));
vi.mock("@/wins/display/pages/layout/float", () => ({ default: () => null }));
vi.mock("@/wins/display/pages/layout/background", () => ({ default: () => null }));
vi.mock("@/wins/display/pages/layout/play-list-control", () => ({ default: () => null }));
vi.mock("@/common/components/other/keep-alive-outlet", () => ({ default: () => null }));
vi.mock("@/common/components/fallback/app-error-boundary", () => ({
  default: ({ children }: { children: ReactNode }) => children
}));
vi.mock("@/common/components/layout/drag/drag", () => ({
  default: ({ children }: { children: ReactNode }) => children
}));
vi.mock("@/common/components/layout/top/back", () => ({ default: () => null }));
vi.mock("@/common/components/layout/top/control", () => ({
  default: ({ appends }: { appends: ReactNode }) => (
    <section aria-label="窗口控制">{appends}</section>
  )
}));

type HistorySnapshot = MessageData<"bus_deliver_history">;
function record(id: number, sourceName: NeteaseTrackRecordSourceType = "playlist") {
  return {
    id,
    sourceName,
    name: `Song ${id}`,
    sourceID: 100 + id,
    time: Date.UTC(2026, 10, id),
    playDuration: 90,
    detail: {
      id,
      name: `Song ${id}`,
      ar: [{ id: 10 + id, name: `Artist ${id}` }],
      al: { id: 20 + id, name: `Album ${id}` },
      alia: [],
      tns: [],
      dt: 180_000
    } as unknown as NeteaseTrackModel
  } satisfies HistorySnapshot["list"][number];
}
const first = record(1);
const second = record(2, "album");
const latest = () => mocks.contentRender.mock.lastCall![0] as ListeningFootprintProps;

function HookHarness() {
  const location = useLocation();
  const props = useDisplayListeningFootprint(location.pathname !== "/inactive");
  return <ListeningFootprint {...props} variant="drawer" />;
}

function LocationOutput() {
  const location = useLocation();
  return <output aria-label="当前路由">{location.pathname + location.search}</output>;
}

const routers: ReturnType<typeof createMemoryRouter>[] = [];
function setup(element: ReactNode, entries = [RoutePathDisplay.album as string]) {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <>
            {element}
            <LocationOutput />
          </>
        )
      }
    ],
    { initialEntries: entries, initialIndex: entries.length - 1 }
  );
  routers.push(router);
  return { ...render(<RouterProvider router={router} />), router };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bus.history.data = { list: structuredClone([first, second]) };
  mocks.bus.trackMeta.data = {
    track: structuredClone(first),
    status: "paused",
    playlistMarkId: "main-queue",
    repeat: "all",
    shuffle: false,
    rmActive: false,
    tlActive: false,
    noteActive: false,
    lyric: null,
    mode: "normal"
  };
  mocks.bus.display.data = [];
  mocks.bus.modified.data = [];
  mocks.commentReady.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  for (const router of routers.splice(0)) router.dispose();
  mocks.focusListeners.clear();
  RoutePath.queryCache.clear();
  vi.restoreAllMocks();
});

it("reads live history and track snapshots and requests only footprint data while active", async () => {
  const view = setup(<HookHarness />);
  expect(latest().historyRecords[0]).toBeInstanceOf(NeteaseHistoryRecord);
  expect(latest().historyRecords[0]!.detail).toBeInstanceOf(NeteaseTrack);
  expect(mocks.bus.updater.deliver.mock.calls.map(([type]) => type)).toEqual([
    "track-meta",
    "history"
  ]);
  const revision = latest().historyRevision!;
  const history = { list: structuredClone([second]) };
  act(() => {
    mocks.bus.history.publish(history);
    mocks.bus.trackMeta.publish({ ...mocks.bus.trackMeta.data!, track: structuredClone(second) });
  });
  expect(latest().historyRecords.map((track) => track.id)).toEqual([2]);
  expect(latest().historyRevision).toBe(revision + 1);
  expect(view.getByLabelText("当前歌曲")).toHaveTextContent("2");
  act(() => mocks.bus.history.publish(history));
  expect(latest().historyRevision).toBe(revision + 1);
  act(() => {
    for (const listener of mocks.focusListeners) listener();
  });
  expect(mocks.bus.updater.deliver.mock.calls.map(([type]) => type)).toEqual([
    "track-meta",
    "history",
    "track-meta",
    "history"
  ]);
  await act(async () => {
    await view.router.navigate("/inactive");
  });
  expect(mocks.bus.history.listeners.size).toBe(0);
  expect(mocks.bus.trackMeta.listeners.size).toBe(0);
  expect(mocks.focusListeners.size).toBe(0);
  expect(latest().active).toBe(false);
  await act(async () => {
    await view.router.navigate(RoutePathDisplay.album);
  });
  expect(mocks.bus.updater.deliver).toHaveBeenCalledTimes(6);
  view.unmount();
  expect(mocks.bus.history.listeners.size).toBe(0);
  expect(mocks.focusListeners.size).toBe(0);
});

it("plays the current complete report scope and preserves display comment and queue actions", async () => {
  const view = setup(<HookHarness />);
  const tracks = [second, first].map(NeteaseTrackRecord.fromRecordObject);
  act(() => latest().onPlay(tracks[0]!, 0));
  expect(mocks.bus.playlistAction.deliver).not.toHaveBeenCalled();
  act(() => {
    latest().onTracksLoaded?.(tracks);
    latest().onPlay(tracks[1]!, 99);
  });
  expect(mocks.bus.playlistAction.deliver).toHaveBeenLastCalledWith({
    type: "replacePlaylistAndPlay",
    sourceType: "other",
    detailType: "history",
    sourceID: 0,
    allIDs: [2, 1],
    trackIdx: 1,
    trackID: 1
  });
  act(() => {
    latest().onTracksLoaded?.([tracks[0]!]);
    latest().onPlay(tracks[1]!, 0);
  });
  expect(mocks.bus.playlistAction.deliver).toHaveBeenCalledOnce();
  await act(async () => {
    latest().addToPlaylistLast(tracks[0]!);
    latest().addToPlaylistNext(tracks[0]!);
    await latest().openComment(tracks[0]!);
    latest().onClickAlbum(22);
  });
  expect(mocks.bus.playlistAction.deliver).toHaveBeenCalledWith({
    type: "addToPlaylistLast",
    sourceType: "album",
    sourceID: 102,
    trackID: 2
  });
  expect(mocks.bus.playlistAction.deliver).toHaveBeenCalledWith({
    type: "addToPlaylistNext",
    sourceType: "album",
    sourceID: 102,
    trackID: 2
  });
  expect(mocks.commentReady).toHaveBeenCalledOnce();
  expect(mocks.bus.comment.deliver).toHaveBeenCalledExactlyOnceWith({ type: "track", id: 2 });
  expect(view.getByLabelText("当前路由")).toHaveTextContent(
    RoutePath.withQuery(RoutePathDisplay.album, { id: 22 })
  );
});

it("keeps an opened drawer live, expands its selected scope and hides the page's top entry", async () => {
  const view = setup(
    <>
      <ListeningFootprintControl />
      <AppDrawer.Provider />
    </>
  );
  fireEvent.click(view.getByRole("button", { name: "听歌足迹" }));
  expect(await view.findByRole("dialog", { name: "听歌足迹" })).toBeInTheDocument();
  expect(
    [...view.getByRole("dialog").querySelectorAll("header button")].map((button) =>
      button.getAttribute("aria-label")
    )
  ).toEqual(["刷新听歌足迹", "展开听歌足迹", "关闭抽屉"]);
  fireEvent.click(view.getByRole("button", { name: "刷新听歌足迹" }));
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(latest().variant).toBe("drawer");
  const revision = latest().historyRevision!;
  act(() => mocks.bus.history.publish({ list: structuredClone([second]) }));
  expect(latest().historyRevision).toBe(revision + 1);
  fireEvent.click(view.getByRole("button", { name: "选择足迹日期" }));
  fireEvent.click(view.getByRole("button", { name: "展开听歌足迹" }));
  await waitFor(() =>
    expect(view.getByLabelText("当前路由")).toHaveTextContent(
      RoutePath.withQuery(RoutePathDisplay.listeningFootprint, {
        period: "month",
        day: "2026-11-02"
      })
    )
  );
  expect(AppDrawer.__visibleGetter()).toBe(false);
  expect(view.queryByRole("button", { name: "听歌足迹" })).not.toBeInTheDocument();
  await waitFor(() => expect(mocks.bus.history.listeners.size).toBe(0));
});

it("opens the independent page from encoded scope and follows updated scope queries", async () => {
  const path = RoutePath.withQuery(RoutePathDisplay.listeningFootprint, {
    period: "week",
    day: "2026-11-01"
  });
  const view = setup(<ListeningFootprintDisplay />, [RoutePathDisplay.album, path]);
  await waitFor(() => expect(latest().active).toBe(true));
  expect(latest()).toMatchObject({
    initialPeriod: "week",
    initialDay: "2026-11-01",
    variant: "page"
  });
  expect(mocks.registerTitle).toHaveBeenCalledWith("listeningFootprint", "听歌足迹");
  const target = RoutePath.withQuery(RoutePathDisplay.listeningFootprint, {
    period: "month",
    day: "2026-11-02"
  });
  await act(async () => {
    await view.router.navigate(target);
  });
  expect(latest()).toMatchObject({
    initialPeriod: "month",
    initialDay: "2026-11-02",
    variant: "page"
  });
  expect(view.queryByRole("button", { name: "合并主窗口" })).not.toBeInTheDocument();
  expect(mocks.bus.display.deliver).not.toHaveBeenCalled();
});

it("places the footprint icon inside Control.appends and routes incoming footprint actions", async () => {
  const view = setup(<LayoutDisplay />);
  expect(
    within(view.getByRole("region", { name: "窗口控制" })).getByRole("button", { name: "听歌足迹" })
  ).toBeInTheDocument();
  act(() =>
    mocks.bus.display.publish([{ type: "listening-footprint", period: "month", day: "2026-11-02" }])
  );
  await waitFor(() =>
    expect(view.getByLabelText("当前路由")).toHaveTextContent(
      RoutePath.withQuery(RoutePathDisplay.listeningFootprint, {
        period: "month",
        day: "2026-11-02"
      })
    )
  );
  expect(mocks.focus).toHaveBeenCalledOnce();
  expect(view.queryByRole("button", { name: "听歌足迹" })).not.toBeInTheDocument();
});
