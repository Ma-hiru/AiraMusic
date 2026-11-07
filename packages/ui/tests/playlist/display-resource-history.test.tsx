import { act, render, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { useLocation, useNavigate, RouterProvider, createMemoryRouter } from "react-router-dom";
import { RoutePathMain } from "@mahiru/ui/common/routes";
import { useDisplayAction } from "@mahiru/ui/wins/main/hooks/use-display-action";
import Bus from "@mahiru/ui/wins/main/pages/layout/bus";
import type { MessageData } from "@mahiru/ipc/types";
import type { PlaylistScope } from "@mahiru/ui/common/types/playlist-scope";

type DisplayAction = MessageData<"bus_display">;

const mocks = vi.hoisted(() => {
  const channel = (type: string) => ({ type, data: [] as unknown[], deliver: vi.fn() });
  const noop = () => () => {};
  return {
    version: 0,
    listeners: new Set<() => void>(),
    scope: null as null | PlaylistScope,
    displayReady: vi.fn(),
    user: { likedPlaylist: { id: 100 } },
    output: { views: [], selected: "default", setDevice: vi.fn() },
    theme: {},
    bus: {
      progress: channel("progress"),
      trackMeta: channel("trackMeta"),
      theme: channel("theme"),
      history: channel("history"),
      playList: channel("playList"),
      playListPosition: channel("playListPosition"),
      output: channel("output"),
      updater: channel("updater"),
      modified: channel("modified"),
      playerAction: channel("playerAction"),
      playlistAction: channel("playlistAction"),
      playlistActionResult: channel("playlistActionResult"),
      display: channel("display"),
      consume: vi.fn()
    },
    player: {
      audio: {
        progress: {},
        outputTarget: "default",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      playlist: {
        listVersion: 1,
        mark_id: "empty-queue",
        list: () => [],
        pos: () => -1,
        addListener: noop
      },
      current: {},
      history: { list: [], addListener: noop },
      addListener: noop
    },
    window: {
      current: { focus: vi.fn() },
      display: { listenMessage: noop }
    },
    setAtom: vi.fn()
  };
});

vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useSetAtom: () => mocks.setAtom,
  useAtomValue: (atom: string) => (atom === "theme" ? mocks.theme : false)
}));
vi.mock("@/wins/main/atoms/theme", () => ({ themeAtom: "theme" }));
vi.mock("@/wins/main/atoms/track", () => ({
  fmModeAtom: "fm",
  intelligenceModeAtom: "intelligence"
}));
vi.mock("@/common/lib/log", () => ({ Log: { error: vi.fn() } }));
vi.mock("@/common/lib/device", () => ({
  RendererDevice: { platform: Promise.resolve("darwin") }
}));
vi.mock("@/common/lib/window", () => ({
  RendererWindow: {
    current: mocks.window.current,
    display: {
      listenMessage: mocks.window.display.listenMessage,
      reactReadyAwait: mocks.displayReady
    }
  }
}));
vi.mock("@/common/lib/bus", () => ({ RendererIPCMessageBus: mocks.bus }));
vi.mock("@/common/lib/modified", () => ({ RendererModified: { mark: vi.fn() } }));
vi.mock("@/common/store/user", () => ({ useUser: () => mocks.user }));
vi.mock("@/common/netease/api", () => ({ NeteaseAPITrack: {} }));
vi.mock("@/common/netease/services", () => ({
  NeteaseServicesPlaylist: {},
  NeteaseServicesTrack: {},
  NeteaseServicesAlbum: {}
}));
vi.mock("@/common/netease/models", () => ({ NeteaseTrackRecord: {} }));
vi.mock("@/common/hooks/use-listenable", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useListenable: function useListenable(value: unknown) {
      useSyncExternalStore(
        (listener) => {
          mocks.listeners.add(listener);
          return () => mocks.listeners.delete(listener);
        },
        () => mocks.version
      );
      return value;
    }
  };
});
vi.mock("@/common/hooks/use-audio-output", () => ({ useAudioOutput: () => mocks.output }));
vi.mock("@/wins/main/hooks/use-agent-tool-handle", () => ({ useAgentToolHandle: vi.fn() }));
vi.mock("@/wins/main/hooks/use-tray-capsule-bridge", () => ({ useTrayCapsuleBridge: vi.fn() }));
vi.mock("@/wins/main/lib/handle", () => ({ default: { usePlayer: () => mocks.player } }));

function Page() {
  const location = useLocation();
  const navigate = useNavigate();
  const { onPageAction } = useDisplayAction(() => {
    const { id, source } = RoutePathMain.playlist.parseQuery(location, false);
    if (!source) return null;
    return {
      type: "playlist",
      source,
      id: source === "like" ? 100 : Number(id),
      scope: mocks.scope ?? undefined
    };
  });
  return (
    <>
      <Bus />
      <output data-testid="location">{location.pathname + location.search}</output>
      <button onClick={onPageAction}>独立窗口打开</button>
      <button onClick={() => navigate(-1)}>普通返回</button>
    </>
  );
}

const routers: ReturnType<typeof createMemoryRouter>[] = [];
function setup(paths: string[]) {
  let index = paths.length - 1;
  const entries = paths.map((path, index) => ({
    pathname: path.split("?")[0],
    search: path.includes("?") ? `?${path.split("?")[1]}` : "",
    key: `entry-${index}`
  }));
  const keys = new Map(entries.map((entry, index) => [entry.key, index]));
  let key = entries[index]!.key;
  window.history.replaceState({ idx: index }, "");
  const router = createMemoryRouter([{ path: "*", element: <Page /> }], {
    initialEntries: entries,
    initialIndex: index
  });
  // Mirror createBrowserRouter's history index so the actual no-back fallback is exercised.
  router.subscribe((state) => {
    if (state.location.key === key) return;
    if (state.historyAction === "PUSH") index++;
    else if (state.historyAction === "POP") index = keys.get(state.location.key)!;
    key = state.location.key;
    keys.set(key, index);
    window.history.replaceState({ idx: index }, "");
  });
  routers.push(router);
  return { ...render(<RouterProvider router={router} />), router };
}

async function merge(...actions: DisplayAction[]) {
  await act(async () => {
    mocks.bus.display.data = [...mocks.bus.display.data, ...actions];
    mocks.version++;
    for (const listener of mocks.listeners) listener();
  });
}

const artist: PlaylistScope = { kind: "artist", key: "id:7" };
const album: PlaylistScope = { kind: "album", key: "id:20" };
const liked = (scope?: PlaylistScope) => RoutePathMain.playlist.withQuery(100, "like", scope);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.version = 0;
  mocks.scope = null;
  mocks.displayReady.mockResolvedValue(undefined);
  for (const channel of Object.values(mocks.bus)) {
    if (typeof channel === "object" && "data" in channel) channel.data = [];
  }
  mocks.bus.consume.mockImplementation((type: string) => {
    const channel = Object.values(mocks.bus).find(
      (value) => typeof value === "object" && "type" in value && value.type === type
    );
    if (channel && typeof channel === "object" && "data" in channel) channel.data = [];
  });
});
afterEach(() => {
  cleanup();
  for (const router of routers.splice(0)) router.dispose();
  window.history.replaceState(null, "");
});

it("replaces a merged scope on the same liked resource and detaches back to home", async () => {
  const view = setup([RoutePathMain.home, liked(artist)]);
  await merge({ type: "playlist", id: 100, source: "like" });

  expect(view.getByTestId("location")).toHaveTextContent(liked());
  expect(window.history.state.idx).toBe(1);
  expect(mocks.bus.display.data).toEqual([]);
  await act(async () => fireEvent.click(view.getByRole("button", { name: "独立窗口打开" })));

  await waitFor(() => expect(view.getByTestId("location")).toHaveTextContent(RoutePathMain.home));
  expect(mocks.bus.display.deliver).toHaveBeenCalledExactlyOnceWith({
    type: "playlist",
    id: 100,
    source: "like",
    scope: undefined
  });
});

it("skips existing scope entries for liked aliases with missing and real IDs", async () => {
  const view = setup([
    RoutePathMain.home,
    RoutePathMain.playlist.withQuery(null, "like", artist),
    liked(album),
    RoutePathMain.playlist.withQuery(100, "normal")
  ]);
  await act(async () => fireEvent.click(view.getByRole("button", { name: "独立窗口打开" })));

  await waitFor(() => expect(view.getByTestId("location")).toHaveTextContent(RoutePathMain.home));
  expect(window.history.state.idx).toBe(0);
  expect(mocks.bus.display.deliver).toHaveBeenCalledOnce();
});

it("stops skipping at another playlist and leaves ordinary back unchanged", async () => {
  const other = RoutePathMain.playlist.withQuery(200, "normal");
  const view = setup([RoutePathMain.home, other, liked(artist), liked(album)]);
  await act(async () => fireEvent.click(view.getByRole("button", { name: "独立窗口打开" })));

  await waitFor(() => expect(view.getByTestId("location")).toHaveTextContent(other));
  expect(window.history.state.idx).toBe(1);
  await act(async () => fireEvent.click(view.getByRole("button", { name: "普通返回" })));
  expect(view.getByTestId("location")).toHaveTextContent(RoutePathMain.home);
});

it("returns a directly opened playlist with no back entry to home", async () => {
  const view = setup([liked(artist)]);
  await act(async () => fireEvent.click(view.getByRole("button", { name: "独立窗口打开" })));

  await waitFor(() => expect(view.getByTestId("location")).toHaveTextContent(RoutePathMain.home));
  expect(window.history.state.idx).toBe(0);
});

it("consumes repeated merges once and does not stack same-resource history", async () => {
  const view = setup([RoutePathMain.home]);
  await merge({ type: "playlist", id: 100, source: "like", scope: artist });
  expect(window.history.state.idx).toBe(1);
  await merge({ type: "playlist", id: 100, source: "like", scope: album });
  await merge({ type: "playlist", id: 100, source: "like" });

  expect(view.getByTestId("location")).toHaveTextContent(liked());
  expect(window.history.state.idx).toBe(1);
  expect(mocks.bus.display.data).toEqual([]);
  expect(mocks.bus.consume.mock.calls.filter(([type]) => type === "display")).toHaveLength(3);
  await act(async () => fireEvent.click(view.getByRole("button", { name: "普通返回" })));
  expect(view.getByTestId("location")).toHaveTextContent(RoutePathMain.home);
});

it("navigates only to the final resource in a received merge batch", async () => {
  const view = setup([RoutePathMain.home]);
  await merge(
    { type: "playlist", id: 100, source: "like", scope: artist },
    { type: "playlist", id: 100, source: "like", scope: album }
  );

  expect(view.getByTestId("location")).toHaveTextContent(liked(album));
  expect(window.history.state.idx).toBe(1);
  await act(async () => fireEvent.click(view.getByRole("button", { name: "普通返回" })));
  expect(view.getByTestId("location")).toHaveTextContent(RoutePathMain.home);
});
