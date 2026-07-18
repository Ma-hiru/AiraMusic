import { debounce } from "lodash-es";
import {
  Tray,
  BrowserWindow,
  type NativeImage,
  type BrowserWindowConstructorOptions
} from "electron";
import { Log } from "@/lib/log";
import { MainIPC } from "@mahiru/ipc/main";
import type { WindowExits } from "@/types/window";
import type { MessageData } from "@mahiru/ipc/types";

export class MainWindowManager {
  private static readonly BrowserWindowList = new Map<WindowType, BrowserWindow>();
  private static readonly AppFrameURLList = new WeakMap<BrowserWindow, string>();
  private static tray: Nullable<Tray> = null;

  /**
   * 创建一个浏览器窗口。
   *
   * @param {BrowserWindowConstructorOptions} [options] - 浏览器窗口配置。
   * @param {WindowType} [id] - 窗口的唯一 ID。
   * @param {WindowExits} [handleExits=HandleExits.IGNORE] - 当窗口已存在时的处理策略。
   *   - `IGNORE`：忽略，直接返回已存在的窗口。
   *   - `CLOSE`：关闭已存在的窗口。
   *   - `DESTROY`：销毁已存在的窗口。
   * @returns {BrowserWindow} 浏览器窗口实例。
   */
  static createBrowserWindow(
    options: Optional<BrowserWindowConstructorOptions>,
    id: WindowType,
    handleExits: WindowExits = "IGNORE"
  ) {
    // 检查是否已存在具有相同 ID 的窗口
    const oldWindow = this.BrowserWindowList.get(id);
    if (oldWindow) {
      // 根据 handleExits 参数处理已存在的窗口
      switch (handleExits) {
        case "DESTROY":
          oldWindow.destroy();
          break;
        case "CLOSE":
          oldWindow.close();
          break;
        case "IGNORE":
          return this.checkAndShow(oldWindow);
      }
    }
    // 创建并存储新的窗口实例
    const window = new BrowserWindow(options || undefined);
    this.BrowserWindowList.set(id, window);
    this.bindWindowBus(window, id);
    return window;
  }

  static has(id: WindowType) {
    return this.BrowserWindowList.has(id);
  }

  static remove(id: WindowType) {
    return this.BrowserWindowList.delete(id);
  }

  static get(id: WindowType) {
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

  static setAppFrameURL(window: BrowserWindow, url: string) {
    this.AppFrameURLList.set(window, url);
  }

  static getAppFrameURL(window: BrowserWindow) {
    return this.AppFrameURLList.get(window);
  }

  static getAll() {
    return Array.from(this.BrowserWindowList);
  }

  static checkAndShow<T extends WindowType | BrowserWindow>(
    id: T
  ): T extends WindowType ? Nullable<BrowserWindow> : BrowserWindow {
    const existingWindow = typeof id === "string" ? this.get(id) : (id as BrowserWindow);
    if (existingWindow) {
      if (existingWindow.isMinimized()) {
        existingWindow.restore();
      } else if (!existingWindow.isVisible()) {
        existingWindow.show();
      }
      existingWindow.focus();
    }
    return existingWindow as T extends WindowType ? Nullable<BrowserWindow> : BrowserWindow;
  }

  static getTray() {
    return this.tray;
  }

  static initTray(image: string | NativeImage) {
    this.tray ||= new Tray(image);
    return this.tray;
  }

  private static bindWindowBus(window: BrowserWindow, type?: WindowType) {
    if (!type) return;
    const sendBusMessage = (action: MessageData<"bus_deliver_window_event">["action"]) => {
      Log.debug("windowBus", `${type} - ${action}`);
      try {
        MainIPC.MessageChannel.commitAll({
          type: "bus_deliver_window_event",
          sender: "process",
          data: { type, action }
        });
      } catch (err) {
        Log.error("windowBus", "dispatch error", `${type} - ${action}`, err);
      }
    };
    window.addListener("closed", () => {
      this.BrowserWindowList.delete(type);
      window.removeAllListeners();
      sendBusMessage("close");
    });
    window.addListener("unmaximize", () => sendBusMessage("unmaximize"));
    window.addListener("maximize", () => sendBusMessage("maximize"));
    window.addListener("minimize", () => sendBusMessage("minimize"));
    window.addListener("restore", () => sendBusMessage("unminimize"));
    window.addListener("hide", () => sendBusMessage("hide"));
    window.addListener("show", () => sendBusMessage("show"));
    window.addListener("blur", () => sendBusMessage("blur"));
    window.addListener("focus", () => sendBusMessage("focus"));
    window.addListener("ready-to-show", () => sendBusMessage("ready"));
    window.addListener("enter-full-screen", () => sendBusMessage("enter-fullscreen"));
    window.addListener("leave-full-screen", () => sendBusMessage("leave-fullscreen"));
    window.addListener("always-on-top-changed", () => sendBusMessage("always-on-top-changed"));
    if (process.platform === "linux") {
      window.addListener(
        "move",
        debounce(() => sendBusMessage("moved"), 500)
      );
      window.addListener(
        "resize",
        debounce(() => sendBusMessage("resized"), 500)
      );
    } else {
      window.addListener("moved", () => sendBusMessage("moved"));
      window.addListener("resized", () => sendBusMessage("resized"));
    }
  }
}
