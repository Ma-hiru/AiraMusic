import { MainApp } from "../../src/entry/app";
import { MainExitCodeConstants } from "../../src/constants/exit-code";

const mocks = vi.hoisted(() => ({ quit: vi.fn(), exit: vi.fn(), warn: vi.fn() }));
vi.mock("electron", () => ({ app: { quit: mocks.quit, exit: mocks.exit } }));
vi.mock("../../src/lib/log", () => ({
  Log: { warn: mocks.warn, error: vi.fn() },
  runWithLogContext: <T>(_context: unknown, callback: () => T) => callback()
}));
vi.mock("../../src/lib/window-manager", () => ({ MainWindowManager: { getAll: () => [] } }));
vi.mock("../../src/lib/tray", () => ({ MainTray: {} }));
vi.mock("../../src/inner/agent", () => ({ MainAgent: {} }));
vi.mock("../../src/services", () => ({ MainServices: {} }));
vi.mock("@mahiru/ipc/main", () => ({ MainIPC: {} }));
vi.mock("../../src/lib/window-preset", () => ({ MainWindowPreset: {} }));
vi.mock("../../src/lib/window-creator", () => ({ MainWindowCreator: {} }));
vi.mock("../../src/lib/screen-resolver", () => ({ MainScreenResolver: {} }));
vi.mock("../../src/lib/taskbar-cover", () => ({ MainTaskBarCoverPreview: {} }));
vi.mock("../../src/inner/ipc", () => ({
  ipcInit: vi.fn(),
  broadcastAgentFeatureSettings: vi.fn()
}));

describe("MainApp 退出 deadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const create = (shutdown = vi.fn(async () => {})) => {
    const app = new MainApp();
    const stopAll = vi.fn(async () => {});
    Object.assign(app, {
      _agent: { shutdown },
      _services: { stopAll },
      emitStopMessageToMainRenderer: vi.fn(async () => {})
    });
    return { app, stopAll };
  };

  it("Agent 停止永不完成时仍在整体预算到期后退出", async () => {
    const stopped = Promise.withResolvers<void>();
    const { app, stopAll } = create(vi.fn(() => stopped.promise));
    app.exit(MainExitCodeConstants.NORMAL_EXIT, "test");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(MainExitCodeConstants.NORMAL_EXIT);
    expect(mocks.quit).not.toHaveBeenCalled();
    stopped.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(stopAll).toHaveBeenCalledOnce();
    expect(mocks.quit).not.toHaveBeenCalled();
    expect(mocks.exit).toHaveBeenCalledOnce();
  });

  it("正常清理后通过 app.quit 退出并移除 deadline", async () => {
    const { app, stopAll } = create();
    app.exit(MainExitCodeConstants.NORMAL_EXIT, "test");
    await vi.advanceTimersByTimeAsync(0);
    expect(stopAll).toHaveBeenCalledOnce();
    expect(mocks.quit).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(mocks.exit).not.toHaveBeenCalled();
  });
});
