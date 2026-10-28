import { EventEmitter } from "node:events";
import { MainWindowPreset } from "@mahiru/app/lib/window-preset";
import type { BrowserWindow } from "electron";

const mocks = vi.hoisted(() => ({ closeBrowser: vi.fn() }));

vi.mock("electron", () => ({ app: {}, dialog: {} }));
vi.mock("@mahiru/app/lib/log", () => ({ Log: { error: vi.fn() } }));
vi.mock("@mahiru/app/utils/args", () => ({ getArgFlag: () => false }));
vi.mock("@mahiru/app/lib/runtime", () => ({ MainRuntime: { isDev: false } }));
vi.mock("@mahiru/app/lib/web-search", () => ({ WebBrowser: { close: mocks.closeBrowser } }));
vi.mock("@mahiru/app/lib/path-resolver", () => ({
  MainPathResolver: { preloadPath: "/preload.cjs", appLogoPath: "/logo.png" }
}));
vi.mock("@mahiru/app/lib/window-manager", () => ({ MainWindowManager: {} }));
vi.mock("@mahiru/app/lib/screen-resolver", () => ({
  MainScreenResolver: {
    primary: {
      adaptiveWindowSizePreset: () => ({
        min: { width: 100, height: 100 },
        base: { width: 800, height: 600 }
      })
    }
  }
}));

class WindowStub extends EventEmitter {
  destroyed = false;
  webContents = { openDevTools: vi.fn() };
  hide = vi.fn();
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.emit("closed");
  }
}

describe("Agent 窗口与浏览器资源生命周期", () => {
  beforeEach(() => vi.clearAllMocks());

  it("实际 closed 事件释放浏览器，直接 destroy 也走相同清理路径", () => {
    const window = new WindowStub();
    MainWindowPreset.agent.onCreate?.(window as unknown as BrowserWindow);

    window.hide();
    window.emit("close");
    expect(mocks.closeBrowser).not.toHaveBeenCalled();

    window.destroy();
    expect(mocks.closeBrowser).toHaveBeenCalledOnce();
    window.destroy();
    window.emit("closed");
    expect(mocks.closeBrowser).toHaveBeenCalledOnce();
  });

  it("关闭其他设置窗口不会清理 Agent 浏览器", () => {
    const window = new WindowStub();
    MainWindowPreset.display.onCreate?.(window as unknown as BrowserWindow);

    window.destroy();

    expect(mocks.closeBrowser).not.toHaveBeenCalled();
  });
});
