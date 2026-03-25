import { BrowserWindow, BrowserWindowConstructorOptions, Tray } from "electron";
import { AppMessageIPC } from "../ipc/main/typed";
import { Log } from "../utils/log";
import NativeImage = Electron.NativeImage;

export type WindowID = WindowType;

export enum WindowExits {
  IGNORE,
  CLOSE,
  DESTROY
}

export class WindowManager {
  private static readonly BrowserWindowList = new Map<WindowID, BrowserWindow>();
  private static readonly BrowserWindowListHasNoID = new Set<BrowserWindow>();
  private static tray: Nullable<Tray> = null;

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
  static createBrowserWindow(
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
    this.bindWindowBus(window, id);
    return window;
  }

  static has(id: WindowID) {
    return this.BrowserWindowList.has(id);
  }

  static remove(id: WindowID) {
    return this.BrowserWindowList.delete(id);
  }

  static get(id: WindowID) {
    const win = this.BrowserWindowList.get(id);
    if (!win) return null;
    if (win.isDestroyed() || win.webContents.isDestroyed()) return null;
    return win;
  }

  static getId(window: Optional<BrowserWindow>) {
    if (window) {
      for (const [id, win] of this.BrowserWindowList) {
        if (win === window) return id;
      }
    }
    return null;
  }

  static close(id: WindowID) {
    const window = this.BrowserWindowList.get(id);
    window && window.close();
    return !!window;
  }

  static destroy(id: WindowID) {
    const window = this.BrowserWindowList.get(id);
    window && window.destroy();
    return !!window;
  }

  static closeAll(ids?: WindowID[]) {
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

  static destroyAll(ids?: WindowID[]) {
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

  static getAll() {
    return Array.from(this.BrowserWindowList);
  }

  static getAllHasNoId() {
    return Array.from(this.BrowserWindowListHasNoID);
  }

  static checkAndShow(id: WindowID) {
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

  static getTray() {
    return this.tray;
  }

  static initTray(image: NativeImage | string) {
    this.tray ||= new Tray(image);
    return this.tray;
  }

  private static bindWindowCloseEvent(window: BrowserWindow, id?: WindowID) {
    window.on("closed", () => {
      if (id) {
        this.BrowserWindowList.delete(id);
      } else {
        this.BrowserWindowListHasNoID.delete(window);
      }
    });
  }

  private static bindWindowBus(window: BrowserWindow, type?: WindowID) {
    if (!type) return;
    const sendBusMessage = (action: MessageTypeMap["windowBus"]["action"]) => {
      Log.debug("windowBus", `${type} - ${action}`);
      try {
        AppMessageIPC.sendAll({
          type: "windowBus",
          sender: "process",
          data: { type, action }
        });
      } catch (err) {
        Log.error("windowBus", "dispatch error", `${type} - ${action}`, err);
      }
    };
    window.addListener("closed", () => sendBusMessage("close"));
    window.addListener("unmaximize", () => sendBusMessage("unmaximize"));
    window.addListener("maximize", () => sendBusMessage("maximize"));
    window.addListener("minimize", () => sendBusMessage("minimize"));
    window.addListener("restore", () => sendBusMessage("unminimize"));
    window.addListener("hide", () => sendBusMessage("hide"));
    window.addListener("show", () => sendBusMessage("show"));
    window.addListener("focus", () => sendBusMessage("focus"));
    window.addListener("ready-to-show", () => sendBusMessage("ready"));
  }
}
