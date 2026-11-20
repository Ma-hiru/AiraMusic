import { eventHandlers } from "@mahiru/app/inner/ipc/event";
import type { IpcMainEvent } from "electron";

const mocks = vi.hoisted(() => ({
  getId: vi.fn(),
  fromWebContents: vi.fn(),
  checkAndShow: vi.fn()
}));

vi.mock("electron", () => ({ BrowserWindow: { fromWebContents: mocks.fromWebContents } }));
vi.mock("@/lib/tray", () => ({ MainTray: {} }));
vi.mock("@/lib/handle", () => ({ MainHandle: {} }));
vi.mock("@/lib/log", () => ({
  Log: {},
  runWithLogContext: (_: unknown, run: () => unknown) => run()
}));
vi.mock("@/lib/window-preset", () => ({ MainWindowPreset: {} }));
vi.mock("@/lib/window-creator", () => ({ MainWindowCreator: {} }));
vi.mock("@/lib/window-manager", () => ({ MainWindowManager: mocks }));

const event = { sender: {} } as IpcMainEvent;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.fromWebContents.mockReturnValue({});
  mocks.getId.mockReturnValue("miniplayer");
});

it.each([
  ["display", ["display"]],
  ["comments", ["display", "comments"]],
  ["image", ["display", "comments", "image"]],
  ["main", ["display", "comments", "image", "main"]]
])("uses the first existing window when %s is available", (available, expected) => {
  mocks.checkAndShow.mockImplementation((target: string) => (target === available ? {} : null));

  eventHandlers.event_miniplayer_focus_window(event, undefined);

  expect(mocks.checkAndShow.mock.calls.flat()).toEqual(expected);
});

it("ignores the mini-player action from a different window", () => {
  mocks.getId.mockReturnValue("display");
  eventHandlers.event_miniplayer_focus_window(event, undefined);
  expect(mocks.checkAndShow).not.toHaveBeenCalled();
});
