import ElectronStore from "electron-store";
import { BrowserWindow } from "electron";
import { StoreType } from "../../background";
import { typedIpcMainOn, typedIpcMainSend } from "./typed";
import { getEffectiveWindowSize } from "../../utils/screen";
import { WindowExits, WindowManager } from "../../window";
import { preloadPath } from "../../utils/path";
import { Log } from "../../utils/log";
import { isDev } from "../../utils/dev";

export function registerEventHandlers(mainWindow: BrowserWindow, store: ElectronStore<StoreType>) {
  registerLoginWindowControl();
  registerWindowControl(mainWindow);
}

function registerLoginWindowControl() {
  typedIpcMainOn("createLoginWindow", () => {
    const { effectiveWidth: width, effectiveHeight: height } = getEffectiveWindowSize(0.3);
    const LoginWindow = WindowManager.createBrowserWindow(
      {
        width,
        height,
        webPreferences: {
          preload: preloadPath
        },
        title: "Login",
        resizable: false,
        minimizable: true,
        maximizable: false,
        titleBarStyle: "hidden",
        frame: false
      },
      "login",
      WindowExits.IGNORE
    );
    if (LoginWindow.isMinimized()) {
      LoginWindow.restore();
      LoginWindow.focus();
    } else {
      if (isDev()) {
        LoginWindow.loadURL("http://localhost:5173/login").catch((err) => {
          Log.error("app/ipc", "Failed to load login window URL:", err);
        });
      } else {
        LoginWindow.loadURL("http://localhost:27232/login").catch((err) => {
          Log.error("app/ipc", "Failed to load login window URL:", err);
        });
      }
      LoginWindow.on("ready-to-show", () => {
        LoginWindow.show();
        // isDev() && LoginWindow.webContents.openDevTools();
      });
    }
  });
}

function registerWindowControl(mainWindow: BrowserWindow) {
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
  typedIpcMainOn("sendMessageTo", (_e, { to, data, type, from }) => {
    Log.trace("app/ipc", `IPC Send Message from ${from} to ${to}:`, type, data);
    const win = WindowManager.getBrowserWindowById(to);
    if (win) {
      typedIpcMainSend(win, "sendMessageTo", { to, data, type, from });
    }
  });
}
