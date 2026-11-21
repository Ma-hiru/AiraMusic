import { eventHandlers } from "@mahiru/app/inner/ipc/event";
import type { Rectangle, IpcMainEvent } from "electron";

const mocks = vi.hoisted(() => ({
  getId: vi.fn(),
  fromWebContents: vi.fn(),
  getDisplayMatching: vi.fn()
}));

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: mocks.fromWebContents },
  screen: { getDisplayMatching: mocks.getDisplayMatching }
}));
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

function radioWindow(bounds: Rectangle, workArea: Rectangle) {
  const win = {
    resizable: false,
    getBounds: () => bounds,
    setBounds: vi.fn((target: Rectangle) => {
      bounds = target;
    }),
    setResizable: vi.fn()
  };
  mocks.getId.mockReturnValue("radio");
  mocks.fromWebContents.mockReturnValue(win);
  mocks.getDisplayMatching.mockReturnValue({ workArea, workAreaSize: workArea });
  return win;
}

beforeEach(() => vi.resetAllMocks());

it.each([
  { x: -1280, y: 0 },
  { x: 0, y: -720 }
])("restores the same Radio size after repeated toggles on a display at %j", ({ x, y }) => {
  const workArea = { x, y, width: 1280, height: 720 };
  const expanded = { x: x + 100, y: y + 100, width: 640, height: 320 };
  const collapsed = { ...expanded, width: 472, height: 288 };
  const win = radioWindow(expanded, workArea);

  for (let i = 0; i < 2; i++) {
    eventHandlers.event_radio_comment_panel(event, false);
    expect(win.setBounds).toHaveBeenLastCalledWith(collapsed, false);
    eventHandlers.event_radio_comment_panel(event, true);
    expect(win.setBounds).toHaveBeenLastCalledWith(expanded, false);
  }
  expect(mocks.getDisplayMatching.mock.calls.map(([bounds]) => bounds)).toEqual([
    expanded,
    collapsed,
    expanded,
    collapsed
  ]);
  expect(win.setResizable).toHaveBeenLastCalledWith(false);
});

it("fits the expanded Radio within a small secondary display", () => {
  const workArea = { x: -600, y: 27, width: 600, height: 480 };
  const win = radioWindow({ x: -472, y: 219, width: 472, height: 288 }, workArea);

  eventHandlers.event_radio_comment_panel(event, true);

  expect(win.setBounds).toHaveBeenCalledExactlyOnceWith(
    { x: -570, y: 219, width: 570, height: 285 },
    false
  );
});
