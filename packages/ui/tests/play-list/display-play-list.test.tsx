import { act, render, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { useLocation, RouterProvider, createMemoryRouter } from "react-router-dom";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/common/routes";
import { PlayListQueue } from "@mahiru/ui/common/components/page/play-list";
import { NeteaseTrack, NeteaseTrackRecord } from "@mahiru/ui/common/netease/models";
import { useDisplayPlayList } from "@mahiru/ui/wins/display/hooks/use-display-play-list";
import PlayListDisplay from "@mahiru/ui/wins/display/pages/play-list";
import AppDrawer from "@mahiru/ui/common/components/display/drawer/use";
import PlayListControl from "@mahiru/ui/wins/display/pages/layout/play-list-control";
import type { MessageData } from "@mahiru/ipc/types";
import type { PlayListQueueProps } from "@mahiru/ui/common/components/page/play-list";

const mocks = vi.hoisted(() => {
  const channel = <T,>() => ({
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
  return {
    bus: {
      playList: channel<MessageData<"bus_deliver_play_list">>(),
      playListPosition: channel<MessageData<"bus_deliver_play_list_position">>(),
      trackMeta: channel<MessageData<"bus_deliver_track_meta">>(),
      progress: channel<MessageData<"bus_deliver_track_progress">>(),
      history: channel<MessageData<"bus_deliver_history">>(),
      updater: { deliver: vi.fn() },
      playlistAction: { deliver: vi.fn() },
      comment: { deliver: vi.fn() }
    },
    focusListeners,
    focusSubscription: vi.fn((type: string, callback: () => void) => {
      if (type === "focus") focusListeners.add(callback);
      return () => focusListeners.delete(callback);
    }),
    commentReady: vi.fn(),
    queueRender: vi.fn(),
    pageRender: vi.fn(),
    setTitle: vi.fn()
  };
});

vi.mock("@/common/lib/bus", () => ({ RendererIPCMessageBus: mocks.bus }));
vi.mock("@/common/lib/window", () => ({
  RendererWindow: {
    current: { addEventListener: mocks.focusSubscription },
    comment: { reactReadyAwait: mocks.commentReady }
  }
}));
vi.mock("@/common/components/display/toast", () => ({ default: { show: vi.fn() } }));
vi.mock("@/common/components/display/menu/track-menu", () => ({
  createTrackContextMenu: vi.fn()
}));
vi.mock("@/wins/display/hooks/use-display-title", () => ({
  useDisplayTitleRegister: () => ({ setTitle: mocks.setTitle })
}));
vi.mock("@/common/components/page/play-list", async () => {
  const { createElement } = await import("react");
  function Queue(props: PlayListQueueProps) {
    mocks.queueRender(props);
    return createElement(
      "section",
      { "aria-label": "远程队列" },
      createElement("output", { "aria-label": "当前歌曲" }, props.activeTrack?.name ?? "无"),
      createElement("output", { "aria-label": "当前位置" }, props.activeIndex),
      createElement("output", { "aria-label": "播放状态" }, props.status),
      props.progress,
      ...props.tracks.map((track, index) =>
        createElement(
          "button",
          { key: track.id, onClick: () => props.onPlay(track, index) },
          `播放 ${track.name}`
        )
      )
    );
  }
  return {
    PlayListQueue: Queue,
    default: (props: PlayListQueueProps & { statsRevision: number }) => {
      mocks.pageRender(props);
      return createElement(Queue, props);
    }
  };
});
vi.mock("@/common/components/page/play-list/queue", async () => ({
  default: (await import("@mahiru/ui/common/components/page/play-list")).PlayListQueue
}));

const record = (
  id: number,
  name: string,
  sourceName: NeteaseTrackRecordSourceType = "playlist"
) => ({
  id,
  name,
  sourceID: id + 100,
  sourceName,
  detail: {
    id,
    name,
    ar: [{ id: id + 10, name: `Artist ${id}` }],
    al: { id: id + 20, name: `Album ${id}` },
    alia: [],
    tns: [],
    dt: 180_000
  } as unknown as NeteaseTrackModel
});
const first = record(1, "First");
const second = record(2, "Second", "album");
const snapshot = (
  list = [first, second],
  position = 0,
  version = 1,
  sequence = 1,
  senderId = "main-sender"
) => ({
  list: structuredClone(list),
  position,
  markId: "full-queue",
  senderId,
  version,
  sequence
});
const latestQueue = () => mocks.queueRender.mock.lastCall?.[0] as PlayListQueueProps;

function HookHarness({ onJumpPage, active = true }: { active?: boolean; onJumpPage?: NormalFunc }) {
  const props = useDisplayPlayList(active, onJumpPage);
  const location = useLocation();
  return (
    <>
      <output data-testid="location">{location.pathname + location.search}</output>
      <PlayListQueue {...props} />
    </>
  );
}

function ActiveHookHarness() {
  const location = useLocation();
  return <HookHarness active={location.pathname !== "/inactive"} />;
}

const routers: ReturnType<typeof createMemoryRouter>[] = [];
function setup(element = <HookHarness />, path = RoutePathDisplay.album as string) {
  const router = createMemoryRouter([{ path: "*", element }], { initialEntries: [path] });
  routers.push(router);
  return { ...render(<RouterProvider router={router} />), router };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bus.playList.data = snapshot();
  mocks.bus.playListPosition.data = null;
  mocks.bus.trackMeta.data = {
    track: structuredClone(first),
    status: "paused",
    playlistMarkId: "full-queue",
    repeat: "all",
    shuffle: false,
    rmActive: false,
    tlActive: false,
    noteActive: false,
    lyric: null,
    mode: "normal"
  };
  mocks.bus.progress.data = { currentTime: 65, duration: 180, buffered: 0, volume: 1 };
  mocks.bus.history.data = { list: [] };
  mocks.commentReady.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  for (const router of routers.splice(0)) router.dispose();
  mocks.focusListeners.clear();
  vi.restoreAllMocks();
});

it("rebuilds received snapshots into records and plays the main queue without replacing its scope", () => {
  const view = setup();
  const channel = mocks.bus.playList;
  const originalRecord = latestQueue().tracks[0];
  expect(originalRecord).toBeInstanceOf(NeteaseTrackRecord);
  expect(originalRecord?.detail).toBeInstanceOf(NeteaseTrack);

  act(() => {
    channel.publish(snapshot([second, first], 1));
    mocks.bus.trackMeta.publish({
      ...mocks.bus.trackMeta.data!,
      track: structuredClone(second),
      status: "playing"
    });
  });
  expect(mocks.bus.playList).toBe(channel);
  expect(latestQueue().tracks.map((track) => track.id)).toEqual([2, 1]);
  expect(latestQueue().tracks[1]).not.toBe(originalRecord);
  expect(view.getByLabelText("当前位置")).toHaveTextContent("1");
  expect(view.getByLabelText("当前歌曲")).toHaveTextContent("Second");
  expect(view.getByLabelText("播放状态")).toHaveTextContent("playing");

  fireEvent.click(view.getByRole("button", { name: "播放 Second" }));
  expect(mocks.bus.playlistAction.deliver).toHaveBeenCalledExactlyOnceWith({
    type: "playTrack",
    trackID: 2
  });
  expect(channel.data?.list.map((track) => track.id)).toEqual([2, 1]);
  expect(channel.data?.markId).toBe("full-queue");
});

it("preserves queue source, comment and navigation actions", async () => {
  const onJumpPage = vi.fn();
  const view = setup(<HookHarness onJumpPage={onJumpPage} />);
  const track = latestQueue().tracks[1]!;
  await act(async () => {
    latestQueue().addToPlaylistLast(track);
    latestQueue().addToPlaylistNext(track);
    await latestQueue().openComment(track);
    latestQueue().onClickAlbum(22);
  });
  expect(mocks.bus.playlistAction.deliver.mock.calls.map(([action]) => action)).toEqual([
    { type: "addToPlaylistLast", sourceType: "album", sourceID: 102, trackID: 2 },
    { type: "addToPlaylistNext", sourceType: "album", sourceID: 102, trackID: 2 }
  ]);
  expect(mocks.commentReady).toHaveBeenCalledOnce();
  expect(mocks.bus.comment.deliver).toHaveBeenCalledExactlyOnceWith({ type: "track", id: 2 });
  expect(view.getByTestId("location")).toHaveTextContent(
    RoutePath.withQuery(RoutePathDisplay.album, { id: 22 })
  );
  expect(onJumpPage).toHaveBeenCalledOnce();
  act(() => latestQueue().onClickArtist(12));
  expect(view.getByTestId("location")).toHaveTextContent(
    RoutePath.withQuery(RoutePathDisplay.artist, { id: 12 })
  );
  expect(onJumpPage).toHaveBeenCalledTimes(2);
});

it("updates the active position without rebuilding received records", () => {
  const view = setup();
  const originalTracks = latestQueue().tracks;
  act(() => {
    mocks.bus.playListPosition.publish({
      version: 1,
      markId: "full-queue",
      senderId: "main-sender",
      position: 1,
      sequence: 2
    });
    mocks.bus.trackMeta.publish({ ...mocks.bus.trackMeta.data!, track: structuredClone(second) });
  });
  expect(view.getByLabelText("当前位置")).toHaveTextContent("1");
  expect(view.getByLabelText("当前歌曲")).toHaveTextContent("Second");
  expect(latestQueue().tracks).toBe(originalTracks);
  expect(latestQueue().tracks[0]).toBe(originalTracks[0]);
  expect(latestQueue().tracks[1]).toBe(originalTracks[1]);
});

it("ignores positions from a previous list version or another queue scope", () => {
  const view = setup();
  act(() => {
    mocks.bus.playListPosition.publish({
      version: 1,
      markId: "full-queue",
      senderId: "main-sender",
      position: 1,
      sequence: 2
    });
  });
  expect(view.getByLabelText("当前位置")).toHaveTextContent("1");

  act(() => mocks.bus.playList.publish(snapshot([second, first], 0, 2, 3)));
  expect(view.getByLabelText("当前位置")).toHaveTextContent("0");
  const currentTracks = latestQueue().tracks;
  for (const position of [
    { version: 1, markId: "full-queue", senderId: "main-sender", position: 1, sequence: 2 },
    { version: 2, markId: "other-queue", senderId: "main-sender", position: 1, sequence: 4 }
  ]) {
    act(() => mocks.bus.playListPosition.publish(position));
    expect(view.getByLabelText("当前位置")).toHaveTextContent("0");
    expect(latestQueue().tracks).toBe(currentTracks);
  }

  act(() =>
    mocks.bus.playListPosition.publish({
      version: 2,
      markId: "full-queue",
      senderId: "main-sender",
      position: 1,
      sequence: 5
    })
  );
  expect(view.getByLabelText("当前位置")).toHaveTextContent("1");
  expect(latestQueue().tracks).toBe(currentTracks);
});

it("orders full refreshes and position updates from the same queue by their sequence", () => {
  const view = setup();
  const previous = {
    version: 1,
    markId: "full-queue",
    senderId: "main-sender",
    position: 1,
    sequence: 2
  };
  act(() => mocks.bus.playListPosition.publish(previous));
  expect(view.getByLabelText("当前位置")).toHaveTextContent("1");

  act(() => mocks.bus.playList.publish(snapshot([first, second], 0, 1, 3)));
  expect(view.getByLabelText("当前位置")).toHaveTextContent("0");
  act(() => mocks.bus.playListPosition.publish(previous));
  expect(view.getByLabelText("当前位置")).toHaveTextContent("0");

  act(() => mocks.bus.playListPosition.publish({ ...previous, sequence: 4 }));
  expect(view.getByLabelText("当前位置")).toHaveTextContent("1");
  act(() => mocks.bus.playList.publish(snapshot([first, second], 0, 1, 3)));
  expect(view.getByLabelText("当前位置")).toHaveTextContent("1");
});

it("uses a reloaded sender's snapshot despite a higher cached sequence from the old sender", () => {
  const view = setup();
  const previous = {
    version: 1,
    markId: "full-queue",
    senderId: "main-sender",
    position: 1,
    sequence: 500
  };
  act(() => mocks.bus.playListPosition.publish(previous));
  expect(view.getByLabelText("当前位置")).toHaveTextContent("1");

  act(() => mocks.bus.playList.publish(snapshot([first, second], 0, 1, 1, "reloaded-main")));
  expect(view.getByLabelText("当前位置")).toHaveTextContent("0");
  const tracks = latestQueue().tracks;
  act(() => mocks.bus.playListPosition.publish({ ...previous, sequence: 501 }));
  expect(view.getByLabelText("当前位置")).toHaveTextContent("0");

  act(() =>
    mocks.bus.playListPosition.publish({
      version: 1,
      markId: "full-queue",
      senderId: "reloaded-main",
      position: 1,
      sequence: 2
    })
  );
  expect(view.getByLabelText("当前位置")).toHaveTextContent("1");
  expect(latestQueue().tracks).toBe(tracks);
});

it("updates progress independently of queue reconstruction", () => {
  const view = setup();
  expect(view.getByRole("timer", { name: "播放进度" })).toHaveTextContent("1:05/3:00");
  const renders = mocks.queueRender.mock.calls.length;
  act(() => mocks.bus.progress.publish({ currentTime: 72, duration: 180, buffered: 0, volume: 1 }));
  expect(view.getByRole("timer", { name: "播放进度" })).toHaveTextContent("1:12/3:00");
  expect(mocks.queueRender).toHaveBeenCalledTimes(renders);
});

it("requests fresh data on enter and focus, then releases inactive and unmounted subscriptions", async () => {
  const view = setup(<ActiveHookHarness />);
  const expected = ["play-list", "track-meta", "track-progress"];
  expect(mocks.bus.updater.deliver.mock.calls.map(([type]) => type)).toEqual(expected);
  act(() => {
    for (const callback of mocks.focusListeners) callback();
  });
  expect(mocks.bus.updater.deliver.mock.calls.map(([type]) => type)).toEqual([
    ...expected,
    ...expected
  ]);
  expect(mocks.bus.playList.listeners.size).toBe(1);
  expect(mocks.bus.playListPosition.listeners.size).toBe(1);
  expect(mocks.bus.trackMeta.listeners.size).toBe(1);
  expect(mocks.bus.progress.listeners.size).toBe(1);

  await act(async () => {
    await view.router.navigate("/inactive");
  });
  expect(mocks.bus.playList.listeners.size).toBe(0);
  expect(mocks.bus.playListPosition.listeners.size).toBe(0);
  expect(mocks.bus.trackMeta.listeners.size).toBe(0);
  expect(mocks.bus.progress.listeners.size).toBe(0);
  expect(mocks.focusListeners.size).toBe(0);
  expect(mocks.bus.updater.deliver).toHaveBeenCalledTimes(6);
  await act(async () => {
    await view.router.navigate(RoutePathDisplay.album);
  });
  expect(mocks.bus.updater.deliver).toHaveBeenCalledTimes(9);
  view.unmount();
  expect(mocks.bus.playList.listeners.size).toBe(0);
  expect(mocks.bus.playListPosition.listeners.size).toBe(0);
  expect(mocks.bus.progress.listeners.size).toBe(0);
  expect(mocks.focusListeners.size).toBe(0);
});

function ControlLayout() {
  const location = useLocation();
  return (
    <>
      <PlayListControl />
      <output data-testid="location">{location.pathname}</output>
      <AppDrawer.Provider />
    </>
  );
}

it("keeps an opened drawer subscribed without recreating it, then expands and hides its top entry", async () => {
  const create = vi.spyOn(AppDrawer, "_create");
  const view = setup(<ControlLayout />);
  fireEvent.click(view.getByRole("button", { name: "播放列表" }));
  expect(await view.findByRole("dialog", { name: "播放列表" })).toBeInTheDocument();
  expect(create).toHaveBeenCalledOnce();
  act(() => mocks.bus.playList.publish(snapshot([second], 0)));
  expect(view.getByRole("button", { name: "播放 Second" })).toBeInTheDocument();
  expect(view.queryByRole("button", { name: "播放 First" })).not.toBeInTheDocument();
  expect(create).toHaveBeenCalledOnce();

  fireEvent.click(view.getByRole("button", { name: "展开播放列表" }));
  await waitFor(() =>
    expect(view.getByTestId("location")).toHaveTextContent(RoutePathDisplay.playList)
  );
  expect(AppDrawer.__visibleGetter()).toBe(false);
  expect(view.queryByRole("button", { name: "播放列表" })).not.toBeInTheDocument();
  await waitFor(() => expect(mocks.bus.playList.listeners.size).toBe(0));
});

it("registers the dedicated page title and refreshes listening statistics from history only while active", async () => {
  const view = setup(<PlayListDisplay />, RoutePathDisplay.playList);
  await waitFor(() => expect(mocks.setTitle).toHaveBeenLastCalledWith("播放列表 2 首"));
  expect(mocks.pageRender.mock.lastCall?.[0].active).toBe(true);
  expect(mocks.bus.history.listeners.size).toBe(1);
  const revision = mocks.pageRender.mock.lastCall?.[0].statsRevision;
  act(() => mocks.bus.history.publish({ list: [] }));
  expect(mocks.pageRender.mock.lastCall?.[0].statsRevision).toBe(revision + 1);
  await act(async () => {
    await view.router.navigate(RoutePathDisplay.album);
  });
  await waitFor(() => expect(mocks.pageRender.mock.lastCall?.[0].active).toBe(false));
  expect(mocks.bus.history.listeners.size).toBe(0);
  expect(mocks.focusListeners.size).toBe(0);
});
