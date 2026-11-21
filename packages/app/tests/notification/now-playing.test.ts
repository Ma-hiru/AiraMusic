import type { MessageData } from "@mahiru/ipc/types";

type Meta = MessageData<"bus_deliver_track_meta">;

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (data: unknown) => void>(),
  focus: null as null | object,
  checkAndShow: vi.fn(),
  notifications: [] as Array<{
    show: ReturnType<typeof vi.fn>;
    options: Record<string, unknown>;
    handlers: Map<string, (...args: unknown[]) => void>;
  }>
}));

vi.mock("electron", () => {
  class FakeNotification {
    options: Record<string, unknown>;
    handlers = new Map<string, (...args: unknown[]) => void>();
    show = vi.fn();

    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.notifications.push(this);
    }

    on(event: string, handler: (...args: unknown[]) => void) {
      this.handlers.set(event, handler);
      return this;
    }
  }

  return {
    app: {},
    Notification: FakeNotification,
    BrowserWindow: { getFocusedWindow: () => mocks.focus },
    nativeImage: { createFromBuffer: vi.fn(() => ({ isEmpty: () => false })) }
  };
});
vi.mock("@mahiru/app/lib/log", () => ({ Log: { debug: vi.fn(), warn: vi.fn() } }));
vi.mock("@mahiru/ipc/main", () => ({
  MainIPC: {
    MessageChannel: {
      listen: (channel: string, listener: (data: unknown) => void) => {
        mocks.listeners.set(channel, listener);
      }
    }
  }
}));
vi.mock("@mahiru/app/lib/window-manager", () => ({
  MainWindowManager: { checkAndShow: mocks.checkAndShow }
}));

const realPlatform = process.platform;
let Notifier: typeof import("@mahiru/app/lib/now-playing-notification").MainNowPlayingNotification;

function meta(id: number, status: Meta["status"] = "playing", picUrl = ""): Meta {
  return {
    track: {
      id,
      name: `Song ${id}`,
      sourceID: 0,
      detail: {
        id,
        name: `Song ${id}`,
        ar: [{ id: 1, name: "Artist" }],
        al: { id: 1, name: "Album", picUrl }
      }
    } as NonNullable<Meta["track"]>,
    status,
    lyric: null,
    repeat: "off",
    shuffle: false,
    mode: "normal",
    rmActive: false,
    tlActive: false,
    noteActive: false,
    playlistMarkId: "test"
  };
}

function deliver(data: Meta) {
  mocks.listeners.get("bus_deliver_track_meta")!(data);
}

beforeAll(() => {
  // 切歌通知只在 macOS 注册，测试需要覆盖到该分支
  Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
});

afterAll(() => {
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.listeners.clear();
  mocks.notifications.length = 0;
  mocks.focus = null;
  Notifier = (await import("@mahiru/app/lib/now-playing-notification")).MainNowPlayingNotification;
  Notifier.register();
});

it("replaces the notification with a stable identifier on every track", async () => {
  deliver(meta(1));
  await vi.waitFor(() => expect(mocks.notifications).toHaveLength(1));

  expect(mocks.notifications[0]!.options).toMatchObject({
    id: "now-playing",
    title: "Song 1",
    subtitle: "Artist",
    body: "Album",
    silent: true
  });
  expect(mocks.notifications[0]!.show).toHaveBeenCalledOnce();

  deliver(meta(2));
  await vi.waitFor(() => expect(mocks.notifications).toHaveLength(2));
  expect(mocks.notifications[1]!.options).toMatchObject({ id: "now-playing", title: "Song 2" });
});

it("only notifies when a track starts playing", async () => {
  deliver(meta(1, "paused"));
  deliver(meta(1, "loading"));
  await Promise.resolve();
  expect(mocks.notifications).toHaveLength(0);

  deliver(meta(1, "playing"));
  await vi.waitFor(() => expect(mocks.notifications).toHaveLength(1));

  // 同一首暂停再继续、单曲循环都不重复提示
  deliver(meta(1, "paused"));
  deliver(meta(1, "playing"));
  await Promise.resolve();
  expect(mocks.notifications).toHaveLength(1);
});

it("shows track notifications regardless of window focus", async () => {
  mocks.focus = {};

  deliver(meta(1));
  await vi.waitFor(() => expect(mocks.notifications).toHaveLength(1));

  deliver(meta(2));
  await vi.waitFor(() => expect(mocks.notifications).toHaveLength(2));
  expect(mocks.notifications[1]!.show).toHaveBeenCalledOnce();

  mocks.focus = null;
  deliver(meta(3));
  await vi.waitFor(() => expect(mocks.notifications).toHaveLength(3));
  expect(mocks.notifications[2]!.show).toHaveBeenCalledOnce();
});

it("does not let a slow cover overwrite a newer track", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }), 80)
        )
    )
  );

  deliver(meta(1, "playing", "https://cover.example/1.jpg"));
  deliver(meta(2, "playing"));
  await vi.waitFor(() => expect(mocks.notifications).toHaveLength(1));
  expect(mocks.notifications[0]!.options["title"]).toBe("Song 2");

  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(mocks.notifications).toHaveLength(1);
  expect(mocks.notifications[0]!.options["title"]).toBe("Song 2");
});

it("retries once when the system rejects the notification", async () => {
  vi.useFakeTimers();
  try {
    deliver(meta(1));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.notifications).toHaveLength(1);

    mocks.notifications[0]!.handlers.get("failed")!({}, "UNErrorDomain 1");
    mocks.focus = {};
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.notifications).toHaveLength(2);

    // 只重试一次，避免权限被拒时无限重试
    mocks.notifications[1]!.handlers.get("failed")!({}, "UNErrorDomain 1");
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.notifications).toHaveLength(2);
  } finally {
    vi.useRealTimers();
  }
});

it("opens the main window when the notification is clicked", async () => {
  deliver(meta(1));
  await vi.waitFor(() => expect(mocks.notifications).toHaveLength(1));

  mocks.notifications[0]!.handlers.get("click")!();
  expect(mocks.checkAndShow).toHaveBeenCalledWith("main");
});
