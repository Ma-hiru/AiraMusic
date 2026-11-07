import { MainWindowCreator } from "@mahiru/app/lib/window-creator";
import type { BrowserWindowConstructorOptions } from "electron";
import type { AppWindowCreatorProps } from "@mahiru/app/types/window";

const mocks = vi.hoisted(() => ({
  memo: { x: 100, y: 100, width: 4000, height: 2400 },
  display: vi.fn(),
  outside: vi.fn(),
  create: vi.fn(),
  loadURL: vi.fn(async () => undefined),
  setFrameURL: vi.fn()
}));

vi.mock("electron", () => ({
  BrowserWindow: class {},
  screen: { getDisplayNearestPoint: mocks.display }
}));
vi.mock("@mahiru/app/lib/log", () => ({ Log: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@mahiru/app/lib/handle", () => ({
  MainHandle: {
    get: () => ({
      services: { ready: async () => undefined, ports: async () => ({ proxy: 8828 }) }
    })
  }
}));
vi.mock("@mahiru/app/lib/runtime", () => ({ MainRuntime: { isDev: false } }));
vi.mock("@mahiru/app/lib/window-manager", () => ({
  MainWindowManager: {
    checkAndShow: () => null,
    createBrowserWindow: mocks.create,
    setAppFrameURL: mocks.setFrameURL
  }
}));
vi.mock("@mahiru/app/lib/key-value-store", () => ({
  MainStoreForWindow: { get: () => mocks.memo, set: vi.fn() }
}));
vi.mock("@mahiru/app/lib/screen-resolver", () => ({
  MainScreenResolver: {
    isOutScreenDIPBounds: mocks.outside,
    primary: { effectiveWorkAreaSize: { width: 1920, height: 1080 } }
  }
}));

function restore(id: AppWindowCreatorProps["id"], options: BrowserWindowConstructorOptions) {
  MainWindowCreator.create({
    id,
    memoPos: true,
    options,
    loadURL: (port) => `https://localhost:${port}`
  });
  return mocks.create.mock.calls.at(-1)![0] as BrowserWindowConstructorOptions;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.memo = { x: 100, y: 100, width: 4000, height: 2400 };
  mocks.outside.mockReturnValue(false);
  mocks.display.mockReturnValue({ workAreaSize: { width: 1280, height: 720 } });
  mocks.create.mockImplementation(() => ({
    webContents: { setWindowOpenHandler: vi.fn() },
    unmaximize: vi.fn(),
    addListener: vi.fn(),
    center: vi.fn(),
    getBounds: () => mocks.memo,
    loadURL: mocks.loadURL
  }));
});

it("shrinks saved bounds to the work area while retaining usable minimum constraints", () => {
  const options = restore("main", { minWidth: 896, minHeight: 539 });

  expect(options).toMatchObject({
    x: 100,
    y: 100,
    width: 1280,
    height: 720,
    minWidth: 896,
    minHeight: 539
  });
});

it("reduces Electron minimum constraints when the work area is smaller than the preset", () => {
  mocks.display.mockReturnValue({ workAreaSize: { width: 640, height: 360 } });
  const options = restore("main", { minWidth: 896, minHeight: 539 });

  expect(options).toMatchObject({ width: 640, height: 360, minWidth: 640, minHeight: 360 });
});

it("keeps an already adapted minimum instead of restoring the larger raw preset minimum", () => {
  mocks.memo = { x: 100, y: 100, width: 610, height: 355 };
  mocks.display.mockReturnValue({ workAreaSize: { width: 640, height: 360 } });
  const options = restore("main", { minWidth: 600, minHeight: 350 });

  expect(options).toMatchObject({ width: 610, height: 355, minWidth: 600, minHeight: 350 });
});

it("honors configured maximum sizes while fitting the remaining dimension to the work area", () => {
  const options = restore("comments", {
    minWidth: 112,
    minHeight: 300,
    maxWidth: 450,
    maxHeight: 1200
  });

  expect(options).toMatchObject({ width: 450, height: 720, minWidth: 112, minHeight: 300 });
});

it("uses the saved window's secondary display rather than the primary work area", () => {
  mocks.memo = { x: 2100, y: 100, width: 1400, height: 900 };
  mocks.display.mockImplementation(({ x }: { x: number }) => ({
    workAreaSize: x >= 1920 ? { width: 800, height: 600 } : { width: 1920, height: 1080 }
  }));
  const options = restore("main", { minWidth: 896, minHeight: 539 });

  expect(mocks.display).toHaveBeenCalledExactlyOnceWith({ x: 2100, y: 100 });
  expect(options).toMatchObject({ x: 2100, y: 100, width: 800, height: 600, minWidth: 800 });
});
