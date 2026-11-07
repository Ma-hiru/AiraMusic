import { act, render, cleanup } from "@testing-library/react";
import { NeteaseTrackRecord } from "@mahiru/ui/common/netease/models/netease-track-record";
import Bus from "@mahiru/ui/wins/main/pages/layout/bus";
import RendererPlayerPlaylist from "@mahiru/ui/common/player/playlist";
import type { MessageData } from "@mahiru/ipc/types";
import type RendererPlayer from "@mahiru/ui/common/player/core";
import type { NeteaseTrack } from "@mahiru/ui/common/netease/models";

const mocks = vi.hoisted(() => {
  const channel = (type: string) => ({ type, data: [] as unknown[], deliver: vi.fn() });
  return {
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
    player: null as unknown as RendererPlayer,
    theme: {},
    output: { views: [], selected: "default", setDevice: vi.fn() },
    setAtom: vi.fn(),
    loadTrack: vi.fn()
  };
});

vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useSetAtom: () => mocks.setAtom,
  useAtomValue: (atom: string) => (atom === "theme" ? mocks.theme : false)
}));
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/home", search: "" }),
  useNavigate: () => vi.fn()
}));
vi.mock("@/wins/main/atoms/theme", () => ({ themeAtom: "theme" }));
vi.mock("@/wins/main/atoms/track", () => ({
  fmModeAtom: "fm",
  intelligenceModeAtom: "intelligence"
}));
vi.mock("@/common/lib/device", () => ({
  RendererDevice: { platform: Promise.resolve("darwin") }
}));
vi.mock("@/common/lib/window", () => ({
  RendererWindow: {
    current: { focus: vi.fn() },
    display: { listenMessage: () => () => {} }
  }
}));
vi.mock("@/common/lib/bus", () => ({ RendererIPCMessageBus: mocks.bus }));
vi.mock("@/common/lib/modified", () => ({ RendererModified: { mark: vi.fn() } }));
vi.mock("@/common/store/user", () => ({ useUser: () => null }));
vi.mock("@/common/netease/api", () => ({ NeteaseAPITrack: {} }));
vi.mock("@/common/netease/services", () => ({
  NeteaseServicesPlaylist: {},
  NeteaseServicesTrack: { idEnsure: mocks.loadTrack },
  NeteaseServicesAlbum: {}
}));
// No React rerender is triggered by playlist updates in this test. The real list listener
// must deliver changes even though usePlayer() and player.playlist keep their identities.
vi.mock("@/common/hooks/use-listenable", () => ({ useListenable: (value: unknown) => value }));
vi.mock("@/common/hooks/use-audio-output", () => ({ useAudioOutput: () => mocks.output }));
vi.mock("@/wins/main/hooks/use-agent-tool-handle", () => ({ useAgentToolHandle: vi.fn() }));
vi.mock("@/wins/main/hooks/use-tray-capsule-bridge", () => ({ useTrayCapsuleBridge: vi.fn() }));
vi.mock("@/wins/main/lib/handle", () => ({ default: { usePlayer: () => mocks.player } }));

const makeTrack = (id: number) =>
  new NeteaseTrackRecord({
    sourceID: 42,
    sourceName: "playlist",
    detail: { id, name: `Track ${id}` } as NeteaseTrack
  });

let playlist: RendererPlayerPlaylist;
let tracks: NeteaseTrackRecord[];

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  tracks = [makeTrack(1), makeTrack(2), makeTrack(3)];
  playlist = new RendererPlayerPlaylist({ playlist: tracks, position: 0 });
  playlist.mark_id = "original-scope";
  mocks.player = {
    audio: {
      progress: { currentTime: 7, duration: 180, buffered: 30, volume: 1 },
      outputTarget: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    },
    playlist,
    current: { track: tracks[0], lyric: null },
    history: { list: [], addListener: () => () => {} },
    statusText: "paused",
    addListener: () => () => {}
  } as unknown as RendererPlayer;
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
  playlist[Symbol.dispose]();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const latestSnapshot = () =>
  mocks.bus.playList.deliver.mock.lastCall?.[0] as MessageData<"bus_deliver_play_list">;

it("pushes one initial snapshot and sends only positions for in-place cursor changes", () => {
  const subscribe = vi.spyOn(playlist, "addListener");
  const readList = vi.spyOn(playlist, "list");
  render(<Bus />);
  expect(subscribe).toHaveBeenCalledOnce();
  expect(latestSnapshot()).toEqual({
    list: tracks,
    position: 0,
    markId: "original-scope",
    senderId: expect.any(String),
    sequence: expect.any(Number),
    version: playlist.listVersion
  });

  act(() => {
    playlist.jump(2);
    vi.advanceTimersByTime(100);
  });
  expect(mocks.player.playlist).toBe(playlist);
  expect(mocks.bus.playListPosition.deliver).toHaveBeenCalledExactlyOnceWith({
    position: 2,
    markId: "original-scope",
    senderId: latestSnapshot().senderId,
    sequence: latestSnapshot().sequence + 1,
    version: playlist.listVersion
  });
  expect(latestSnapshot().position).toBe(0);
  expect(mocks.bus.playList.deliver).toHaveBeenCalledOnce();
  expect(readList).toHaveBeenCalledOnce();
});

it("pushes shuffle display order, replacement scope and a cleared queue", () => {
  render(<Bus />);
  const originalVersion = latestSnapshot().version;
  const originalSequence = latestSnapshot().sequence;
  const originalSender = latestSnapshot().senderId;
  act(() => {
    playlist.jump(2);
    playlist.shuffle = true;
    vi.advanceTimersByTime(100);
  });
  expect(latestSnapshot().list).toEqual(playlist.list());
  expect(latestSnapshot().list[0]).toBe(tracks[2]);
  expect(latestSnapshot().position).toBe(0);
  expect(latestSnapshot().markId).toBe("original-scope");
  expect(latestSnapshot().version).toBeGreaterThan(originalVersion);
  expect(mocks.bus.playList.deliver).toHaveBeenCalledTimes(2);
  expect(mocks.bus.playListPosition.deliver).not.toHaveBeenCalled();

  const replacement = [makeTrack(7), makeTrack(8)];
  act(() => {
    playlist.replace(replacement, replacement[1]!, "replacement-scope");
    vi.advanceTimersByTime(100);
  });
  expect(latestSnapshot()).toEqual({
    list: playlist.list(),
    position: playlist.pos(),
    markId: "replacement-scope",
    senderId: originalSender,
    sequence: originalSequence + 2,
    version: playlist.listVersion
  });
  act(() => {
    playlist.clear();
    vi.advanceTimersByTime(100);
  });
  expect(latestSnapshot()).toEqual({
    list: [],
    position: -1,
    markId: playlist.mark_id,
    senderId: originalSender,
    sequence: originalSequence + 3,
    version: playlist.listVersion
  });
});

it("keeps repeat changes local and sends lightweight positions for next and previous", () => {
  render(<Bus />);
  const initialVersion = playlist.listVersion;
  act(() => {
    playlist.repeat = "all";
    vi.advanceTimersByTime(100);
  });
  expect(playlist.listVersion).toBe(initialVersion);
  expect(mocks.bus.playList.deliver).toHaveBeenCalledOnce();
  expect(mocks.bus.playListPosition.deliver).not.toHaveBeenCalled();

  act(() => {
    playlist.next();
    vi.advanceTimersByTime(100);
  });
  act(() => {
    playlist.last();
    vi.advanceTimersByTime(100);
  });
  expect(mocks.bus.playList.deliver).toHaveBeenCalledOnce();
  expect(mocks.bus.playListPosition.deliver.mock.calls.map(([data]) => data.position)).toEqual([
    1, 0
  ]);
});

it("publishes fresh member snapshots after adding, removing and appending tracks", () => {
  render(<Bus />);
  const mutations = [
    () => playlist.add(makeTrack(4), "next"),
    () => playlist.remove(tracks[1]!),
    () => playlist.addList([makeTrack(5), makeTrack(6)])
  ];
  for (const mutate of mutations) {
    const previousVersion = latestSnapshot().version;
    act(() => {
      mutate();
      vi.advanceTimersByTime(100);
    });
    expect(latestSnapshot().version).toBeGreaterThan(previousVersion);
    expect(latestSnapshot().list).toEqual(playlist.list());
  }
  expect(latestSnapshot().list.map((track) => track.id)).toEqual([1, 4, 3, 5, 6]);
  expect(mocks.bus.playList.deliver).toHaveBeenCalledTimes(4);
});

it("resends the snapshot when its scope changes even if the list version stays the same", () => {
  render(<Bus />);
  const previousVersion = playlist.listVersion;
  act(() => {
    playlist.mark_id = "new-scope";
    playlist.jump(1);
    vi.advanceTimersByTime(100);
  });
  expect(playlist.listVersion).toBe(previousVersion);
  expect(mocks.bus.playList.deliver).toHaveBeenCalledTimes(2);
  expect(latestSnapshot()).toMatchObject({ markId: "new-scope", position: 1 });
  expect(mocks.bus.playListPosition.deliver).not.toHaveBeenCalled();
});

it.each(["request", "refresh"])("includes the queue in %s responses", (action) => {
  if (action === "request") mocks.bus.updater.data = ["play-list"];
  else mocks.bus.playerAction.data = ["update"];
  render(<Bus />);

  expect(mocks.bus.playList.deliver).toHaveBeenCalledTimes(2);
  expect(latestSnapshot()).toEqual({
    list: tracks,
    position: 0,
    markId: "original-scope",
    senderId: expect.any(String),
    sequence: expect.any(Number),
    version: playlist.listVersion
  });
});

it("removes the playlist subscription on unmount", () => {
  const view = render(<Bus />);
  view.unmount();
  act(() => {
    playlist.jump(1);
    vi.advanceTimersByTime(100);
  });
  expect(mocks.bus.playList.deliver).toHaveBeenCalledOnce();
  expect(mocks.bus.playListPosition.deliver).not.toHaveBeenCalled();
});

it("keeps refresh sequences newer than old positions after the bus remounts", () => {
  const view = render(<Bus />);
  act(() => {
    playlist.jump(1);
    vi.advanceTimersByTime(100);
  });
  const previous = mocks.bus.playListPosition.deliver.mock
    .lastCall?.[0] as MessageData<"bus_deliver_play_list_position">;
  view.unmount();
  act(() => {
    playlist.jump(2);
    vi.advanceTimersByTime(100);
  });
  expect(mocks.bus.playListPosition.deliver).toHaveBeenCalledOnce();
  render(<Bus />);

  expect(latestSnapshot()).toMatchObject({
    version: previous.version,
    markId: previous.markId,
    senderId: previous.senderId,
    position: 2
  });
  expect(latestSnapshot().sequence).toBeGreaterThan(previous.sequence);
  const refreshedSequence = latestSnapshot().sequence;
  act(() => {
    playlist.jump(0);
    vi.advanceTimersByTime(100);
  });
  expect(mocks.bus.playListPosition.deliver).toHaveBeenLastCalledWith({
    version: previous.version,
    markId: previous.markId,
    senderId: previous.senderId,
    position: 0,
    sequence: refreshedSequence + 1
  });
});

it("plays a display queue selection by jumping without fetching or replacing its scope", async () => {
  mocks.bus.playlistAction.data = [{ type: "playTrack", trackID: 3 }];
  render(<Bus />);
  await act(async () => vi.advanceTimersByTimeAsync(100));

  expect(playlist.pos()).toBe(2);
  expect(playlist.listRaw()).toEqual(tracks);
  expect(playlist.mark_id).toBe("original-scope");
  expect(mocks.loadTrack).not.toHaveBeenCalled();
  expect(mocks.bus.playList.deliver).toHaveBeenCalledOnce();
  expect(mocks.bus.playListPosition.deliver).toHaveBeenCalledExactlyOnceWith({
    position: 2,
    markId: "original-scope",
    senderId: latestSnapshot().senderId,
    sequence: latestSnapshot().sequence + 1,
    version: playlist.listVersion
  });
});
