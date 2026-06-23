import { BrowserWindow, shell } from "electron";
import { MainWindowCreator } from "@/lib/window-creator";
import { MainWindowPreset } from "@/lib/window-preset";
import { MainWindowManager } from "@/lib/window-manager";
import { Log } from "@/lib/log";
import { MainHandle } from "@/lib/handle";
import type { EventHandlers } from "@mahiru/ipc/types";

export const eventHandlers: EventHandlers = {
  event_window_open: (e, type) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    return MainWindowCreator.create(MainWindowPreset.get(type));
  },
  event_window_title: (e, { type, title }) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    MainWindowManager.get(type)?.setTitle(title || process.env.APP_NAME);
  },
  event_window_focus: (e, type) => {
    const win = type ? MainWindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("event_window_focus", type, "win found:", !!win);
    win?.focus();
  },
  event_window_external: (e, { title, url }) => {
    if (!MainHandle.isTrustedOrigin(url)) return;
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    const id = MainWindowManager.getId(sender);
    if (id === "main" || id === "display") {
      return MainWindowCreator.create(MainWindowPreset.external(title, url));
    }
  },
  event_window_browser: (e, { url }) => {
    if (!MainHandle.isTrustedOrigin(url)) return;
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    const id = MainWindowManager.getId(sender);
    if (id === "main" || id === "display") {
      shell.openExternal(url).catch((err) => {
        Log.error("event_window_browser", err);
      });
    }
  },
  event_window_debug: (e, type) => {
    const win = type ? MainWindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("event_window_debug", type, "win found:", !!win);
    win?.webContents.openDevTools();
  },
  event_window_show: (e, type) => {
    const win = type ? MainWindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("event_window_show", type, "win found:", !!win);
    win && !win.isVisible() && win.show();
  },
  event_window_close: (e, type) => {
    const win = type ? MainWindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("event_window_close", type, "win found:", !!win);
    if (!win || win.isDestroyed()) return;
    try {
      if (type === "main") {
        for (const [type, win] of MainWindowManager.getAll()) {
          type !== "main" && win.destroy();
        }
        win.close();
      } else {
        win.destroy();
      }
    } catch (err) {
      Log.error("event_window_close", type, err);
    }
  },
  event_window_hidden: (e, type) => {
    const win = type ? MainWindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("event_window_hidden", type, "win found:", !!win);
    win?.isVisible() && win.hide();
  },
  event_window_minimize: (e, type) => {
    const win = type ? MainWindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("event_window_minimize", type, "win found:", !!win);
    win && !win.isMinimized() && win.minimize();
  },
  event_window_unminimize: (e, type) => {
    const win = type ? MainWindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("event_window_unminimize", type, "win found:", !!win);
    win?.isMinimized() && win.restore();
  },
  event_window_maximize: (e, type) => {
    const win = type ? MainWindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("event_window_maximize", type, "win found:", !!win);
    win && !win.isMaximized() && win.maximize();
  },
  event_window_unmaximize: (e, type) => {
    const win = type ? MainWindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("event_window_unmaximize", type, "win found:", !!win);
    win?.isMaximized() && win.unmaximize();
  },
  event_window_resize: (e, props) => {
    const win = props.type
      ? MainWindowManager.get(props.type)
      : BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    const current = win.getBounds();
    const next = {
      x: Math.floor(props.x ?? current.x),
      y: Math.floor(props.y ?? current.y),
      width: Math.floor(props.width ?? current.width),
      height: Math.floor(props.height ?? current.height)
    };
    const resizable = win.resizable;
    win.setResizable(true);
    win.setBounds(next);
    win.setResizable(resizable);
  },
  event_window_pin: (e, { type, pin, level }) => {
    const win = type ? MainWindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    if (process.platform === "linux") {
      win?.setAlwaysOnTop(pin);
    } else {
      win?.setAlwaysOnTop(pin, level);
    }
  },
  event_window_move: (e, props) => {
    const win = props.type
      ? MainWindowManager.get(props.type)
      : BrowserWindow.fromWebContents(e.sender);
    if (!win) return;

    const { x, y, deltaX, deltaY } = props;
    if (x && y) {
      win.setBounds({
        x: Math.floor(x),
        y: Math.floor(y),
        width: win.getBounds().width,
        height: win.getBounds().height
      });
    } else if (deltaX && deltaY) {
      const current = win.getBounds();
      win.setBounds({
        x: Math.floor(current.x + deltaX),
        y: Math.floor(current.y + deltaY),
        width: current.width,
        height: current.height
      });
    }
  },
  event_window_penetrate: (e, props) => {
    const win = props.type
      ? MainWindowManager.get(props.type)
      : BrowserWindow.fromWebContents(e.sender);
    win?.setIgnoreMouseEvents(props.penetrate, { forward: true });
  },
  event_debug_fatal: (e, { message, error }) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    Log.error("Fatal Error", "sender:", MainWindowManager.getId(sender), message, error);
    // TODO: MainWindowCreator.create(AppWindows.fatalError(message, error));
    MainWindowPreset.fatalError(message, error);
  },
  event_debug_log: (e, { level, message }) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    const name = MainWindowManager.getId(sender);
    if (!Log[level] || !message) return;
    Log[level](`Renderer(${name})`, message);
  }
};
