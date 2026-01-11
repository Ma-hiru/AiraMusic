import { BrowserWindow, BrowserWindowConstructorOptions, Tray } from "electron";
import NativeImage = Electron.NativeImage;

export type WindowID = WindowType;

export enum WindowExits {
  IGNORE,
  CLOSE,
  DESTROY
}

export const WindowManager = new (class {
  private readonly BrowserWindowList = new Map<WindowID, BrowserWindow>();
  private readonly BrowserWindowListHasNoID = new Set<BrowserWindow>();
  private tray: Nullable<Tray> = null;
  constructor() {}

  /**
   * 创建一个浏览器窗口。
   *
   * @param {BrowserWindowConstructorOptions} [options] - 浏览器窗口配置。
   * @param {WindowID} [id] - 窗口的唯一 ID。
   * @param {WindowExits} [handleExits=HandleExits.IGNORE] - 当窗口已存在时的处理策略。
   *   - `WindowExits.IGNORE`：忽略，直接返回已存在的窗口。
   *   - `WindowExits.CLOSE`：关闭已存在的窗口。
   *   - `WindowExits.DESTROY`：销毁已存在的窗口。
   * @returns {BrowserWindow} 浏览器窗口实例。
   */
  createBrowserWindow(
    options?: BrowserWindowConstructorOptions,
    id?: WindowID,
    handleExits: WindowExits = WindowExits.IGNORE
  ) {
    let window;
    if (id) {
      // 检查是否已存在具有相同 ID 的窗口
      const oldWindow = this.BrowserWindowList.get(id);
      if (oldWindow) {
        // 根据 handleExits 参数处理已存在的窗口
        switch (handleExits) {
          case WindowExits.DESTROY:
            oldWindow.destroy();
            break;
          case WindowExits.CLOSE:
            oldWindow.close();
            break;
          case WindowExits.IGNORE:
            if (oldWindow.isMinimized()) {
              oldWindow.restore();
            }
            oldWindow.focus();
            return oldWindow;
        }
      }
      // 创建并存储新的窗口实例
      window = new BrowserWindow(options);
      this.BrowserWindowList.set(id, window);
    } else {
      // 创建没有 ID 的窗口实例
      window = new BrowserWindow(options);
      this.BrowserWindowListHasNoID.add(window);
    }
    this.bindWindowCloseEvent(window, id);
    return window;
  }

  has(id: WindowID) {
    return this.BrowserWindowList.has(id);
  }

  remove(id: WindowID) {
    return this.BrowserWindowList.delete(id);
  }

  get(id: WindowID) {
    return this.BrowserWindowList.get(id);
  }

  getId(window: Optional<BrowserWindow>) {
    if (window) {
      for (const [id, win] of this.BrowserWindowList) {
        if (win === window) return id;
      }
    }
    return null;
  }

  close(id: WindowID) {
    const window = this.BrowserWindowList.get(id);
    window && window.close();
    return !!window;
  }

  destroy(id: WindowID) {
    const window = this.BrowserWindowList.get(id);
    window && window.destroy();
    return !!window;
  }

  closeAll(ids?: WindowID[]) {
    if (ids) {
      ids.forEach((id) => {
        const window = this.BrowserWindowList.get(id);
        window && window.close();
      });
    } else {
      this.BrowserWindowList.forEach((window) => {
        window.close();
      });
    }
  }

  destroyAll(ids?: WindowID[]) {
    if (ids) {
      ids.forEach((id) => {
        const window = this.BrowserWindowList.get(id);
        window && window.destroy();
      });
    } else {
      this.BrowserWindowList.forEach((window) => {
        window.destroy();
      });
    }
  }

  getAll() {
    return Array.from(this.BrowserWindowList);
  }

  getAllHasNoId() {
    return Array.from(this.BrowserWindowListHasNoID);
  }

  checkAndShow(id: WindowID) {
    const existingWindow = this.get(id);
    if (existingWindow) {
      if (existingWindow.isMinimized()) {
        existingWindow.restore();
      } else if (!existingWindow.isVisible()) {
        existingWindow.show();
      }
      existingWindow.focus();
    }
    return existingWindow;
  }

  getTray() {
    return this.tray;
  }

  initTray(image: NativeImage | string) {
    this.tray ||= new Tray(image);
    return this.tray;
  }

  private bindWindowCloseEvent(window: BrowserWindow, id?: WindowID) {
    window.on("closed", () => {
      if (id) {
        this.BrowserWindowList.delete(id);
      } else {
        this.BrowserWindowListHasNoID.delete(window);
      }
    });
  }
})();
