import { BrowserWindow, BrowserWindowConstructorOptions } from "electron";

export type WindowID = WindowType;

export enum WindowExits {
  IGNORE,
  CLOSE,
  DESTROY
}

export const WindowManager = new (class {
  private readonly BrowserWindowList = new Map<WindowID, BrowserWindow>();
  private readonly BrowserWindowListHasNoID = new Set<BrowserWindow>();
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
            return oldWindow;
        }
      }
      // 创建并存储新的窗口实例
      const window = new BrowserWindow(options);
      this.BrowserWindowList.set(id, window);
      window.on("closed", () => {
        this.BrowserWindowList.delete(id);
      });
      return window;
    } else {
      // 创建没有 ID 的窗口实例
      const window = new BrowserWindow(options);
      this.BrowserWindowListHasNoID.add(window);
      window.on("closed", () => {
        this.BrowserWindowListHasNoID.delete(window);
      });
      return window;
    }
  }

  getBrowserWindowById(id: WindowID) {
    return this.BrowserWindowList.get(id);
  }

  closeBrowserWindowById(id: WindowID) {
    const window = this.BrowserWindowList.get(id);
    window && window.close();
    return !!window;
  }

  destroyBrowserWindowById(id: WindowID) {
    const window = this.BrowserWindowList.get(id);
    window && window.destroy();
    return !!window;
  }

  closeAllBrowserWindows(ids?: WindowID[]) {
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

  destroyAllBrowserWindows(ids?: WindowID[]) {
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

  getAllBrowserWindows() {
    return Array.from(this.BrowserWindowList);
  }

  getAllBrowserWindowHasNoId() {
    return Array.from(this.BrowserWindowListHasNoID);
  }
})();
