import { DarwinTray } from "@mahiru/app/lib/tray/darwin";
import type { MessageData } from "@mahiru/ipc/types";
import type { MenuLyricEvent, MenuLyricEventHandler } from "@mahiru/native";

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (data: unknown) => void>(),
  showMenu: vi.fn(),
  hideMenu: vi.fn(),
  showMain: vi.fn(),
  trayWindow: {
    addListener: vi.fn(),
    webContents: { addListener: vi.fn(), isDevToolsOpened: () => false }
  },
  native: {
    initMenuBar: vi.fn(),
    setMenuLyric: vi.fn(),
    setMenuBarToolTip: vi.fn(),
    setMenuLyricProgress: vi.fn()
  }
}));

vi.mock("electron", () => ({ Menu: { setApplicationMenu: vi.fn() }, BrowserWindow: class {} }));
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
vi.mock("@mahiru/app/lib/native-addon", () => ({
  MainNativeAddon: { isSupported: true, native: mocks.native, darwin: mocks.native }
}));
vi.mock("@mahiru/app/lib/path-resolver", () => ({
  MainPathResolver: { menuBarIconPath: "/menu-bar.png" }
}));
vi.mock("@mahiru/app/lib/window-preset", () => ({ MainWindowPreset: {} }));
vi.mock("@mahiru/app/lib/window-creator", () => ({ MainWindowCreator: { create: vi.fn() } }));
vi.mock("@mahiru/app/lib/window-manager", () => ({
  MainWindowManager: { get: () => mocks.trayWindow, checkAndShow: mocks.showMain }
}));
vi.mock("@mahiru/app/lib/tray/utils", () => ({
  TrayUtils: class {
    customMenuVisible = false;
    showRawMenu() {}
    showCustomMenu(...args: unknown[]) {
      this.customMenuVisible = true;
      mocks.showMenu(...args);
    }
    hideCustomMenu(...args: unknown[]) {
      this.customMenuVisible = false;
      mocks.hideMenu(...args);
    }
  }
}));

type Meta = MessageData<"bus_deliver_track_meta">;
type Progress = MessageData<"bus_deliver_track_progress">;

function lyricLine(startTime: number, endTime: number, text: string): LyricLine {
  return {
    startTime,
    endTime,
    words: [{ word: text, startTime, endTime }],
    translatedLyric: "",
    romanLyric: ""
  };
}

function meta(id: number, prefix = `Song ${id}`, status: Meta["status"] = "playing"): Meta {
  return {
    track: { id, name: `Song ${id}` } as NonNullable<Meta["track"]>,
    lyric: {
      data: [lyricLine(0, 60_000, `${prefix} intro`), lyricLine(60_000, 180_000, `${prefix} late`)],
      rmExisted: false,
      tlExisted: false,
      noteExisted: false
    },
    status,
    mode: "normal",
    repeat: "all",
    shuffle: false,
    rmActive: false,
    tlActive: false,
    noteActive: false,
    playlistMarkId: "test"
  };
}

function deliverMeta(data: Meta) {
  mocks.listeners.get("bus_deliver_track_meta")!(data);
}

function deliverProgress(trackID: number, currentTime: number) {
  const data: Progress = { trackID, currentTime, duration: 180, volume: 1, buffered: 0 };
  mocks.listeners.get("bus_deliver_track_progress")!(data);
}

function click(kind: MenuLyricEvent["kind"]) {
  const handler = mocks.native.setMenuLyric.mock.calls[0]![2] as MenuLyricEventHandler;
  handler(null, { kind, x: 100, y: 100, width: 180, height: 22, displayId: 1 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners.clear();
  new DarwinTray();
});

afterEach(() => vi.restoreAllMocks());

it("toggles the menu synchronously on each left click without scheduling a delay", () => {
  const timeout = vi.spyOn(globalThis, "setTimeout");
  click("click");
  expect(mocks.showMenu).toHaveBeenCalledOnce();
  expect(mocks.hideMenu).not.toHaveBeenCalled();
  expect(timeout).not.toHaveBeenCalled();

  click("click");
  expect(mocks.hideMenu).toHaveBeenCalledExactlyOnceWith(mocks.trayWindow);
  expect(mocks.showMenu).toHaveBeenCalledOnce();
  expect(mocks.showMain).not.toHaveBeenCalled();
  expect(timeout).not.toHaveBeenCalled();
});

it("closes the menu opened by the first click before showing main on a double click", () => {
  const timeout = vi.spyOn(globalThis, "setTimeout");
  click("click");
  expect(mocks.showMenu).toHaveBeenCalledOnce();
  click("double-click");

  expect(mocks.hideMenu).toHaveBeenCalledExactlyOnceWith(mocks.trayWindow);
  expect(mocks.showMain).toHaveBeenCalledExactlyOnceWith("main");
  expect(mocks.hideMenu.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.showMain.mock.invocationCallOrder[0]!
  );
  expect(timeout).not.toHaveBeenCalled();
});

it("continues toggling the menu immediately on right clicks", () => {
  const timeout = vi.spyOn(globalThis, "setTimeout");
  click("right-click");
  expect(mocks.showMenu).toHaveBeenCalledOnce();
  expect(mocks.hideMenu).not.toHaveBeenCalled();
  click("right-click");
  expect(mocks.showMenu).toHaveBeenCalledOnce();
  expect(mocks.hideMenu).toHaveBeenCalledExactlyOnceWith(mocks.trayWindow);
  expect(mocks.showMain).not.toHaveBeenCalled();
  expect(timeout).not.toHaveBeenCalled();
});

it("starts new metadata at zero and ignores progress from the previous track", () => {
  deliverMeta(meta(1));
  deliverProgress(1, 100);
  expect(mocks.native.setMenuLyric.mock.calls.at(-1)![0]).toBe("Song 1 late");

  deliverMeta(meta(2));
  expect(mocks.native.setMenuLyric.mock.calls.at(-1)![0]).toBe("Song 2 intro");
  expect(mocks.native.setMenuLyricProgress).toHaveBeenLastCalledWith(0, true);
  const lines = mocks.native.setMenuLyric.mock.calls.length;
  const progresses = mocks.native.setMenuLyricProgress.mock.calls.length;
  deliverProgress(1, 110);
  expect(mocks.native.setMenuLyric).toHaveBeenCalledTimes(lines);
  expect(mocks.native.setMenuLyricProgress).toHaveBeenCalledTimes(progresses);

  deliverProgress(2, 70);
  expect(mocks.native.setMenuLyric.mock.calls.at(-1)![0]).toBe("Song 2 late");
  expect(mocks.native.setMenuLyricProgress).toHaveBeenLastCalledWith(10_000, true);
});

it("keeps new-track progress that arrives before its metadata", () => {
  deliverMeta(meta(1));
  deliverProgress(1, 100);
  const lines = mocks.native.setMenuLyric.mock.calls.length;
  deliverProgress(2, 70);
  expect(mocks.native.setMenuLyric).toHaveBeenCalledTimes(lines);

  deliverMeta(meta(2));
  expect(mocks.native.setMenuLyric.mock.calls.at(-1)![0]).toBe("Song 2 late");
  expect(mocks.native.setMenuLyricProgress).toHaveBeenLastCalledWith(10_000, true);
});

it("preserves progress while refreshing lyrics or pausing the same track", () => {
  deliverMeta(meta(1));
  deliverProgress(1, 100);
  deliverMeta(meta(1, "Updated song", "paused"));

  expect(mocks.native.setMenuLyric.mock.calls.at(-1)![0]).toBe("Updated song late");
  expect(mocks.native.setMenuLyricProgress).toHaveBeenLastCalledWith(40_000, false);
});
