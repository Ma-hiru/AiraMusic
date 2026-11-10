import { EventEmitter } from "node:events";

type Action = "next" | "play" | "pause" | "previous";
type ActionHandler = (error: null | Error, action: Action) => void;
type ImageResponse = { ok: boolean; bytes: () => Promise<Uint8Array> };

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (data: unknown) => void>(),
  getWindow: vi.fn(),
  commit: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  getIcons: vi.fn(),
  native: {
    setCover: vi.fn<(handle: Buffer, image: null | Uint8Array) => void>(),
    setTaskbarButtons:
      vi.fn<
        (
          handle: Buffer,
          playing: boolean,
          icons: Record<Action, Uint8Array>,
          onAction: ActionHandler
        ) => void
      >()
  }
}));

vi.mock("@mahiru/app/lib/log", () => ({ Log: { warn: mocks.warn, error: mocks.error } }));
vi.mock("@mahiru/ipc/main", () => ({
  MainIPC: {
    MessageChannel: {
      listen: (channel: string, listener: (data: unknown) => void) => {
        mocks.listeners.set(channel, listener);
      },
      commit: mocks.commit
    }
  }
}));
vi.mock("@mahiru/app/lib/native-addon", () => ({
  MainNativeAddon: { isSupported: true, native: mocks.native, windows: mocks.native }
}));
vi.mock("@mahiru/app/lib/window-manager", () => ({
  MainWindowManager: { get: mocks.getWindow }
}));
vi.mock("@mahiru/app/utils/thumbar-button", () => ({ getThumbarIcons: mocks.getIcons }));

class TestWindow extends EventEmitter {
  visible = true;
  destroyed = false;
  handle = Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]);
  isVisible = () => this.visible;
  isDestroyed = () => this.destroyed;
  getNativeWindowHandle = vi.fn(() => {
    if (this.destroyed) throw new Error("window destroyed");
    return this.handle;
  });
  setThumbarButtons = vi.fn();
}

const coverA = "https://covers.test/a.jpg";
const coverB = "https://covers.test/b.jpg";
const imageA = Uint8Array.of(1, 2, 3);
const imageB = Uint8Array.of(4, 5, 6);

function response(image: Uint8Array, ok = true): ImageResponse {
  return { ok, bytes: async () => image };
}

function deliver(cover?: string, playing = true) {
  mocks.listeners.get("bus_deliver_track_meta")!({
    track: cover ? { detail: { al: { picUrl: cover } } } : null,
    status: playing ? "playing" : "paused"
  });
}

async function flush() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

let taskbar: typeof import("@mahiru/app/lib/taskbar-cover").MainTaskBarCoverPreview;
let win: TestWindow;
let fetchCover: ReturnType<typeof vi.fn<(url: URL) => Promise<ImageResponse>>>;
let icons: Record<Action, { toPNG: ReturnType<typeof vi.fn<() => Buffer>> }>;

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.listeners.clear();
  win = new TestWindow();
  mocks.getWindow.mockReturnValue(win);
  icons = {
    previous: { toPNG: vi.fn(() => Buffer.from([10])) },
    play: { toPNG: vi.fn(() => Buffer.from([20])) },
    pause: { toPNG: vi.fn(() => Buffer.from([30])) },
    next: { toPNG: vi.fn(() => Buffer.from([40])) }
  };
  mocks.getIcons.mockReturnValue(icons);
  fetchCover = vi.fn<(url: URL) => Promise<ImageResponse>>().mockResolvedValue(response(imageA));
  vi.stubGlobal("fetch", fetchCover);

  const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { ...platform, value: "win32" });
  try {
    ({ MainTaskBarCoverPreview: taskbar } = await import("@mahiru/app/lib/taskbar-cover"));
  } finally {
    Object.defineProperty(process, "platform", platform);
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("registers native buttons and the track received before the first show", async () => {
  win.visible = false;
  deliver(coverA);
  taskbar.attach();
  expect(mocks.native.setTaskbarButtons).not.toHaveBeenCalled();
  expect(fetchCover).not.toHaveBeenCalled();

  win.visible = true;
  win.emit("show");
  await flush();

  expect(mocks.native.setTaskbarButtons).toHaveBeenCalledWith(
    win.handle,
    true,
    {
      previous: Buffer.from([10]),
      play: Buffer.from([20]),
      pause: Buffer.from([30]),
      next: Buffer.from([40])
    },
    expect.any(Function)
  );
  expect(mocks.native.setCover).toHaveBeenLastCalledWith(win.handle, imageA);
  expect(win.setThumbarButtons).not.toHaveBeenCalled();
});

it("keeps the previous cover until the replacement image is ready", async () => {
  taskbar.attach();
  deliver(coverA);
  await flush();
  mocks.native.setCover.mockClear();

  const pending = Promise.withResolvers<ImageResponse>();
  fetchCover.mockReturnValueOnce(pending.promise);
  deliver(coverB);
  await flush();
  expect(mocks.native.setCover).not.toHaveBeenCalled();

  pending.resolve(response(imageB));
  await flush();
  expect(mocks.native.setCover).toHaveBeenCalledExactlyOnceWith(win.handle, imageB);
});

it("discards obsolete results when the cover changes from A to B and back to A", async () => {
  taskbar.attach();
  const firstA = Promise.withResolvers<ImageResponse>();
  const pendingB = Promise.withResolvers<ImageResponse>();
  const latestA = Promise.withResolvers<ImageResponse>();
  fetchCover
    .mockReturnValueOnce(firstA.promise)
    .mockReturnValueOnce(pendingB.promise)
    .mockReturnValueOnce(latestA.promise);

  deliver(coverA);
  deliver(coverB);
  deliver(coverA);
  expect(fetchCover).toHaveBeenCalledTimes(3);
  const latestImage = Uint8Array.of(7, 8, 9);
  latestA.resolve(response(latestImage));
  await flush();
  expect(mocks.native.setCover).toHaveBeenLastCalledWith(win.handle, latestImage);
  const applied = mocks.native.setCover.mock.calls.length;

  firstA.resolve(response(imageA));
  pendingB.resolve(response(imageB));
  await flush();
  expect(mocks.native.setCover).toHaveBeenCalledTimes(applied);
});

it("updates playback buttons without fetching or replacing an unchanged cover", async () => {
  taskbar.attach();
  deliver(coverA);
  await flush();
  mocks.native.setCover.mockClear();
  mocks.native.setTaskbarButtons.mockClear();

  deliver(coverA, false);
  await flush();
  expect(mocks.native.setTaskbarButtons).toHaveBeenCalledWith(
    win.handle,
    false,
    expect.any(Object),
    expect.any(Function)
  );
  expect(fetchCover).toHaveBeenCalledOnce();
  expect(mocks.native.setCover).not.toHaveBeenCalled();
  for (const icon of Object.values(icons)) expect(icon.toPNG).toHaveBeenCalledOnce();
});

it("shares a pending cover request across playback and window restore events", async () => {
  taskbar.attach();
  const pending = Promise.withResolvers<ImageResponse>();
  fetchCover.mockReturnValueOnce(pending.promise);
  deliver(coverA);
  deliver(coverA, false);
  win.emit("focus");
  win.emit("restore");
  expect(fetchCover).toHaveBeenCalledOnce();

  pending.resolve(response(imageA));
  await flush();
  expect(mocks.native.setCover).toHaveBeenLastCalledWith(win.handle, imageA);
  expect(mocks.native.setTaskbarButtons.mock.calls.at(-1)?.[1]).toBe(false);
});

it("keeps the applied cover and buttons unchanged across repeated focus events", async () => {
  taskbar.attach();
  deliver(coverA);
  await flush();
  mocks.native.setCover.mockClear();
  mocks.native.setTaskbarButtons.mockClear();

  for (let i = 0; i < 10; i++) win.emit("focus");
  await flush();
  deliver(coverA);
  await flush();

  expect(mocks.native.setCover).not.toHaveBeenCalled();
  expect(mocks.native.setTaskbarButtons).not.toHaveBeenCalled();
  expect(fetchCover).toHaveBeenCalledOnce();
});

it.each(["show", "restore"])(
  "reapplies native buttons and cached cover after %s",
  async (event) => {
    taskbar.attach();
    deliver(coverA);
    await flush();
    mocks.native.setCover.mockClear();
    mocks.native.setTaskbarButtons.mockClear();

    win.emit(event);
    await flush();
    expect(mocks.native.setTaskbarButtons).toHaveBeenCalledOnce();
    expect(mocks.native.setCover).toHaveBeenCalledExactlyOnceWith(win.handle, imageA);
    expect(fetchCover).toHaveBeenCalledOnce();
  }
);

it.each(["http", "network", "body"])(
  "clears a previous cover after a %s failure",
  async (failure) => {
    taskbar.attach();
    deliver(coverA);
    await flush();
    mocks.native.setCover.mockClear();

    if (failure === "http") fetchCover.mockResolvedValueOnce(response(imageB, false));
    else if (failure === "body") {
      fetchCover.mockResolvedValueOnce({
        ok: true,
        bytes: async () => {
          throw new Error("response body failed");
        }
      });
    } else fetchCover.mockRejectedValueOnce(new Error("fetch failed"));
    deliver(coverB);
    await flush();
    expect(mocks.native.setCover).toHaveBeenCalledExactlyOnceWith(win.handle, null);
  }
);

it("preserves the cover after a button update failure and retries on the next metadata event", async () => {
  taskbar.attach();
  deliver(coverA);
  await flush();
  mocks.native.setCover.mockClear();
  mocks.native.setTaskbarButtons.mockClear();

  const error = new Error("native buttons failed");
  mocks.native.setTaskbarButtons.mockImplementationOnce(() => {
    throw error;
  });
  deliver(coverA, false);
  await flush();
  expect(mocks.native.setCover).not.toHaveBeenCalled();
  expect(mocks.native.setTaskbarButtons).toHaveBeenCalledOnce();
  expect(mocks.warn).toHaveBeenCalledWith("taskbar", expect.any(String), error);

  deliver(coverA, false);
  await flush();
  expect(mocks.native.setTaskbarButtons).toHaveBeenCalledTimes(2);
  expect(mocks.native.setTaskbarButtons).toHaveBeenLastCalledWith(
    win.handle,
    false,
    expect.any(Object),
    expect.any(Function)
  );
  expect(mocks.native.setCover).not.toHaveBeenCalled();
  expect(fetchCover).toHaveBeenCalledOnce();

  deliver(coverA, false);
  await flush();
  expect(mocks.native.setTaskbarButtons).toHaveBeenCalledTimes(2);
});

it("applies a new cover even when updating its playback buttons fails", async () => {
  taskbar.attach();
  deliver(coverA);
  await flush();
  mocks.native.setCover.mockClear();

  const error = new Error("native buttons failed");
  mocks.native.setTaskbarButtons.mockImplementationOnce(() => {
    throw error;
  });
  fetchCover.mockResolvedValueOnce(response(imageB));
  deliver(coverB, false);
  await flush();

  expect(mocks.native.setCover).toHaveBeenCalledExactlyOnceWith(win.handle, imageB);
  expect(mocks.warn).toHaveBeenCalledWith("taskbar", expect.any(String), error);
});

it("clears a previous cover when the current track has no cover", async () => {
  taskbar.attach();
  deliver(coverA);
  await flush();
  mocks.native.setCover.mockClear();

  deliver();
  await flush();
  expect(mocks.native.setCover).toHaveBeenCalledExactlyOnceWith(win.handle, null);
  expect(fetchCover).toHaveBeenCalledOnce();
});

it.each(["idle", "error"])(
  "clears the cover in %s state even when metadata retains the previous artwork",
  async (status) => {
    taskbar.attach();
    deliver(coverA);
    await flush();
    mocks.native.setCover.mockClear();

    mocks.listeners.get("bus_deliver_track_meta")!({
      track: { detail: { al: { picUrl: coverA } } },
      status
    });
    await flush();
    expect(mocks.native.setCover).toHaveBeenCalledExactlyOnceWith(win.handle, null);
    expect(fetchCover).toHaveBeenCalledOnce();
    expect(mocks.native.setTaskbarButtons.mock.calls.at(-1)?.[1]).toBe(false);
  }
);

it("rolls back to the default representation when applying a cover throws", async () => {
  taskbar.attach();
  const error = new Error("native failed");
  mocks.native.setCover.mockImplementationOnce(() => {
    throw error;
  });
  deliver(coverA);
  await flush();
  expect(mocks.native.setCover).toHaveBeenLastCalledWith(win.handle, null);
  expect(mocks.warn).toHaveBeenCalledWith("taskbar", expect.any(String), error);
});

it.each<Action>(["previous", "play", "pause", "next"])(
  "forwards the native %s action to the player",
  (action) => {
    taskbar.attach();
    const callback = mocks.native.setTaskbarButtons.mock.calls[0]![3];
    callback(null, action);
    expect(mocks.commit).toHaveBeenCalledExactlyOnceWith({
      type: "bus_dispatch_player_action",
      sender: "process",
      receiver: "main",
      data: action
    });
  }
);

it("logs native callback errors without dispatching a player action", () => {
  taskbar.attach();
  const error = new Error("callback failed");
  const callback = mocks.native.setTaskbarButtons.mock.calls[0]![3];
  callback(error, "next");
  expect(mocks.commit).not.toHaveBeenCalled();
  expect(mocks.warn).toHaveBeenCalledWith("taskbar", "native taskbar error", error);
});

it("retries native buttons after an asynchronous error without touching the applied cover", async () => {
  taskbar.attach();
  deliver(coverA);
  await flush();
  const callback = mocks.native.setTaskbarButtons.mock.calls.at(-1)![3];
  mocks.native.setCover.mockClear();
  mocks.native.setTaskbarButtons.mockClear();
  fetchCover.mockClear();

  const error = new Error("asynchronous native error");
  callback(error, "next");
  expect(mocks.commit).not.toHaveBeenCalled();
  expect(mocks.native.setTaskbarButtons).not.toHaveBeenCalled();
  expect(mocks.native.setCover).not.toHaveBeenCalled();

  deliver(coverA);
  await flush();
  expect(mocks.native.setTaskbarButtons).toHaveBeenCalledExactlyOnceWith(
    win.handle,
    true,
    expect.any(Object),
    expect.any(Function)
  );
  expect(mocks.native.setCover).not.toHaveBeenCalled();
  expect(fetchCover).not.toHaveBeenCalled();

  deliver(coverA);
  await flush();
  expect(mocks.native.setTaskbarButtons).toHaveBeenCalledOnce();
  expect(mocks.native.setCover).not.toHaveBeenCalled();
  expect(fetchCover).not.toHaveBeenCalled();
});

it("ignores an in-flight cover result after its window is destroyed", async () => {
  taskbar.attach();
  const pending = Promise.withResolvers<ImageResponse>();
  fetchCover.mockReturnValueOnce(pending.promise);
  deliver(coverA);
  win.destroyed = true;
  win.emit("closed");
  mocks.native.setCover.mockClear();
  win.getNativeWindowHandle.mockClear();

  pending.resolve(response(imageA));
  await flush();
  expect(mocks.native.setCover).not.toHaveBeenCalled();
  expect(win.getNativeWindowHandle).not.toHaveBeenCalled();
});

it("attaches a replacement window and ignores the previous window's pending request", async () => {
  taskbar.attach();
  const pending = Promise.withResolvers<ImageResponse>();
  fetchCover.mockReturnValueOnce(pending.promise);
  deliver(coverA);
  win.destroyed = true;
  win.emit("closed");

  const replacement = new TestWindow();
  replacement.handle = Buffer.from([2, 0, 0, 0, 0, 0, 0, 0]);
  mocks.getWindow.mockReturnValue(replacement);
  fetchCover.mockResolvedValueOnce(response(imageB));
  taskbar.attach();
  await flush();
  expect(mocks.native.setTaskbarButtons.mock.calls.at(-1)?.[0]).toBe(replacement.handle);
  expect(mocks.native.setCover).toHaveBeenLastCalledWith(replacement.handle, imageB);
  const applied = mocks.native.setCover.mock.calls.length;

  pending.resolve(response(imageA));
  await flush();
  expect(mocks.native.setCover).toHaveBeenCalledTimes(applied);
});
