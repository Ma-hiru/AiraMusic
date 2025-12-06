import { BrowserWindow } from "electron";
import { typedIpcMainOn, typedIpcMainSend } from "./typed";
import { getEffectiveWindowSize } from "../../utils/screen";
import { Log } from "../../utils/log";
import {
  CrateLyricWindow,
  CreateLoginWindow,
  CreateMiniWindow,
  WindowExits,
  WindowManager
} from "../../window";
import { CreateInfoWindow } from "../../window/info";

export function registerEventHandlers(mainWindow: BrowserWindow) {
  typedIpcMainOn("createLoginWindow", CreateLoginWindow);
  typedIpcMainOn("createLyricWindow", CrateLyricWindow);
  typedIpcMainOn("createMiniplayerWindow", CreateMiniWindow);
  typedIpcMainOn("createInfoWindow", CreateInfoWindow);
  registerWindowControl();
  registerWindowEventListeners(mainWindow, "main");
}

function registerWindowControl() {
  typedIpcMainOn("close", (_e, type) => {
    Log.trace("app/ipc", "IPC Close Window:", type);
    WindowManager.getBrowserWindowById(type)?.close();
  });
  typedIpcMainOn("minimize", (_e, type) => {
    Log.trace("app/ipc", "IPC Minimize Window:", type);
    WindowManager.getBrowserWindowById(type)?.minimize();
  });
  typedIpcMainOn("maximize", (_e, type) => {
    Log.trace("app/ipc", "IPC Maximize Window:", type);
    const win = WindowManager.getBrowserWindowById(type);
    if (win && !win.isMaximized()) {
      win.maximize();
    }
  });
  typedIpcMainOn("unmaximize", (_e, type) => {
    Log.trace("app/ipc", "IPC Unmaximize Window:", type);
    const win = WindowManager.getBrowserWindowById(type);
    if (win && win.isMaximized()) {
      win.unmaximize();
    }
  });
  typedIpcMainOn("hidden", (_e, type) => {
    Log.trace("app/ipc", "IPC Hidden Window:", type);
    const win = WindowManager.getBrowserWindowById(type);
    if (win && win.isVisible()) {
      win.hide();
    }
  });
  typedIpcMainOn("visible", (_e, type) => {
    Log.trace("app/ipc", "IPC Visible Window:", type);
    const win = WindowManager.getBrowserWindowById(type);
    if (win && !win.isVisible()) {
      win.show();
    }
  });
  typedIpcMainOn("sendMessageTo", (_e, { to, data, type, from }) => {
    const win = WindowManager.getBrowserWindowById(to);
    if (win) {
      typedIpcMainSend(win, "sendMessageTo", { to, data, type, from });
    }
  });
  typedIpcMainOn("mousePenetrate", (_e, { win: type, penetrate }) => {
    const win = WindowManager.getBrowserWindowById(type);
    win?.setIgnoreMouseEvents(penetrate, { forward: true });
  });
  typedIpcMainOn("resizeWindow", (_e, { win: type, bounds }) => {
    const win = WindowManager.getBrowserWindowById(type);
    if (!win) return;
    const current = win.getBounds();
    const next = {
      x: Math.floor(bounds.x ?? current.x),
      y: Math.floor(bounds.y ?? current.y),
      width: Math.floor(bounds.width ?? current.width),
      height: Math.floor(bounds.height ?? current.height)
    };
    win.setBounds(next);
  });
  typedIpcMainOn("loaded", (_e, { win, showAfterLoaded, broadcast }) => {
    Log.trace("app/ipc", `IPC Window Loaded:`, win);
    const window = WindowManager.getBrowserWindowById(win);
    if (window && showAfterLoaded) {
      window.show();
    }
    if (broadcast) {
      WindowManager.getAllBrowserWindows().forEach(([winItemID, winItem]) => {
        typedIpcMainSend(winItem, "sendMessageTo", {
          from: win,
          to: winItemID,
          data: undefined,
          type: "winLoaded"
        });
      });
    }
  });
  typedIpcMainOn("openExternalLink", (_e, { url, title }) => {
    Log.trace("app/ipc", "IPC Open External Link:", url);
    const { effectiveWidth: width, effectiveHeight: height } = getEffectiveWindowSize(0.5);
    WindowManager.createBrowserWindow(
      {
        width,
        height,
        title: title || "External Link",
        resizable: true,
        minimizable: true,
        maximizable: true,
        frame: true,
        type: "normal"
      },
      "external",
      WindowExits.IGNORE
    )
      .loadURL(url)
      .catch((err) => {
        Log.error("app/ipc", "Failed to load external link URL:", err);
      });
  });
}

function registerWindowEventListeners(needRegisterWin: BrowserWindow, type: WindowType) {
  needRegisterWin.on("maximize", () => {
    typedIpcMainSend(needRegisterWin, "sendMessageTo", {
      from: type,
      to: type,
      data: true,
      type: "windowMaximizedChange"
    });
  });
  needRegisterWin.on("unmaximize", () => {
    typedIpcMainSend(needRegisterWin, "sendMessageTo", {
      from: type,
      to: type,
      data: false,
      type: "windowMaximizedChange"
    });
  });
}
