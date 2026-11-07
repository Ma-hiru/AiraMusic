import { render, cleanup, waitFor } from "@testing-library/react";
import { RoutePathMain } from "@mahiru/ui/common/routes";
import Bus from "@mahiru/ui/wins/main/pages/layout/bus";
import type { MessageData } from "@mahiru/ipc/types";

type PlaylistAction = MessageData<"bus_dispatch_playlist_action">;

const mocks = vi.hoisted(() => {
  const channel = (type: string) => ({ type, data: [], deliver: vi.fn() });
  const bus = {
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
    playlistAction: { ...channel("playlistAction"), data: [] as PlaylistAction[] },
    playlistActionResult: channel("playlistActionResult"),
    display: { ...channel("display"), data: [] as MessageData<"bus_display">[] },
    consume: vi.fn()
  };
  const player = {
    audio: {
      outputTarget: "default",
      progress: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    },
    playlist: {
      listVersion: 1,
      mark_id: "previous-queue",
      list: () => [],
      pos: () => -1,
      addListener: () => () => {},
      same: vi.fn(),
      replace: vi.fn(),
      addList: vi.fn(),
      jump: vi.fn(),
      listRaw: vi.fn()
    },
    history: { list: [], addListener: () => () => {} },
    current: { track: null, lyric: null },
    addListener: () => () => {}
  };
  return {
    bus,
    player,
    loadPlaylist: vi.fn(),
    loadTracks: vi.fn(),
    loadAlbum: vi.fn(),
    logError: vi.fn(),
    setAtom: vi.fn(),
    navigate: vi.fn(),
    theme: {},
    location: { pathname: "/home" },
    output: { setDevice: vi.fn(), views: [], selected: "default" },
    window: {
      current: { focus: vi.fn() },
      display: { listenMessage: () => () => {} }
    }
  };
});

vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useSetAtom: () => mocks.setAtom,
  useAtomValue: (atom: string) => (atom === "theme" ? mocks.theme : false)
}));
vi.mock("react-router-dom", () => ({
  useLocation: () => mocks.location,
  useNavigate: () => mocks.navigate
}));
vi.mock("@/wins/main/atoms/theme", () => ({ themeAtom: "theme" }));
vi.mock("@/wins/main/atoms/track", () => ({
  fmModeAtom: "fm",
  intelligenceModeAtom: "intelligence"
}));
vi.mock("@/common/lib/log", () => ({ Log: { error: mocks.logError } }));
vi.mock("@/common/lib/device", () => ({
  RendererDevice: { platform: Promise.resolve("darwin") }
}));
vi.mock("@/common/lib/window", () => ({ RendererWindow: mocks.window }));
vi.mock("@/common/lib/bus", () => ({ RendererIPCMessageBus: mocks.bus }));
vi.mock("@/common/lib/modified", () => ({ RendererModified: { mark: vi.fn() } }));
vi.mock("@/common/store/user", () => ({ useUser: () => null }));
vi.mock("@/common/netease/api", () => ({ NeteaseAPITrack: {} }));
vi.mock("@/common/netease/services", () => ({
  NeteaseServicesPlaylist: { id: mocks.loadPlaylist },
  NeteaseServicesTrack: { ids: mocks.loadTracks },
  NeteaseServicesAlbum: { id: mocks.loadAlbum }
}));
vi.mock("@/common/netease/models", () => ({
  NeteaseTrackRecord: {
    fromPlaylist: (playlist: { tracks: unknown[] }) => playlist.tracks
  }
}));
vi.mock("@/common/hooks/use-listenable", () => ({ useListenable: (value: unknown) => value }));
vi.mock("@/common/hooks/use-audio-output", () => ({ useAudioOutput: () => mocks.output }));
vi.mock("@/wins/main/hooks/use-agent-tool-handle", () => ({ useAgentToolHandle: vi.fn() }));
vi.mock("@/wins/main/hooks/use-tray-capsule-bridge", () => ({ useTrayCapsuleBridge: vi.fn() }));
vi.mock("@/wins/main/lib/handle", () => ({
  default: { usePlayer: () => mocks.player }
}));

const tracks = [11, 12, 13].map((id) => ({
  id,
  sourceID: 100,
  sourceName: "playlist",
  detail: { id }
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bus.playlistAction.data = [];
  mocks.bus.display.data = [];
  mocks.loadPlaylist.mockResolvedValue({ id: 100, tracks });
  mocks.player.playlist.same.mockReturnValue(false);
});
afterEach(cleanup);

it("replaces a display playlist with only the requested artist's songs in the requested order", async () => {
  mocks.bus.playlistAction.data = [
    {
      type: "replacePlaylistAndPlay",
      requestID: "replace-artist",
      sourceType: "playlist",
      sourceID: 100,
      detailType: "playlist",
      markId: "playlist-100",
      allIDs: [13, 99, 11],
      trackID: 11,
      trackIdx: 2
    }
  ];
  render(<Bus />);

  await waitFor(() => {
    expect(mocks.bus.playlistActionResult.deliver).toHaveBeenCalledWith({
      requestID: "replace-artist",
      ok: true
    });
  });
  expect(mocks.loadPlaylist).toHaveBeenCalledExactlyOnceWith(100);
  expect(mocks.player.playlist.replace).toHaveBeenCalledExactlyOnceWith(
    [tracks[2], tracks[0]],
    tracks[0],
    "playlist-100"
  );
  expect(mocks.loadTracks).not.toHaveBeenCalled();
  expect(mocks.logError).not.toHaveBeenCalled();
});

it("adds only the requested display playlist subset to the queue", async () => {
  mocks.bus.playlistAction.data = [
    {
      type: "addListToPlaylistEnd",
      requestID: "add-artist",
      sourceType: "playlist",
      sourceID: 100,
      allIDs: [12, 99, 11]
    }
  ];
  render(<Bus />);

  await waitFor(() => {
    expect(mocks.bus.playlistActionResult.deliver).toHaveBeenCalledWith({
      requestID: "add-artist",
      ok: true
    });
  });
  expect(mocks.player.playlist.addList).toHaveBeenCalledExactlyOnceWith([tracks[1], tracks[0]]);
  expect(mocks.player.playlist.replace).not.toHaveBeenCalled();
  expect(mocks.logError).not.toHaveBeenCalled();
});

it("preserves the full playlist when an ordinary display request includes every song", async () => {
  mocks.bus.playlistAction.data = [
    {
      type: "addListToPlaylistEnd",
      requestID: "add-all",
      sourceType: "playlist",
      sourceID: 100,
      allIDs: [11, 12, 13]
    }
  ];
  render(<Bus />);

  await waitFor(() => {
    expect(mocks.bus.playlistActionResult.deliver).toHaveBeenCalledWith({
      requestID: "add-all",
      ok: true
    });
  });
  expect(mocks.player.playlist.addList).toHaveBeenCalledExactlyOnceWith(tracks);
});

it("does not fall back to the full playlist when all requested songs are unavailable", async () => {
  mocks.bus.playlistAction.data = [
    {
      type: "replacePlaylistAndPlay",
      requestID: "missing-songs",
      sourceType: "playlist",
      sourceID: 100,
      detailType: "playlist",
      allIDs: [99],
      trackID: 99,
      trackIdx: 0
    }
  ];
  render(<Bus />);

  await waitFor(() => {
    expect(mocks.bus.playlistActionResult.deliver).toHaveBeenCalledWith({
      requestID: "missing-songs",
      ok: false,
      error: "找不到可播放的歌曲"
    });
  });
  expect(mocks.player.playlist.replace).not.toHaveBeenCalled();
  expect(mocks.player.playlist.jump).not.toHaveBeenCalled();
});

it.each([
  { scope: { kind: "artist", key: "id:7" } },
  { scope: { kind: "artist", key: "name:匿名歌手" } },
  { scope: { kind: "album", key: "id:12" } },
  { scope: undefined }
] as const)(
  "preserves the playlist scope when merging into the main window: $scope",
  ({ scope }) => {
    mocks.bus.display.data = [{ type: "playlist", id: 100, source: "like", scope }];
    render(<Bus />);

    expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(
      RoutePathMain.playlist.withQuery(100, "like", scope)
    );
    expect(mocks.window.current.focus).toHaveBeenCalledOnce();
  }
);
