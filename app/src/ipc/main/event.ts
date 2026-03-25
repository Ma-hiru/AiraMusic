import { BrowserWindow, ipcMain } from "electron";
import { AppMessageIPC, MainEventAPI } from "./typed";
import {
  CreateImageWindow,
  CreateInfoWindow,
  CreateLoginWindow,
  CreateLyricWindow,
  CreateMiniWindow,
  WindowManager
} from "../../window";
import { CreateExternalWindow } from "../../window/external";
import { Log } from "../../utils/log";

const mainEventAPI = {
  openInternalWindow: (e, type) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    if (WindowManager.getId(sender) === "main") {
      switch (type) {
        case "login":
          return CreateLoginWindow();
        case "lyric":
          return CreateLyricWindow();
        case "miniplayer":
          return CreateMiniWindow();
        case "info":
          return CreateInfoWindow();
        case "image":
          return CreateImageWindow();
      }
    }
  },
  focusInternalWindow: (e, type) => {
    const win = type ? WindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("focusInternalWindow", type, "win found:", !!win);
    win?.focus();
  },
  openExternalLink: (e, { title, url }) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    if (WindowManager.getId(sender) === "main") {
      return CreateExternalWindow(title, url);
    }
  },
  openInternalDevTools: (e, type) => {
    const win = type ? WindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("openInternalDevTools", type, "win found:", !!win);
    win?.webContents.openDevTools();
  },
  showInternalWindow: (e, type) => {
    const win = type ? WindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("showInternalWindow", type, "win found:", !!win);
    win && !win.isVisible() && win.show();
  },
  closeInternalWindow: (e, type) => {
    const win = type ? WindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("closeInternalWindow", type, "win found:", !!win);
    if (!win || win.isDestroyed()) return;
    try {
      if (type && type !== "main") win.destroy();
      else win.close();
    } catch (err) {
      Log.error("closeInternalWindow", type, err);
    }
  },
  hiddenInternalWindow: (e, type) => {
    const win = type ? WindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("hiddenInternalWindow", type, "win found:", !!win);
    win?.isVisible() && win.hide();
  },
  minimizeInternalWindow: (e, type) => {
    const win = type ? WindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("minimizeInternalWindow", type, "win found:", !!win);
    win && !win.isMinimized() && win.minimize();
  },
  unminimizeInternalWindow: (e, type) => {
    const win = type ? WindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("unminimizeInternalWindow", type, "win found:", !!win);
    win?.isMinimized() && win.restore();
  },
  maximizeInternalWindow: (e, type) => {
    const win = type ? WindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("maximizeInternalWindow", type, "win found:", !!win);
    win && !win.isMaximized() && win.maximize();
  },
  unmaximizeInternalWindow: (e, type) => {
    const win = type ? WindowManager.get(type) : BrowserWindow.fromWebContents(e.sender);
    Log.debug("unmaximizeInternalWindow", type, "win found:", !!win);
    win?.isMaximized() && win.unmaximize();
  },
  resizeInternalWindow: (e, props) => {
    const win = props.type
      ? WindowManager.get(props.type)
      : BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    const current = win.getBounds();
    const next = {
      x: Math.floor(props.x ?? current.x),
      y: Math.floor(props.y ?? current.y),
      width: Math.floor(props.width ?? current.width),
      height: Math.floor(props.height ?? current.height)
    };
    win.setBounds(next);
  },
  moveInternalWindow: (e, props) => {
    const win = props.type
      ? WindowManager.get(props.type)
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
  mousePenetrateInternalWindow: (e, props) => {
    const win = props.type
      ? WindowManager.get(props.type)
      : BrowserWindow.fromWebContents(e.sender);
    win?.setIgnoreMouseEvents(props.penetrate, { forward: true });
  },
  message: (e, message) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    if (message.to === "all") {
      AppMessageIPC.sendAll({
        sender,
        type: message.type,
        data: message.data
      });
    } else {
      AppMessageIPC.send({
        sender,
        receiver: message.to,
        type: message.type,
        data: message.data
      });
    }
  }
} satisfies MainEventAPI;

export function registerEventHandlers() {
  Object.entries(mainEventAPI).forEach(([event, handler]) => {
    ipcMain.on(event, handler);
  });
}
