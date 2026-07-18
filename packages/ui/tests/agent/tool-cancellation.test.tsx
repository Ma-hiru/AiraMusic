import { act, renderHook } from "@testing-library/react";
import { useAgentToolHandle } from "@mahiru/ui/wins/main/hooks/use-agent-tool-handle";

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, (payload: unknown) => void>();
  const removeListener = vi.fn();
  const listenMessage = vi.fn((type: string, listener: (payload: unknown) => void) => {
    listeners.set(type, listener);
    return removeListener;
  });
  const player = {
    playlist: {
      locate: vi.fn(() => -1),
      add: vi.fn(),
      addList: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      jump: vi.fn(),
      list: vi.fn((): { id: number; name?: string }[] => []),
      current: vi.fn((): null | { id: number; name?: string } => null),
      repeat: "off" as "all" | "off" | "one",
      shuffle: false
    },
    current: { track: null },
    audio: {
      progress: { duration: 0, currentTime: 0, buffered: 0 },
      audio: { muted: false },
      volume: 1,
      currentTime: 0,
      mute: vi.fn(),
      unmute: vi.fn()
    },
    statusText: "paused",
    replaceLyricByAgent: vi.fn()
  };

  return {
    listeners,
    listenMessage,
    removeListener,
    processSend: vi.fn(),
    displayReady: vi.fn(() => Promise.resolve()),
    commentReady: vi.fn(() => Promise.resolve()),
    displayDeliver: vi.fn(),
    commentDeliver: vi.fn(),
    trackID: vi.fn(),
    trackIDs: vi.fn(),
    player
  };
});

vi.mock("@/common/lib/window", () => ({
  RendererWindow: {
    process: {
      listenMessage: mocks.listenMessage,
      send: mocks.processSend
    },
    display: { reactReadyAwait: mocks.displayReady },
    comment: { reactReadyAwait: mocks.commentReady }
  }
}));

vi.mock("@/common/lib/bus", () => ({
  RendererIPCMessageBus: {
    playerAction: { dispatch: vi.fn() },
    display: { deliver: mocks.displayDeliver },
    comment: { deliver: mocks.commentDeliver }
  }
}));

vi.mock("@/common/lib/renderer-tool", () => ({
  RendererTool: {
    output: vi.fn((value: unknown) => JSON.stringify(value)),
    list: vi.fn((values: unknown[], mapper: (value: unknown) => unknown) => values.map(mapper)),
    lyric: vi.fn(),
    album: vi.fn(),
    artist: vi.fn(),
    playlist: vi.fn(),
    track: vi.fn((track: unknown) => track),
    record: vi.fn((record: unknown) => record)
  }
}));

vi.mock("@/common/hooks/use-latest-ref", () => ({
  useLatestRef: (value: unknown) => ({ current: value })
}));

vi.mock("@/common/store/settings", () => ({
  settingsStoreSnapshot: vi.fn()
}));

vi.mock("@/common/store/user", () => ({
  useUser: () => null,
  userStoreSnapshot: () => ({ _user: null })
}));

vi.mock("@/common/netease/models", () => ({
  NeteaseUser: { isVIP: () => false },
  NeteaseLyricSchema: {},
  NeteaseTrackRecord: class {
    readonly id: number;

    constructor(readonly value: { detail: { id: number } }) {
      this.id = value.detail.id;
    }
  }
}));

vi.mock("@/common/netease/services", () => ({
  NeteaseServicesAlbum: { id: vi.fn() },
  NeteaseServicesArtist: { id: vi.fn() },
  NeteaseServicesLyric: { id: vi.fn() },
  NeteaseServicesPlaylist: { id: vi.fn() },
  NeteaseServicesTrack: {
    id: mocks.trackID,
    ids: mocks.trackIDs,
    personalFM: vi.fn()
  }
}));

vi.mock("@/common/netease/api", () => ({
  NeteaseAPIAlbum: {},
  NeteaseAPIArtist: {},
  NeteaseAPIComment: {},
  NeteaseAPIHome: {},
  NeteaseAPIPlaylist: {},
  NeteaseAPIRecord: {},
  NeteaseAPISearch: {},
  NeteaseAPITrack: {},
  NeteaseAPIUser: {}
}));

vi.mock("@/wins/main/lib/handle", () => ({
  default: { player: mocks.player }
}));

const getListener = (type: string) => {
  const listener = mocks.listeners.get(type);
  expect(listener).toBeTypeOf("function");
  return listener!;
};

describe("Agent tool request cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listeners.clear();
    mocks.player.playlist.locate.mockReturnValue(-1);
    mocks.player.playlist.list.mockReturnValue([]);
    mocks.player.playlist.current.mockReturnValue(null);
    mocks.player.playlist.repeat = "off";
    mocks.player.playlist.shuffle = false;
  });

  it("aborts the network signal and suppresses delayed playback side effects", async () => {
    let resolveTrack!: (track: unknown) => void;
    const trackPromise = new Promise<unknown>((resolve) => {
      resolveTrack = resolve;
    });
    mocks.trackID.mockReturnValue(trackPromise);
    const { unmount } = renderHook(() => useAgentToolHandle());

    act(() => {
      getListener("message_dispatch_agent_tool_request")({
        id: "play-42",
        tool: "agent-tool-track-play",
        input: { id: 42 }
      });
    });
    const signal = mocks.trackID.mock.calls[0]?.[1] as AbortSignal;

    act(() => {
      getListener("message_cancel_agent_tool_request")({ id: "play-42" });
    });
    expect(signal.aborted).toBe(true);

    await act(async () => {
      resolveTrack({ id: 42, name: "late track" });
      await trackPromise;
      await Promise.resolve();
    });

    expect(mocks.player.playlist.add).not.toHaveBeenCalled();
    expect(mocks.player.playlist.jump).not.toHaveBeenCalled();
    expect(mocks.processSend).not.toHaveBeenCalled();
    unmount();
  });

  it("suppresses window opening when readiness resolves after cancellation", async () => {
    let resolveReady!: () => void;
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    mocks.displayReady.mockReturnValue(readyPromise);
    const { unmount } = renderHook(() => useAgentToolHandle());

    act(() => {
      getListener("message_dispatch_agent_tool_request")({
        id: "open-artist",
        tool: "agent-tool-source-open",
        input: { id: 7, type: "artist" }
      });
      getListener("message_cancel_agent_tool_request")({ id: "open-artist" });
    });

    await act(async () => {
      resolveReady();
      await readyPromise;
      await Promise.resolve();
    });

    expect(mocks.displayDeliver).not.toHaveBeenCalled();
    expect(mocks.processSend).not.toHaveBeenCalled();
    unmount();
  });

  it("keeps the requested order when adding several tracks after the current track", async () => {
    const tracks = [
      { id: 11, name: "first" },
      { id: 22, name: "second" }
    ];
    mocks.trackIDs.mockResolvedValue(tracks);
    mocks.player.playlist.list.mockReturnValue(tracks);
    const { unmount } = renderHook(() => useAgentToolHandle());

    await act(async () => {
      getListener("message_dispatch_agent_tool_request")({
        id: "queue-add",
        tool: "agent-tool-player-queue-add",
        input: { ids: [11, 22, 11], position: "next" }
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.trackIDs).toHaveBeenCalledWith([11, 22], 100, 5, expect.any(AbortSignal));
    expect(mocks.player.playlist.add.mock.calls.map(([record]) => record.id)).toEqual([22, 11]);
    expect(mocks.player.playlist.add.mock.calls.map(([, position]) => position)).toEqual([
      "next",
      "next"
    ]);
    expect(mocks.processSend).toHaveBeenCalledWith(
      "message_deliver_agent_tool_response",
      expect.objectContaining({ id: "queue-add", ok: true })
    );
    unmount();
  });

  it("does not change the queue when a pending add request is cancelled", async () => {
    let resolveTracks!: (tracks: { id: number; name: string }[]) => void;
    const tracksPromise = new Promise<{ id: number; name: string }[]>((resolve) => {
      resolveTracks = resolve;
    });
    mocks.trackIDs.mockReturnValue(tracksPromise);
    const { unmount } = renderHook(() => useAgentToolHandle());

    act(() => {
      getListener("message_dispatch_agent_tool_request")({
        id: "queue-add-cancelled",
        tool: "agent-tool-player-queue-add",
        input: { ids: [11], position: "end" }
      });
      getListener("message_cancel_agent_tool_request")({ id: "queue-add-cancelled" });
    });

    await act(async () => {
      resolveTracks([{ id: 11, name: "late track" }]);
      await tracksPromise;
      await Promise.resolve();
    });

    expect(mocks.player.playlist.addList).not.toHaveBeenCalled();
    expect(mocks.processSend).not.toHaveBeenCalled();
    unmount();
  });

  it("removes matching queue records and reports missing track ids", () => {
    const queue = [{ id: 11 }, { id: 22 }, { id: 33 }];
    mocks.player.playlist.list.mockReturnValueOnce(queue).mockReturnValueOnce([{ id: 22 }]);
    const { unmount } = renderHook(() => useAgentToolHandle());

    act(() => {
      getListener("message_dispatch_agent_tool_request")({
        id: "queue-remove",
        tool: "agent-tool-player-queue-remove",
        input: { scope: "tracks", ids: [11, 33, 404] }
      });
    });

    expect(mocks.player.playlist.remove).toHaveBeenCalledTimes(2);
    expect(mocks.player.playlist.remove).toHaveBeenNthCalledWith(1, queue[0]);
    expect(mocks.player.playlist.remove).toHaveBeenNthCalledWith(2, queue[2]);
    const response = mocks.processSend.mock.calls.at(-1)?.[1] as { data: string };
    expect(JSON.parse(response.data)).toMatchObject({
      missingIDs: [404],
      queueLength: 1,
      removedCount: 2
    });
    unmount();
  });

  it("sets repeat and shuffle modes explicitly", () => {
    const { unmount } = renderHook(() => useAgentToolHandle());

    act(() => {
      getListener("message_dispatch_agent_tool_request")({
        id: "player-mode",
        tool: "agent-tool-player-mode",
        input: { repeat: "one", shuffle: true }
      });
    });

    expect(mocks.player.playlist.repeat).toBe("one");
    expect(mocks.player.playlist.shuffle).toBe(true);
    const response = mocks.processSend.mock.calls.at(-1)?.[1] as { data: string };
    expect(JSON.parse(response.data)).toMatchObject({
      previous: { repeat: "off", shuffle: false },
      current: { repeat: "one", shuffle: true }
    });
    unmount();
  });
});
